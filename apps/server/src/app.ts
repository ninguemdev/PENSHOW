import cors from '@fastify/cors';
import {
  createDomainError,
  actionIdSchema,
  healthResponseSchema,
  PROTOCOL_VERSION,
  serverEventSchema,
  socketCredentialsSchema,
} from '@penshow/shared';
import Fastify, { LogController } from 'fastify';
import type { FastifyLoggerOptions } from 'fastify';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { Duplex } from 'node:stream';
import type { Runtime, SessionTokenCodec } from './ports.js';
import { loadConfig, SOCKET_PATH, validateConfig } from './platform/config.js';
import type { ServerConfig } from './platform/config.js';
import { createDispatcher } from './platform/realtime/dispatcher.js';
import type { CommandHandlers } from './platform/realtime/dispatcher.js';
import { createSystemRuntime } from './platform/runtime.js';
import { createSystemSessionTokens } from './platform/session-tokens.js';
import { GuestSessionStore } from './modules/guest-identity/session-store.js';
import type { SessionProof } from './modules/guest-identity/session-store.js';
import { ActiveConnections } from './modules/guest-identity/active-connections.js';
import { registerSessionRoutes } from './modules/guest-identity/session.routes.js';
import { RoomService, type RoomActor } from './modules/rooms/room.service.js';
import type { RoomPolicy } from './modules/rooms/room-policy.js';
import { createRoomHandlers } from './modules/rooms/room.handlers.js';
import { MatchService } from './modules/matches/match.service.js';
import type { PrototypeParameters } from './modules/scoring/match-rules.js';
import { createMatchHandlers } from './modules/matches/match.handlers.js';
import { createRoomPublisher } from './modules/views/room-publisher.js';
import { PublicCommandError } from './command-error.js';
import {
  closeConnections,
  closeUpgradedConnections,
} from './platform/realtime/close-connections.js';
import { LocalQuestionRepository } from './platform/local-question.repository.js';
import { registerWeb } from './platform/web.js';
import { registerNarrationRoutes } from './modules/questions/narration.routes.js';
import type { QuestionRepository } from './modules/questions/question.repository.js';
import {
  DEFAULT_TRAFFIC_POLICY,
  TrafficLimiter,
  validateTrafficPolicy,
  type TrafficPolicy,
} from './platform/traffic-policy.js';

export interface AppDependencies {
  config?: ServerConfig;
  runtime?: Runtime;
  sessionTokens?: SessionTokenCodec;
  handlers?: CommandHandlers;
  logStream?: FastifyLoggerOptions['stream'];
  roomPolicy?: RoomPolicy;
  trafficPolicy?: TrafficPolicy;
  questions?: QuestionRepository;
  questionCatalogFile?: string | URL;
  matchParameters?: PrototypeParameters;
}

export function buildApp(deps: AppDependencies = {}) {
  const config = validateConfig(deps.config ?? loadConfig());
  const traffic = validateTrafficPolicy(deps.trafficPolicy ?? DEFAULT_TRAFFIC_POLICY);
  const app = Fastify({
    bodyLimit: config.httpBodyLimit,
    // preClose drains domain work and realtime first; incomplete HTTP uploads must not hold shutdown.
    forceCloseConnections: true,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => runtime.ids.next(),
    logger: {
      level: config.logLevel,
      ...(deps.logStream ? { stream: deps.logStream } : {}),
      serializers: {
        req: () => ({}),
        res: () => ({}),
        err: () => ({ type: 'Error', message: 'Falha interna.', stack: '' }),
      },
      redact: {
        paths: [
          'req',
          'res',
          'err',
          'body',
          'payload',
          'auth',
          'token',
          'authorization',
          'cookie',
          'answer',
          'optionId',
          'correctOptionId',
        ],
        remove: true,
      },
    },
  });
  const runtime =
    deps.runtime ?? createSystemRuntime(() => app.log.error('Falha em tarefa agendada.'));
  const upgradedConnections = new Set<Duplex>();
  app.server.on('upgrade', (_request, connection) => {
    upgradedConnections.add(connection);
    connection.once('close', () => upgradedConnections.delete(connection));
  });
  const sessions = new GuestSessionStore({
    clock: runtime.clock,
    scheduler: runtime.scheduler,
    ids: runtime.ids,
    tokens: deps.sessionTokens ?? createSystemSessionTokens(),
    ttlMs: config.guestSessionTtlMs,
    maxSessions: traffic.maxSessions,
  });
  const connections = new ActiveConnections(sessions, runtime.scheduler);
  const localQuestions = new LocalQuestionRepository(
    deps.questionCatalogFile,
    config.narrationEnabled,
  );
  const questions = deps.questions ?? localQuestions;
  const allowed = new Set(config.allowedOrigins);
  const acceptsOrigin = (origin: string | undefined) => origin === undefined || allowed.has(origin);
  const limiter = (limit: number) =>
    new TrafficLimiter(runtime.clock, traffic.windowMs, limit, traffic.maxTrackedKeys);
  const sessionCreates = limiter(traffic.sessionCreatesPerWindow);
  const sessionRequests = limiter(traffic.sessionRequestsPerWindow);
  const commands = limiter(traffic.commandsPerWindow);
  const combatInputs = new TrafficLimiter(
    runtime.clock,
    1000,
    traffic.combatInputsPerSecond,
    traffic.maxTrackedKeys,
  );
  const handshakes = limiter(traffic.handshakesPerWindow);

  app.addHook('onRequest', async (request, reply) => {
    if (!acceptsOrigin(request.headers.origin))
      return reply.code(403).send({ error: createDomainError('FORBIDDEN') });
  });
  app.addHook('onSend', async (_request, reply) => {
    if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.register(cors, {
    origin: [...config.allowedOrigins],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof PublicCommandError && error.code === 'SERVER_BUSY')
      return reply.code(503).send({ error: createDomainError(error.code) });
    const status =
      error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
    if (status === 400 || status === 413 || status === 415)
      return reply.code(status).send({ error: createDomainError('INVALID_PAYLOAD') });
    app.log.error('Falha interna ao processar requisição.');
    return reply.code(500).send({ error: createDomainError('INTERNAL_ERROR') });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: createDomainError('NOT_FOUND') }),
  );

  app.get('/health', () => healthResponseSchema.parse({ service: 'penshow', status: 'ok' }));
  registerSessionRoutes(app, sessions, {
    creates: sessionCreates,
    requests: sessionRequests,
    windowMs: traffic.windowMs,
  });
  const apiPrefixes = new Set(['/api', `${config.webBasePath}api`]);
  for (const prefix of apiPrefixes)
    app.register(
      async (api) => {
        api.get('/health', () => healthResponseSchema.parse({ service: 'penshow', status: 'ok' }));
        registerSessionRoutes(api, sessions, {
          creates: sessionCreates,
          requests: sessionRequests,
          windowMs: traffic.windowMs,
        });
      },
      { prefix },
    );
  if (config.webRoot) registerWeb(app, config.webRoot, config.webBasePath);
  app.addHook('onReady', async () => {
    if (!deps.questions) await localQuestions.load();
    sessions.startSweeping();
  });

  let closing = false;
  const realtime = new Server(app.server, {
    path: SOCKET_PATH,
    serveClient: false,
    maxHttpBufferSize: config.socketMessageLimit,
    cors: {
      origin: [...config.allowedOrigins],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    allowRequest: (request, callback) =>
      callback(
        null,
        !closing &&
          realtime.engine.clientsCount < traffic.maxConnections &&
          acceptsOrigin(request.headers.origin) &&
          handshakes.take(request.socket.remoteAddress ?? 'unknown'),
      ),
  });
  const isCurrent = (actor: RoomActor) =>
    connections.isCurrent(actor.playerId, actor.connectionId) &&
    realtime.sockets.sockets.get(actor.connectionId)?.connected === true;
  // Hosted pilots opt in explicitly while keeping production validation and origin checks.
  const matches = !config.gameplayEnabled
    ? undefined
    : new MatchService({
        ...(deps.matchParameters ? { parameters: deps.matchParameters } : {}),
        runtime,
        questions,
        isCurrentActor: (actor) => !closing && isCurrent(actor),
        onError: () => app.log.error('Falha ao processar prazo da partida.'),
      });
  const rooms = new RoomService({
    runtime,
    maxRooms: traffic.maxRooms,
    ...(matches ? { quiz: matches } : {}),
    ...(deps.roomPolicy ? { policy: deps.roomPolicy } : {}),
    isCurrentActor: (actor) => !closing && isCurrent(actor),
    onChange: createRoomPublisher({
      clock: runtime.clock,
      isCurrent,
      send: (actor, event) => {
        const socket = realtime.sockets.sockets.get(actor.connectionId);
        if (event.event === 'tiebreak:frame') socket?.volatile.emit(event.event, event);
        else socket?.emit(event.event, event);
      },
      onError: () => app.log.error('Falha ao publicar visão de sala.'),
    }),
    onError: () => app.log.error('Falha ao observar alteração de sala.'),
  });
  const running = new Set<Promise<void>>();
  if (localQuestions.narration) {
    registerNarrationRoutes(app, rooms, sessions, localQuestions.narration, {
      requests: sessionRequests,
      windowMs: traffic.windowMs,
    });
    for (const prefix of apiPrefixes)
      app.register(
        async (api) =>
          registerNarrationRoutes(api, rooms, sessions, localQuestions.narration!, {
            requests: sessionRequests,
            windowMs: traffic.windowMs,
          }),
        { prefix },
      );
  }
  const trackPresence = (task: Promise<void>) => {
    const execution = task.catch((error) => {
      if (!(error instanceof PublicCommandError))
        app.log.error('Falha ao atualizar presença na sala.');
    });
    running.add(execution);
    void execution.finally(() => running.delete(execution));
  };
  const proofs = new WeakMap<Socket, SessionProof>();
  realtime.use((socket, next) => {
    const raw = socket.handshake.auth;
    socket.handshake.auth = {};
    const reject = (code: 'UNAUTHENTICATED' | 'INTERNAL_ERROR') => {
      const error = createDomainError(code);
      next(Object.assign(new Error(error.message), { data: error }));
    };
    try {
      const credentials = socketCredentialsSchema.safeParse(raw);
      if (!credentials.success || closing) {
        reject('UNAUTHENTICATED');
        return;
      }
      if ('token' in credentials.data) {
        const session = sessions.authenticate(credentials.data.token);
        if (!session) {
          reject('UNAUTHENTICATED');
          return;
        }
        proofs.set(socket, { playerId: session.playerId, tokenHash: session.tokenHash });
      }
      next();
    } catch {
      app.log.error('Falha interna ao autenticar conexão.');
      reject('INTERNAL_ERROR');
    }
  });
  realtime.on('connection', (socket) => {
    if (closing) {
      socket.disconnect(true);
      return;
    }
    const proof = proofs.get(socket);
    proofs.delete(socket);
    if (proof) {
      let replaced = false;
      const actor = { playerId: proof.playerId, connectionId: socket.id };
      const claimed = connections.claim(proof, {
        id: socket.id,
        close: (reason) => {
          replaced = reason === 'replaced';
          const event = serverEventSchema.parse({
            protocolVersion: PROTOCOL_VERSION,
            event: 'session:ended',
            payload: { reason },
          });
          socket.emit(event.event, event);
          socket.disconnect(true);
        },
      });
      if (!claimed) {
        socket.disconnect(true);
        return;
      }
      socket.once('disconnect', () => {
        connections.release(proof.playerId, socket.id);
        if (!closing && !replaced) trackPresence(rooms.disconnect(actor));
      });
      trackPresence(rooms.reconnect(actor));
    }
    const dispatch = createDispatcher({
      clock: runtime.clock,
      maxBytes: config.socketMessageLimit,
      handlers: {
        ...createRoomHandlers(rooms, socket.id),
        ...(matches ? createMatchHandlers(rooms, matches, socket.id) : {}),
        ...deps.handlers,
      },
      onInternalError: () => app.log.error('Falha interna ao processar comando.'),
    });
    let pendingCommands = 0;
    socket.onAny((event: unknown, ...args: unknown[]) => {
      const acknowledge = args.at(-1);
      if (closing) return;
      // Charge malformed and unacknowledged packets too; reconnecting keeps the same budget.
      const admitted = (event === 'tiebreak:input' ? combatInputs : commands).take(
        proof ? `player:${proof.playerId}` : `ip:${socket.handshake.address}`,
      );
      if (!admitted || pendingCommands >= traffic.maxPendingCommands) {
        if (typeof acknowledge === 'function') {
          const raw = args[0];
          const id = actionIdSchema.safeParse(
            raw && typeof raw === 'object' && 'actionId' in raw ? raw.actionId : null,
          );
          acknowledge({
            protocolVersion: PROTOCOL_VERSION,
            actionId: id.success ? id.data : null,
            status: 'error',
            error: createDomainError('RATE_LIMITED'),
          });
        }
        return;
      }
      if (closing || typeof acknowledge !== 'function') return;
      pendingCommands++;
      const execution = dispatch(event, args.length === 2 ? args[0] : undefined, () =>
        proof ? connections.identify(proof, socket.id) : null,
      )
        .then((result) => {
          if (socket.connected) acknowledge(result);
        })
        .catch(() => {
          app.log.error('Falha ao confirmar comando.');
        })
        .finally(() => {
          pendingCommands--;
        });
      running.add(execution);
      void execution.finally(() => running.delete(execution));
    });
  });
  app.addHook('preClose', async () => {
    closing = true;
    await rooms.dispose();
    connections.dispose();
    await closeConnections(realtime.sockets.sockets.values());
    realtime.engine.close();
    sessions.dispose();
    sessionCreates.clear();
    sessionRequests.clear();
    commands.clear();
    combatInputs.clear();
    handshakes.clear();
    await runtime.scheduler.dispose();
    await Promise.allSettled(running);
    await closeUpgradedConnections(upgradedConnections);
  });
  app.addHook('onClose', async () => {
    await realtime.close();
  });

  return Object.assign(app, { runtime, realtime, config, sessions, rooms, questions, matches });
}

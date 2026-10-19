import { afterEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  acknowledgementSchema,
  defaultAvatar,
  issuedGuestSessionSchema,
  serverEventSchema,
  type Acknowledgement,
  type ClientEvent,
  type IssuedGuestSession,
  type MatchStage,
  type RoomView,
  type ServerEvent,
} from '@penshow/shared';
import { buildApp, type AppDependencies } from '../../app.js';
import { loadConfig, SOCKET_PATH } from '../../platform/config.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { repository } from '../../test-support/match.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { matchTimer } from './match.domain.js';

const apps: ReturnType<typeof buildApp>[] = [],
  sockets: Socket[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const socket of sockets.splice(0)) socket.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const profile = { nickname: 'Ana', avatar: defaultAvatar() };
const settings = {
  format: 'prototype-v1' as const,
  maxPlayers: 2,
  enabledCategories: ['history', 'geography'],
};
interface Client {
  socket: Socket;
  session: IssuedGuestSession | undefined;
  events: ServerEvent[];
  command(event: ClientEvent, payload: unknown, actionId?: string): Promise<Acknowledgement>;
}
async function fixture(overrides: AppDependencies = {}) {
  const { runtime, time } = createTestRuntime();
  let seed = 143;
  runtime.random = {
    integer: (max) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % max;
    },
  };
  const app = buildApp({ config: loadConfig({ NODE_ENV: 'test' }), runtime, ...overrides });
  apps.push(app);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  async function issue() {
    return issuedGuestSessionSchema.parse(
      (await app.inject({ method: 'POST', url: '/guest-sessions' })).json(),
    );
  }
  async function connect(
    session?: IssuedGuestSession,
    transport: 'websocket' | 'polling' = 'websocket',
  ): Promise<Client> {
    const socket = io(address, {
      path: SOCKET_PATH,
      transports: [transport],
      autoConnect: false,
      reconnection: false,
      timeout: 1500,
      auth: session ? { token: session.token } : {},
    });
    sockets.push(socket);
    const events: ServerEvent[] = [];
    for (const name of ['room:view', 'room:removed', 'session:ended'])
      socket.on(name, (raw: unknown) => events.push(serverEventSchema.parse(raw)));
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await connected;
    return {
      socket,
      session,
      events,
      command: async (event, payload, actionId = crypto.randomUUID()) =>
        acknowledgementSchema.parse(
          await socket
            .timeout(1500)
            .emitWithAck(event, { protocolVersion: 1, actionId, event, payload }),
        ),
    };
  }
  async function group(transport: 'websocket' | 'polling' = 'websocket') {
    const host = await connect(await issue(), transport),
      guest = await connect(await issue(), transport);
    const created = await host.command('room:create', { profile, settings });
    if (created.status !== 'ok' || created.event !== 'room:create')
      throw new Error('Sala esperada.');
    const entry = created.result;
    expect(
      await guest.command('room:join', {
        code: entry.code,
        profile: { ...profile, nickname: 'Bia' },
      }),
    ).toMatchObject({ status: 'ok' });
    const room = app.rooms.registry.byId(entry.roomId)!;
    function state() {
      const phase = room.snapshot().phase;
      if (phase.status !== 'match' || !phase.game) throw new Error('Motor esperado.');
      return phase.game.state;
    }
    async function advance() {
      await time.advanceTo(matchTimer(state())!.deadlineAt);
    }
    function context() {
      const game = state();
      return {
        roomId: room.id,
        matchId: game.roster.matchId,
        roundId: game.rounds[game.roundIndex]!.roundId,
      };
    }
    async function start() {
      expect(await host.command('match:start', { roomId: room.id })).toMatchObject({
        status: 'ok',
        event: 'match:start',
      });
      await stage(host, 'instructions', room.snapshot().stateVersion);
    }
    async function choose() {
      const { stage: offer } = await stage(
        host,
        'category-selection',
        room.snapshot().stateVersion,
      );
      const chooser = [host, guest].find(
        (client) => client.session?.playerId === offer.chooserPlayerId,
      )!;
      expect(
        await chooser.command('category:choose', { ...context(), category: offer.categories[0] }),
      ).toMatchObject({ status: 'ok' });
    }
    async function open() {
      await start();
      for (const client of [host, guest])
        expect(await client.command('round:ready', context())).toMatchObject({ status: 'ok' });
      await choose();
      await advance();
      await stage(host, 'question-open', room.snapshot().stateVersion);
    }
    function answerPayload(correct = true) {
      const current = state().stage;
      if (!('question' in current)) throw new Error('Pergunta esperada.');
      return {
        ...context(),
        questionId: current.question.publicQuestion.questionId,
        optionId: correct
          ? current.question.correctOptionId
          : current.question.publicQuestion.options.find(
              (option) => option.optionId !== current.question.correctOptionId,
            )!.optionId,
      };
    }
    return {
      host,
      guest,
      entry,
      room,
      state,
      advance,
      context,
      start,
      choose,
      open,
      answerPayload,
    };
  }
  return { app, runtime, time, issue, connect, group };
}
async function view(client: Client, predicate: (view: RoomView) => boolean) {
  let found: RoomView | undefined;
  await vi.waitFor(() => {
    found = client.events
      .filter(
        (event): event is Extract<ServerEvent, { event: 'room:view' }> =>
          event.event === 'room:view',
      )
      .map((event) => event.payload)
      .findLast(predicate);
    expect(found).toBeDefined();
  });
  return found!;
}
async function stage<Phase extends MatchStage['phase']>(client: Client, phase: Phase, version = 0) {
  const snapshot = await view(
    client,
    (view) =>
      view.stateVersion >= version &&
      view.state.status === 'match' &&
      view.state.match.stage.phase === phase,
  );
  if (snapshot.state.status !== 'match') throw new Error();
  return {
    view: snapshot,
    match: snapshot.state.match,
    stage: snapshot.state.match.stage as Extract<MatchStage, { phase: Phase }>,
  };
}
function error(ack: Acknowledgement, code: string) {
  expect(ack).toMatchObject({ status: 'error', error: { code } });
}
function privacy(client: Client) {
  for (const event of client.events) {
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(
      /"editorialQuestionId"|"editorialOptionByPublicId"|"receivedAt"|"source"|"selection"|"token"|"connectionId"/,
    );
    if (event.event !== 'room:view' || event.payload.state.status !== 'match') continue;
    const match = event.payload.state.match;
    if (match.stage.phase !== 'reveal')
      expect(serialized).not.toMatch(/"correctOptionId"|"explanation"/);
    if (match.stage.phase === 'question-reading') expect(serialized).not.toContain('"options"');
    if (match.stage.phase === 'question-open') {
      const own = match.stage.ownAnswer;
      if (own.status === 'submitted')
        expect(match.stage.answeredPlayerIds).toContain(client.session!.playerId);
      expect(serialized).not.toContain('"answers"');
    }
  }
}

describe('quiz clássico autenticado em rede', () => {
  it.each(['websocket', 'polling'] as const)(
    'conclui seis questões com acerto/erro/ausência e matriz de privacidade via %s',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.start();
      const spectator = await f.connect(await f.issue(), transport);
      expect(
        await spectator.command('room:join', {
          code: g.entry.code,
          profile: { ...profile, nickname: 'Cris' },
        }),
      ).toMatchObject({ status: 'ok' });
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'instructions', g.room.snapshot().stateVersion);
      for (const client of [g.host, g.guest])
        expect(await client.command('round:ready', g.context())).toMatchObject({ status: 'ok' });
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'category-selection', g.room.snapshot().stateVersion);
      await g.choose();
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'question-reading', g.room.snapshot().stateVersion);
      await g.advance();
      const seen = new Set<string>(),
        difficulties: string[] = [],
        correctPositions = new Set<number>();
      const answers = [
        [true, false],
        [null, true],
        [true, true],
        [false, false],
        [true, null],
        [null, null],
      ];
      const scores = [
        [100, 0],
        [100, 100],
        [200, 200],
        [200, 200],
        [300, 200],
        [300, 200],
      ];
      for (let index = 0; index < 6; index++) {
        const current = g.state().stage;
        if (current.phase !== 'question-open') throw new Error();
        expect(seen.has(current.question.publicQuestion.questionId)).toBe(false);
        seen.add(current.question.publicQuestion.questionId);
        difficulties.push(current.question.publicQuestion.difficulty);
        correctPositions.add(
          current.question.publicQuestion.options.findIndex(
            (option) => option.optionId === current.question.correctOptionId,
          ),
        );
        expect(
          current.question.publicQuestion.options.every(
            (option) =>
              !current.question.editorialOptionByPublicId.has(option.optionId) ||
              current.question.editorialOptionByPublicId.get(option.optionId) !== option.optionId,
          ),
        ).toBe(true);
        for (const client of [g.host, g.guest, spectator]) {
          const opened = await stage(client, 'question-open', g.room.snapshot().stateVersion);
          expect(opened.match.progress).toEqual({
            roundNumber: 1,
            roundCount: 1,
            questionNumber: index + 1,
            questionCount: 6,
          });
        }
        expect((await stage(spectator, 'question-open')).stage.ownAnswer.status).toBe(
          'unavailable',
        );
        for (const [player, client] of [g.host, g.guest].entries()) {
          const correct = answers[index]![player];
          if (correct === null) continue;
          const payload = g.answerPayload(correct),
            actionId = crypto.randomUUID();
          const ack = await client.command('answer:submit', payload, actionId);
          expect(ack).toMatchObject({
            status: 'ok',
            event: 'answer:submit',
            result: { acceptance: 'recorded' },
          });
          expect(JSON.stringify(ack)).not.toMatch(/correct|explanation|points|optionId/);
          const version = g.room.snapshot().stateVersion;
          const repeated = await client.command('answer:submit', payload, actionId);
          expect(repeated.status).toBe('error');
          expect(g.room.snapshot().stateVersion).toBe(version);
        }
        if (g.state().stage.phase === 'question-open') await g.advance();
        for (const client of [g.host, g.guest, spectator]) {
          const revealed = await stage(client, 'reveal', g.room.snapshot().stateVersion);
          expect(revealed.stage.reveal.correctOptionId).toBe(current.question.correctOptionId);
          expect(revealed.stage.reveal.explanation).toBe(current.question.explanation);
          expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual(scores[index]);
          expect(
            revealed.stage.effects.every(
              (effect) => effect.kind === 'credit' && effect.amount === 100,
            ),
          ).toBe(true);
        }
        await g.advance();
        if (index < 5) {
          for (const client of [g.host, g.guest, spectator])
            await stage(client, 'question-reading', g.room.snapshot().stateVersion);
          await g.advance();
        }
      }
      expect(difficulties.filter((difficulty) => difficulty === 'easy')).toHaveLength(3);
      expect(difficulties.filter((difficulty) => difficulty === 'medium')).toHaveLength(3);
      expect(correctPositions.size).toBeGreaterThan(1);
      await stage(g.host, 'round-results', g.room.snapshot().stateVersion);
      await g.advance();
      for (const client of [g.host, g.guest, spectator]) {
        const complete = await stage(client, 'prototype-complete', g.room.snapshot().stateVersion);
        expect(complete.match.progress).toEqual({
          roundNumber: 1,
          roundCount: 1,
          questionNumber: 6,
          questionCount: 6,
        });
        expect(complete.match.scoreboard.map((score) => score.correctAnswers)).toEqual([3, 2]);
        privacy(client);
      }
      const oldContext = g.context();
      error(
        await g.guest.command('match:returnToLobby', {
          roomId: g.room.id,
          matchId: oldContext.matchId,
        }),
        'FORBIDDEN',
      );
      expect(
        await g.host.command('match:returnToLobby', {
          roomId: g.room.id,
          matchId: oldContext.matchId,
        }),
      ).toMatchObject({ status: 'ok' });
      await view(
        g.host,
        (view) =>
          view.state.status === 'lobby' && view.stateVersion === g.room.snapshot().stateVersion,
      );
      await g.start();
      expect(g.state().roster.matchId).not.toBe(oldContext.matchId);
      error(await g.host.command('round:ready', oldContext), 'STALE_CONTEXT');
    },
  );

  it('limita início ao anfitrião com dois jogadores e autentica todos os comandos', async () => {
    const f = await fixture(),
      host = await f.connect(await f.issue());
    const created = await host.command('room:create', { profile, settings });
    if (created.status !== 'ok' || created.event !== 'room:create') throw new Error();
    const roomId = created.result.roomId;
    error(await host.command('match:start', { roomId }), 'NOT_ENOUGH_PLAYERS');
    const guest = await f.connect(await f.issue());
    await guest.command('room:join', { code: created.result.code, profile });
    error(await guest.command('match:start', { roomId }), 'FORBIDDEN');
    const anonymous = await f.connect();
    error(await anonymous.command('match:start', { roomId }), 'UNAUTHENTICATED');
    expect(await host.command('match:start', { roomId })).toMatchObject({ status: 'ok' });
    error(await host.command('match:start', { roomId }), 'INVALID_PHASE');
  });

  it('serializa respostas simultâneas e resolve uma única vez mesmo com reenvio concorrente', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload(),
      id = crypto.randomUUID();
    const acknowledgements = await Promise.all([
      g.host.command('answer:submit', payload, id),
      g.host.command('answer:submit', payload, id),
      g.guest.command('answer:submit', payload),
    ]);
    expect(acknowledgements.filter((ack) => ack.status === 'ok')).toHaveLength(2);
    expect(acknowledgements.filter((ack) => ack.status === 'error')).toHaveLength(1);
    const revealed = await stage(g.host, 'reveal', g.room.snapshot().stateVersion);
    expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    expect(g.state().history).toHaveLength(1);
  });

  it('bloqueia espectadores, outras salas, retorno prematuro e modalidades não instaladas', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const other = await f.connect(await f.issue());
    error(await other.command('answer:submit', g.answerPayload()), 'NOT_A_MEMBER');
    await other.command('room:create', { profile, settings });
    error(await other.command('round:ready', g.context()), 'NOT_A_MEMBER');
    const spectator = await f.connect(await f.issue());
    await spectator.command('room:join', { code: g.entry.code, profile });
    for (const [event, payload] of [
      ['round:ready', g.context()],
      ['category:choose', { ...g.context(), category: 'history' }],
      ['answer:submit', g.answerPayload()],
    ] as const)
      error(await spectator.command(event, payload), 'FORBIDDEN');
    error(
      await g.host.command('match:returnToLobby', {
        roomId: g.room.id,
        matchId: g.context().matchId,
      }),
      'INVALID_PHASE',
    );
    error(
      await g.host.command('wager:submit', {
        ...g.context(),
        questionId: g.answerPayload().questionId,
        amount: 0,
      }),
      'INVALID_PHASE',
    );
    error(
      await g.host.command('target:choose', {
        ...g.context(),
        questionId: g.answerPayload().questionId,
        targetPlayerId: g.guest.session!.playerId,
      }),
      'INVALID_PHASE',
    );
    privacy(spectator);
  });

  it('valida prontidão, escolha do tema e proíbe resposta durante a leitura', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.start();
    for (const client of [g.host, g.guest])
      expect(await client.command('round:ready', g.context())).toMatchObject({ status: 'ok' });
    const offer = (await stage(g.host, 'category-selection', g.room.snapshot().stateVersion)).stage;
    const wrong = [g.host, g.guest].find(
      (client) => client.session!.playerId !== offer.chooserPlayerId,
    )!;
    error(
      await wrong.command('category:choose', { ...g.context(), category: offer.categories[0] }),
      'FORBIDDEN',
    );
    const chooser = [g.host, g.guest].find((client) => client !== wrong)!;
    error(
      await chooser.command('category:choose', { ...g.context(), category: 'not-offered' }),
      'INVALID_PAYLOAD',
    );
    await g.choose();
    error(await g.host.command('answer:submit', g.answerPayload()), 'INVALID_PHASE');
    await g.advance();
    expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
  });

  it.each(['correct', 'points', 'receivedAt', 'playerId'] as const)(
    'recusa campo privado %s e não modifica a sala',
    async (field) => {
      const f = await fixture(),
        g = await f.group();
      await g.open();
      const before = g.room.snapshot();
      error(
        await g.host.command('answer:submit', {
          ...g.answerPayload(),
          [field]: field === 'playerId' ? g.guest.session!.playerId : 100,
        }),
        'INVALID_PAYLOAD',
      );
      expect(g.room.snapshot()).toEqual(before);
    },
  );

  it('recusa IDs inválidos, contexto antigo e alternativa estranha sem consumir a resposta', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload(),
      before = g.room.snapshot();
    error(
      await g.host.command('answer:submit', { ...payload, optionId: 'option-0' }),
      'INVALID_PAYLOAD',
    );
    error(
      await g.host.command('answer:submit', { ...payload, optionId: crypto.randomUUID() }),
      'INVALID_PAYLOAD',
    );
    for (const key of ['matchId', 'roundId', 'questionId'])
      error(
        await g.host.command('answer:submit', { ...payload, [key]: crypto.randomUUID() }),
        'STALE_CONTEXT',
      );
    expect(g.room.snapshot()).toEqual(before);
    expect(await g.host.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
  });

  it('aceita até um ms antes do prazo e mede a resposta na fila no prazo exato', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const deadline = matchTimer(g.state())!.deadlineAt,
      now = vi.spyOn(f.runtime.clock, 'now');
    now.mockReturnValue(deadline - 1);
    expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
    now.mockReturnValue(deadline);
    error(await g.guest.command('answer:submit', g.answerPayload()), 'DEADLINE_EXPIRED');
    await g.advance();
    const revealed = await stage(g.host, 'reveal', g.room.snapshot().stateVersion);
    expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
  });

  it('restaura resposta própria após reconexão sem reabrir janela ou expor escolha alheia', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload();
    expect(await g.host.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
    const deadline = matchTimer(g.state())!.deadlineAt;
    const current = await f.connect(g.host.session);
    const restored = await stage(current, 'question-open', g.room.snapshot().stateVersion);
    expect(restored.stage.ownAnswer).toEqual({ status: 'submitted', optionId: payload.optionId });
    expect(restored.stage.deadlineAt).toBe(deadline);
    expect(
      (await stage(g.guest, 'question-open', g.room.snapshot().stateVersion)).stage.ownAnswer
        .status,
    ).toBe('pending');
    error(await current.command('answer:submit', payload), 'ALREADY_ANSWERED');
    expect(await g.guest.command('answer:submit', g.answerPayload(false))).toMatchObject({
      status: 'ok',
    });
    expect(
      (await stage(current, 'reveal', g.room.snapshot().stateVersion)).match.scoreboard.map(
        (entry) => entry.points,
      ),
    ).toEqual([100, 0]);
    privacy(current);
    privacy(g.guest);
  });

  it('descarta resposta da conexão substituída enquanto ela aguardava na fila', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    let release!: () => void;
    const held = g.room.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const original = f.app.matches!.execute.bind(f.app.matches);
    const called = vi
      .spyOn(f.app.matches!, 'execute')
      .mockImplementation((...args) => original(...args));
    g.host.socket.emit(
      'answer:submit',
      {
        protocolVersion: 1,
        actionId: crypto.randomUUID(),
        event: 'answer:submit',
        payload: g.answerPayload(),
      },
      () => {},
    );
    let current: Client;
    try {
      await vi.waitFor(() => expect(called).toHaveBeenCalledOnce());
      current = await f.connect(g.host.session);
    } finally {
      release();
    }
    await held;
    const restored = await stage(current!, 'question-open', g.room.snapshot().stateVersion);
    expect(restored.stage.ownAnswer.status).toBe('pending');
    expect(restored.stage.answeredPlayerIds).toEqual([]);
    expect(await current!.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
  });

  it('mantém lobby quando falta conteúdo e não publica uma partida parcial', async () => {
    const f = await fixture({ questions: { ...repository(), list: () => [] } }),
      g = await f.group();
    const before = g.room.snapshot();
    error(await g.host.command('match:start', { roomId: g.room.id }), 'INSUFFICIENT_QUESTIONS');
    expect(g.room.snapshot()).toEqual(before);
    expect(
      g.host.events.some(
        (event) => event.event === 'room:view' && event.payload.state.status === 'match',
      ),
    ).toBe(false);
  });

  it.each(['development', 'production'] as const)(
    'restringe o protótipo ao ambiente apropriado: %s',
    async (environment) => {
      const f = await fixture({
        config: loadConfig({
          NODE_ENV: environment,
          ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
          LOG_LEVEL: 'silent',
        }),
      });
      const g = await f.group();
      const ack = await g.host.command('match:start', { roomId: g.room.id });
      if (environment === 'production') {
        error(ack, 'INVALID_PHASE');
        expect(f.app.matches).toBeUndefined();
        expect(g.room.snapshot().phase.status).toBe('lobby');
      } else {
        expect(ack.status).toBe('ok');
        await stage(g.host, 'instructions');
      }
    },
  );

  it('recupera falha de preparação sem vazar dados privados pelo ack', async () => {
    const lines: string[] = [];
    const f = await fixture({
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const g = await f.group();
    await g.start();
    for (const client of [g.host, g.guest]) await client.command('round:ready', g.context());
    const offer = (await stage(g.host, 'category-selection', g.room.snapshot().stateVersion)).stage;
    const chooser = [g.host, g.guest].find(
      (client) => client.session!.playerId === offer.chooserPlayerId,
    )!;
    vi.spyOn(QuestionSelection.prototype, 'currentQuestion').mockImplementationOnce(() => {
      throw new Error('gabarito-secreto token-secreto caminho-interno');
    });
    const before = g.room.snapshot();
    const payload = { ...g.context(), category: offer.categories[0] };
    const ack = await chooser.command('category:choose', payload);
    error(ack, 'INTERNAL_ERROR');
    expect(g.room.snapshot()).toEqual(before);
    expect(JSON.stringify(ack) + lines.join('')).not.toMatch(
      /gabarito-secreto|token-secreto|caminho-interno/,
    );
    expect(await chooser.command('category:choose', payload)).toMatchObject({ status: 'ok' });
    await stage(g.host, 'question-reading', g.room.snapshot().stateVersion);
  });

  it('encerra partida ativa e limpa agendamentos e transportes', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    await f.app.close();
    await vi.waitFor(() =>
      expect(g.host.events.some((event) => event.event === 'room:removed')).toBe(true),
    );
    expect(f.time.pendingCount).toBe(0);
    expect(f.app.rooms.registry.all()).toHaveLength(0);
    expect(f.app.realtime.engine.clientsCount).toBe(0);
  });
});

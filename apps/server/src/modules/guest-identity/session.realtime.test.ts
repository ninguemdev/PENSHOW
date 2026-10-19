import {
  acknowledgementSchema,
  createDomainError,
  issuedGuestSessionSchema,
  serverEventSchema,
} from '@penshow/shared';
import type { PlayerId } from '@penshow/shared';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { AppDependencies } from '../../app.js';
import { loadConfig, SOCKET_PATH } from '../../platform/config.js';
import { createSystemSessionTokens } from '../../platform/session-tokens.js';
import { createTestRuntime } from '../../test-support/runtime.js';

const apps: ReturnType<typeof buildApp>[] = [];
const clients: Socket[] = [];
const command = {
  protocolVersion: 1,
  actionId: '00000000-0000-4000-8000-000000000001',
  event: 'room:leave',
  payload: { roomId: '00000000-0000-4000-8000-000000000002' },
};
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function start(deps: AppDependencies = {}) {
  const { runtime, time } = createTestRuntime();
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test', GUEST_SESSION_TTL_MS: '2000' }),
    runtime,
    ...deps,
  });
  apps.push(app);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const response = await app.inject({ method: 'POST', url: '/guest-sessions', payload: {} });
  expect(response.statusCode).toBe(201);
  return { app, address, time, session: issuedGuestSessionSchema.parse(response.json()) };
}

async function connect(
  address: string,
  auth: object,
  transport: 'websocket' | 'polling' = 'websocket',
) {
  const client = io(address, {
    path: SOCKET_PATH,
    transports: [transport],
    autoConnect: false,
    reconnection: false,
    timeout: 1500,
    auth,
    extraHeaders: { origin: 'http://127.0.0.1:5173' },
  });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', reject);
    client.connect();
  });
  return client;
}

function disconnected(client: Socket) {
  return new Promise<void>((resolve) => {
    client.once('disconnect', () => resolve());
  });
}

describe('autenticação de sessão em sockets reais', () => {
  it.each(['polling', 'websocket'] as const)(
    'autentica token HTTP em %s e preserva só a prova de sessão no servidor',
    async (transport) => {
      const service = vi.fn(() => ({}));
      const { app, address, session } = await start({ handlers: { 'room:leave': service } });
      const client = await connect(address, { token: session.token }, transport);
      const response = acknowledgementSchema.parse(
        await client.timeout(1500).emitWithAck(command.event, command),
      );
      expect(response.status).toBe('ok');
      expect(service).toHaveBeenCalledWith(session.playerId, command);
      for (const socket of app.realtime.sockets.sockets.values())
        expect(socket.handshake.auth).toEqual({});
      expect(JSON.stringify(app.sessions.entries())).not.toContain(session.token);
    },
  );

  it.each([
    { token: 'invalid' },
    { token: `comicle_v1_${'a'.repeat(43)}` },
    { token: `penshow_v1_${'a'.repeat(43)}` },
    { playerId: '00000000-0000-4000-8000-000000000001' },
    { nickname: 'Ana' },
  ])('rejeita credenciais inválidas ou identidade declarada no handshake: %j', async (auth) => {
    const { address } = await start();
    await expect(connect(address, auth)).rejects.toMatchObject({
      data: createDomainError('UNAUTHENTICATED'),
    });
  });

  it('não permite combinar token válido com identidade alheia nem reutilizar token de outra instância', async () => {
    const first = await start();
    const second = await start();
    await expect(
      connect(first.address, { token: first.session.token, playerId: second.session.playerId }),
    ).rejects.toMatchObject({ data: createDomainError('UNAUTHENTICATED') });
    await expect(connect(second.address, { token: first.session.token })).rejects.toMatchObject({
      data: createDomainError('UNAUTHENTICATED'),
    });
  });

  it.each(['polling', 'websocket'] as const)(
    'substitui conexão anterior e mantém a identidade em %s',
    async (transport) => {
      const service = vi.fn(() => ({}));
      const { address, session } = await start({ handlers: { 'room:leave': service } });
      const first = await connect(address, { token: session.token }, transport);
      const closed = disconnected(first);
      const ended = new Promise<unknown>((resolve) => {
        first.once('session:ended', resolve);
      });
      const second = await connect(address, { token: session.token }, transport);
      await closed;
      expect(serverEventSchema.parse(await ended)).toEqual({
        protocolVersion: 1,
        event: 'session:ended',
        payload: { reason: 'replaced' },
      });
      expect(first.connected).toBe(false);
      expect(
        acknowledgementSchema.parse(await second.timeout(1500).emitWithAck(command.event, command))
          .status,
      ).toBe('ok');
      expect(service).toHaveBeenCalledWith(session.playerId, command);
    },
  );

  it('desconexão voluntária não perde identidade e não permite recuperar após expiração', async () => {
    const { address, session, time } = await start();
    const first = await connect(address, { token: session.token });
    first.disconnect();
    const second = await connect(address, { token: session.token });
    expect(second.connected).toBe(true);
    const closed = disconnected(second);
    const ended = new Promise<unknown>((resolve) => {
      second.once('session:ended', resolve);
    });
    await time.advanceTo(session.expiresAt);
    await closed;
    expect(serverEventSchema.parse(await ended)).toMatchObject({ payload: { reason: 'expired' } });
    await expect(connect(address, { token: session.token })).rejects.toMatchObject({
      data: createDomainError('UNAUTHENTICATED'),
    });
  });

  it('renovação HTTP conserva o socket no prazo antigo e aplica o novo prazo', async () => {
    const service = vi.fn(() => ({}));
    const { app, address, session, time } = await start({ handlers: { 'room:leave': service } });
    const client = await connect(address, { token: session.token });
    await time.advanceTo(2000);
    const response = await app.inject({
      method: 'POST',
      url: `/guest-sessions/${session.playerId}/renew`,
      headers: { authorization: `Bearer ${session.token}` },
      payload: {},
    });
    expect(response.json().expiresAt).toBe(4000);
    await time.advanceTo(3000);
    expect(
      acknowledgementSchema.parse(await client.timeout(1500).emitWithAck(command.event, command))
        .status,
    ).toBe('ok');
    const closed = disconnected(client);
    await time.advanceTo(4000);
    await closed;
    expect(client.connected).toBe(false);
  });

  it('revalida a validade em cada comando mesmo se o timer ainda não executou', async () => {
    const { runtime, time } = createTestRuntime();
    let now = 1000;
    const service = vi.fn(() => ({}));
    const { address, session } = await start({
      runtime: { ...runtime, clock: { now: () => now } },
      handlers: { 'room:leave': service },
    });
    const client = await connect(address, { token: session.token });
    now = session.expiresAt;
    expect(
      acknowledgementSchema.parse(await client.timeout(1500).emitWithAck(command.event, command)),
    ).toMatchObject({ error: createDomainError('UNAUTHENTICATED') });
    expect(service).not.toHaveBeenCalled();
    await time.advanceTo(now);
  });

  it('perfis com o mesmo nome não compartilham identidade', async () => {
    const actors: PlayerId[] = [];
    const { app, address, session } = await start({
      handlers: {
        'room:updateProfile': (actor) => {
          actors.push(actor);
          return { stateVersion: 1 };
        },
      },
    });
    const response = await app.inject({ method: 'POST', url: '/guest-sessions', payload: {} });
    const other = issuedGuestSessionSchema.parse(response.json());
    const first = await connect(address, { token: session.token });
    const second = await connect(address, { token: other.token });
    const profile = {
      nickname: 'Ana',
      avatar: {
        head: 'head-round',
        eyes: 'eyes-dots',
        mouth: 'mouth-smile',
        cheeks: null,
        faceAccessory: null,
        hat: null,
      },
    };
    const update = {
      ...command,
      event: 'room:updateProfile',
      payload: { ...command.payload, profile },
    };
    expect(
      acknowledgementSchema.parse(await first.timeout(1500).emitWithAck(update.event, update))
        .status,
    ).toBe('ok');
    expect(
      acknowledgementSchema.parse(await second.timeout(1500).emitWithAck(update.event, update))
        .status,
    ).toBe('ok');
    expect(actors).toEqual([session.playerId, other.playerId]);
    expect(first.connected && second.connected).toBe(true);
  });

  it('sanitiza erro inesperado de autenticação e não registra a credencial', async () => {
    const codec = createSystemSessionTokens();
    const lines: string[] = [];
    let failing = false;
    const { address, session } = await start({
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
      sessionTokens: {
        ...codec,
        hash: (token) => {
          if (failing) throw new Error(token);
          return codec.hash(token);
        },
      },
    });
    failing = true;
    await expect(connect(address, { token: session.token })).rejects.toMatchObject({
      data: createDomainError('INTERNAL_ERROR'),
    });
    expect(lines.join('')).toContain('Falha interna ao autenticar conexão.');
    expect(lines.join('')).not.toContain(session.token);
  });
});

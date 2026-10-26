import { afterEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  acknowledgementSchema,
  defaultAvatar,
  issuedGuestSessionSchema,
  serverEventSchema,
  type ClientCommand,
  type IssuedGuestSession,
  type RoomView,
  type ServerEvent,
} from '@penshow/shared';
import { buildApp, type AppDependencies } from '../../app.js';
import { loadConfig, SOCKET_PATH } from '../../platform/config.js';
import { createTestRuntime } from '../../test-support/runtime.js';

const apps: ReturnType<typeof buildApp>[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const profile = { nickname: 'Ana', avatar: defaultAvatar() };
const settings = { format: 'prototype-v1' as const, maxPlayers: 2, enabledCategories: ['history'] };
const action = (
  event: ClientCommand['event'],
  payload: unknown,
  actionId = crypto.randomUUID(),
) => ({ protocolVersion: 1, actionId, event, payload });
async function start(overrides: AppDependencies = {}) {
  const fixture = createTestRuntime();
  let draw = 0;
  fixture.runtime.random = { integer: (max) => Math.floor(draw++ / 6) % max };
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    runtime: fixture.runtime,
    roomPolicy: {
      hostTransferGraceMs: 10,
      lobbyRemovalMs: 30,
      emptyRoomTtlMs: 60,
      maxAgeMs: 10000,
    },
    ...overrides,
  });
  apps.push(app);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  async function issue() {
    return issuedGuestSessionSchema.parse(
      (await app.inject({ method: 'POST', url: '/guest-sessions' })).json(),
    );
  }
  async function connect(
    session?: IssuedGuestSession,
    transport: 'polling' | 'websocket' = 'websocket',
  ) {
    const socket = io(address, {
      path: SOCKET_PATH,
      transports: [transport],
      autoConnect: false,
      reconnection: false,
      timeout: 1500,
      auth: session ? { token: session.token } : {},
    });
    clients.push(socket);
    const events: ServerEvent[] = [];
    for (const name of ['room:view', 'room:removed', 'session:ended'])
      socket.on(name, (raw: unknown) => {
        events.push(serverEventSchema.parse(raw));
      });
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await connected;
    return {
      socket,
      events,
      async command(event: ClientCommand['event'], payload: unknown) {
        return acknowledgementSchema.parse(
          await socket.timeout(1500).emitWithAck(event, action(event, payload)),
        );
      },
    };
  }
  return { app, address, ...fixture, issue, connect };
}
type Client = Awaited<ReturnType<Awaited<ReturnType<typeof start>>['connect']>>;
async function view(
  client: Client,
  predicate: (view: RoomView) => boolean = () => true,
): Promise<RoomView> {
  let result: RoomView | undefined;
  await vi.waitFor(() => {
    result = client.events
      .filter(
        (event): event is Extract<ServerEvent, { event: 'room:view' }> =>
          event.event === 'room:view',
      )
      .map((event) => event.payload)
      .findLast(predicate);
    expect(result).toBeDefined();
  });
  return result!;
}
async function create(client: Client) {
  const ack = await client.command('room:create', { profile, settings });
  if (ack.status !== 'ok' || ack.event !== 'room:create') throw new Error('Room creation failed');
  return ack.result;
}

describe('salas autenticadas em rede', () => {
  it('publica ajustes de avatar para outros jogadores, preserva na reconexão e recusa mover a cabeça', async () => {
    const f = await start();
    const session = await f.issue();
    const host = await f.connect(session),
      guest = await f.connect(await f.issue());
    const room = await create(host);
    await guest.command('room:join', { code: room.code, profile: { ...profile, nickname: 'Bia' } });
    const edited = {
      ...profile,
      avatar: {
        ...profile.avatar,
        hair: 'hair-tousled',
        layout: {
          version: 1,
          parts: { hair: { x: 0.12, y: -0.05, scale: 1.2 } },
        },
      },
    };
    expect(
      await host.command('room:updateProfile', { roomId: room.roomId, profile: edited }),
    ).toMatchObject({ status: 'ok' });
    const published = await view(guest, (v) => !!v.members[0]?.profile.avatar.layout);
    expect(published.members[0]?.profile).toEqual(edited);
    const reconnected = await f.connect(session);
    expect((await view(reconnected)).members[0]?.profile).toEqual(edited);
    expect(
      await reconnected.command('room:updateProfile', {
        roomId: room.roomId,
        profile: {
          ...edited,
          avatar: {
            ...edited.avatar,
            layout: { version: 1, parts: { head: { x: 0.1, y: 0, scale: 1 } } },
          },
        },
      }),
    ).toMatchObject({ status: 'error', error: { code: 'INVALID_PAYLOAD' } });
    expect(f.app.rooms.registry.byId(room.roomId)!.snapshot().members[0]?.profile).toEqual(edited);
  });
  it('descarta comando da aba anterior que aguardava na fila quando a nova assumiu', async () => {
    const f = await start();
    const session = await f.issue();
    const old = await f.connect(session);
    const room = await create(old);
    let release!: () => void;
    const held = f.app.rooms.registry.byId(room.roomId)!.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const original = f.app.rooms.updateProfile.bind(f.app.rooms);
    const spy = vi
      .spyOn(f.app.rooms, 'updateProfile')
      .mockImplementation((...args) => original(...args));
    old.socket.emit(
      'room:updateProfile',
      action('room:updateProfile', {
        roomId: room.roomId,
        profile: { ...profile, nickname: 'Stale tab' },
      }),
      () => {},
    );
    let current: Client;
    try {
      await vi.waitFor(() => expect(spy).toHaveBeenCalledOnce());
      current = await f.connect(session);
    } finally {
      release();
    }
    await held;
    const snapshot = await view(current!);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]!.profile.nickname).toBe('Ana');
    expect(snapshot.members[0]!.connection.status).toBe('connected');
  });
  it('recusa sala cheia e payload adulterado sem publicar snapshots a quem falhou', async () => {
    const f = await start();
    const host = await f.connect(await f.issue()),
      guest = await f.connect(await f.issue()),
      extra = await f.connect(await f.issue());
    const room = await create(host);
    await guest.command('room:join', { code: room.code, profile });
    expect(await extra.command('room:join', { code: room.code, profile })).toMatchObject({
      status: 'error',
      error: { code: 'ROOM_FULL' },
    });
    expect(extra.events).toHaveLength(0);
    expect(
      await host.command('room:updateProfile', {
        roomId: room.roomId,
        profile: { ...profile, avatar: { ...profile.avatar, head: 'head-unknown' } },
      }),
    ).toMatchObject({ status: 'error', error: { code: 'INVALID_PAYLOAD' } });
    const ack = await host.socket
      .timeout(1500)
      .emitWithAck('room:view', action('room:leave', { roomId: room.roomId }));
    expect(acknowledgementSchema.parse(ack)).toMatchObject({
      status: 'error',
      error: { code: 'UNKNOWN_EVENT' },
    });
  });
  it.each(['polling', 'websocket'] as const)(
    'envia remoção antes de liberar sockets via %s e limpa todas as tarefas',
    async (transport) => {
      const f = await start();
      const host = await f.connect(await f.issue(), transport);
      const room = await create(host);
      await f.app.close();
      await vi.waitFor(() =>
        expect(host.events).toContainEqual(
          expect.objectContaining({
            event: 'room:removed',
            payload: expect.objectContaining({ roomId: room.roomId, reason: 'closed' }),
          }),
        ),
      );
      expect(f.time.pendingCount).toBe(0);
      expect(f.app.rooms.registry.all()).toHaveLength(0);
    },
  );
  it.each(['polling', 'websocket'] as const)(
    'publica o mesmo lobby completo por destinatário via %s e confirma mutações tipadas',
    async (transport) => {
      const f = await start();
      const first = await f.issue(),
        second = await f.issue();
      const host = await f.connect(first, transport),
        guest = await f.connect(second, transport);
      const room = await create(host);
      const joined = await guest.command('room:join', {
        code: room.code,
        profile: { ...profile, nickname: 'Bia' },
      });
      expect(joined).toMatchObject({
        status: 'ok',
        event: 'room:join',
        result: { playerId: second.playerId },
      });
      const a = await view(host, (v) => v.members.length === 2),
        b = await view(guest, (v) => v.members.length === 2);
      expect(a.viewerId).toBe(first.playerId);
      expect(b.viewerId).toBe(second.playerId);
      expect(a.members).toEqual(b.members);
      expect(a.stateVersion).toBe(b.stateVersion);
      expect(a.serverNow).toBe(b.serverNow);
      expect(a.members.map((m) => m.isHost)).toEqual([true, false]);
      expect(
        await guest.command('room:updateSettings', {
          roomId: room.roomId,
          settings: { ...settings, maxPlayers: 3 },
        }),
      ).toMatchObject({ status: 'error', error: { code: 'FORBIDDEN' } });
      const update = await guest.command('room:updateProfile', {
        roomId: room.roomId,
        profile: { ...profile, nickname: ' Ame\u0301lia  Silva ' },
      });
      expect(update).toMatchObject({ status: 'ok', event: 'room:updateProfile' });
      const updated = await view(host, (v) => v.members[1]?.profile.nickname === 'Amélia Silva');
      expect(updated.stateVersion).toBeGreaterThan(a.stateVersion);
      await host.command('room:updateSettings', {
        roomId: room.roomId,
        settings: { ...settings, maxPlayers: 3 },
      });
      const configured = await view(
        guest,
        (v) => v.state.status === 'lobby' && v.state.settings.maxPlayers === 3,
      );
      expect(configured.members).toHaveLength(2);
      const raw = JSON.stringify(host.events);
      for (const secret of [
        first.token,
        second.token,
        host.socket.id!,
        guest.socket.id!,
        'guestId',
        'tokenHash',
        'connectionId',
        'bannedPlayerIds',
      ])
        expect(raw).not.toContain(secret);
    },
  );
  it('rejeita anônimo, identidade declarada e associação de outra sala sem publicar dados', async () => {
    const f = await start();
    const anonymous = await f.connect();
    expect(await anonymous.command('room:create', { profile, settings })).toMatchObject({
      status: 'error',
      error: { code: 'UNAUTHENTICATED' },
    });
    const host = await f.connect(await f.issue()),
      outsider = await f.connect(await f.issue());
    const room = await create(host),
      other = await create(outsider);
    expect(
      await outsider.command('room:updateProfile', { roomId: room.roomId, profile }),
    ).toMatchObject({ status: 'error', error: { code: 'NOT_A_MEMBER' } });
    expect(await outsider.command('room:join', { code: room.code, profile })).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_PHASE' },
    });
    expect(
      await outsider.command('room:leave', { roomId: other.roomId, playerId: room.playerId }),
    ).toMatchObject({ status: 'error', error: { code: 'INVALID_PAYLOAD' } });
    expect(
      outsider.events.every(
        (event) => event.event !== 'room:view' || event.payload.roomId === other.roomId,
      ),
    ).toBe(true);
    expect(anonymous.events).toHaveLength(0);
  });
  it('notifica saída e expulsão sem encerrar a sessão nem publicar novas visões ao removido', async () => {
    const f = await start();
    const host = await f.connect(await f.issue()),
      guestSession = await f.issue(),
      guest = await f.connect(guestSession);
    const room = await create(host);
    await guest.command('room:join', { code: room.code, profile });
    expect(await guest.command('room:leave', { roomId: room.roomId })).toMatchObject({
      status: 'ok',
      event: 'room:leave',
      result: {},
    });
    await vi.waitFor(() =>
      expect(guest.events).toContainEqual(
        expect.objectContaining({
          event: 'room:removed',
          payload: expect.objectContaining({ reason: 'left' }),
        }),
      ),
    );
    expect(
      (await view(host, (v) => v.members.length === 1 && v.stateVersion > 2)).members,
    ).toHaveLength(1);
    await guest.command('room:join', { code: room.code, profile });
    await host.command('room:kick', { roomId: room.roomId, targetPlayerId: guestSession.playerId });
    await vi.waitFor(() =>
      expect(guest.events).toContainEqual(
        expect.objectContaining({
          event: 'room:removed',
          payload: expect.objectContaining({ reason: 'kicked' }),
        }),
      ),
    );
    const count = guest.events.length;
    await host.command('room:updateProfile', {
      roomId: room.roomId,
      profile: { ...profile, nickname: 'Host' },
    });
    expect(guest.events).toHaveLength(count);
    expect(guest.socket.connected).toBe(true);
    expect(await guest.command('room:join', { code: room.code, profile })).toMatchObject({
      status: 'error',
      error: { code: 'FORBIDDEN' },
    });
    expect(await guest.command('room:create', { profile, settings })).toMatchObject({
      status: 'ok',
      event: 'room:create',
    });
  });
  it('substitui aba e recupera automaticamente a mesma vaga cheia, sem depender de room:join', async () => {
    const f = await start();
    const first = await f.issue(),
      second = await f.issue();
    const host = await f.connect(first),
      old = await f.connect(second);
    const room = await create(host);
    await old.command('room:join', { code: room.code, profile: { ...profile, nickname: 'Bia' } });
    const replacement = await f.connect(second);
    const restored = await view(replacement, (v) => v.viewerId === second.playerId);
    expect(restored.members).toHaveLength(2);
    expect(restored.members[1]!.profile.nickname).toBe('Bia');
    await vi.waitFor(() => expect(old.socket.connected).toBe(false));
    expect(old.events).toContainEqual({
      protocolVersion: 1,
      event: 'session:ended',
      payload: { reason: 'replaced' },
    });
    expect(
      await replacement.command('room:updateProfile', {
        roomId: room.roomId,
        profile: { ...profile, nickname: 'Current' },
      }),
    ).toMatchObject({ status: 'ok' });
    expect(
      (await view(host, (v) => v.members[1]?.profile.nickname === 'Current')).members[1]!.connection
        .status,
    ).toBe('connected');
  });
  it('publica queda, retorno e transferência de anfitrião pelo relógio do servidor', async () => {
    const f = await start();
    const first = await f.issue(),
      second = await f.issue();
    const host = await f.connect(first),
      guest = await f.connect(second);
    const room = await create(host);
    await guest.command('room:join', { code: room.code, profile });
    host.socket.disconnect();
    const absent = await view(guest, (v) => v.members[0]?.connection.status === 'disconnected');
    expect(absent.members[0]!.connection).toEqual({ status: 'disconnected', since: 1000 });
    await f.time.advanceTo(1010);
    expect((await view(guest, (v) => v.members[1]?.isHost === true)).members[0]!.isHost).toBe(
      false,
    );
    const returned = await f.connect(first);
    const restored = await view(returned, (v) => v.members[0]?.connection.status === 'connected');
    expect(restored.members[1]!.isHost).toBe(true);
    expect(restored.members).toHaveLength(2);
  });
  it('revalida a sessão dentro da fila antes de aplicar comando admitido pelo socket', async () => {
    const f = await start({
      config: loadConfig({ NODE_ENV: 'test', GUEST_SESSION_TTL_MS: '1000' }),
    });
    const host = await f.connect(await f.issue());
    const room = await create(host);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = f.app.rooms.registry.byId(room.roomId)!.runExclusive(() => gate);
    const original = f.app.rooms.updateProfile.bind(f.app.rooms);
    const spy = vi
      .spyOn(f.app.rooms, 'updateProfile')
      .mockImplementation((...args) => original(...args));
    host.socket.emit(
      'room:updateProfile',
      action('room:updateProfile', {
        roomId: room.roomId,
        profile: { ...profile, nickname: 'Too late' },
      }),
      () => {},
    );
    try {
      await vi.waitFor(() => expect(spy).toHaveBeenCalledOnce());
      await f.time.advanceTo(2000);
    } finally {
      release();
    }
    await held;
    await vi.waitFor(() =>
      expect(host.events).toContainEqual({
        protocolVersion: 1,
        event: 'session:ended',
        payload: { reason: 'expired' },
      }),
    );
    await f.app.rooms.registry.byId(room.roomId)!.runExclusive(() => {});
    expect(f.app.rooms.registry.byId(room.roomId)!.snapshot().members[0]!.profile.nickname).toBe(
      'Ana',
    );
  });
  it('publica fechamento e remoção, mantém sockets de sessão e permite criar nova sala', async () => {
    const f = await start();
    const host = await f.connect(await f.issue());
    const room = await create(host);
    await f.app.rooms.close(room.roomId);
    await vi.waitFor(() =>
      expect(host.events).toContainEqual(
        expect.objectContaining({
          event: 'room:removed',
          payload: expect.objectContaining({ reason: 'closed' }),
        }),
      ),
    );
    expect(host.socket.connected).toBe(true);
    expect(await host.command('room:create', { profile, settings })).toMatchObject({
      status: 'ok',
    });
    await f.app.close();
    expect(f.app.rooms.registry.all()).toHaveLength(0);
    expect(f.time.pendingCount).toBe(0);
  });
});

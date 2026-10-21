import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acknowledgementSchema, createDomainError, type ClientCommand } from '@penshow/shared';
import { strings } from '../strings/pt-BR';
import { issuedSession, profile, roomView, testStores } from '../test/fixtures';

beforeEach(() => window.history.replaceState(null, '', '/'));
function fixture() {
  const f = testStores();
  f.stores.profile.getState().save(profile);
  const roomCommands: ClientCommand[] = [];
  vi.mocked(f.realtime.command).mockImplementation(async (command) => {
    if (command.event === 'time:sync') throw new Error('No clock sample');
    if (command.event === 'room:sync')
      return {
        protocolVersion: 1,
        actionId: command.actionId,
        status: 'ok',
        event: 'room:sync',
        result: { status: 'absent' },
      };
    roomCommands.push(command);
    if (command.event === 'room:create' || command.event === 'room:join') {
      f.callbacks()?.event({ protocolVersion: 1, event: 'room:view', payload: roomView });
      return acknowledgementSchema.parse({
        protocolVersion: 1,
        actionId: command.actionId,
        status: 'ok',
        event: command.event,
        result: {
          roomId: roomView.roomId,
          code: roomView.code,
          playerId: issuedSession.playerId,
          stateVersion: 1,
        },
      });
    }
    return acknowledgementSchema.parse({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'ok',
      event: command.event,
      result: command.event === 'room:leave' ? {} : { stateVersion: 2 },
    });
  });
  return { ...f, roomCommands };
}
const settings = roomView.state.status === 'lobby' ? roomView.state.settings : never();
function never(): never {
  throw new Error('Expected lobby fixture');
}

describe('ações de lobby', () => {
  it('ativa convidado uma vez e conserva a fotografia recebida antes do ack de criação', async () => {
    const f = fixture();
    const creating = f.stores.lobby.getState().create(settings);
    expect(f.stores.lobby.getState().busy).toBe(true);
    expect(await f.stores.lobby.getState().create(settings)).toBe(false);
    expect(await creating).toBe(true);
    expect(f.http.createSession).toHaveBeenCalledOnce();
    expect(f.roomCommands).toHaveLength(1);
    expect(f.roomCommands[0]).toMatchObject({
      event: 'room:create',
      payload: { profile, settings },
    });
    expect(f.stores.room.getState().view).toEqual(roomView);
    expect(window.location.pathname).toBe('/sala/ABCDEF');
    expect(f.stores.lobby.getState().busy).toBe(false);
  });
  it('normaliza a entrada e usa perfil salvo, sem credenciais no comando', async () => {
    const f = fixture();
    expect(await f.stores.lobby.getState().join(' ab cd ef ')).toBe(true);
    expect(f.roomCommands[0]).toMatchObject({
      event: 'room:join',
      payload: { code: 'ABCDEF', profile },
    });
    expect(JSON.stringify(f.roomCommands)).not.toContain(issuedSession.token);
  });
  it('exige código e perfil antes de emitir sessão ou mutação', async () => {
    const f = fixture();
    expect(await f.stores.lobby.getState().join('AB0DEF')).toBe(false);
    expect(f.stores.lobby.getState().error).toBe(strings.room.codeError);
    f.stores.profile.getState().clear();
    expect(await f.stores.lobby.getState().create(settings)).toBe(false);
    expect(await f.stores.lobby.getState().join('ABCDEF')).toBe(false);
    expect(f.stores.lobby.getState().error).toBe(strings.room.profileRequired);
    expect(f.http.createSession).not.toHaveBeenCalled();
    expect(f.roomCommands).toHaveLength(0);
  });
  it('aguarda a conexão antes de entrar', async () => {
    const f = fixture();
    vi.mocked(f.realtime.connect).mockImplementation((_token, callbacks) =>
      callbacks.status('connecting'),
    );
    const entering = f.stores.lobby.getState().join('ABCDEF');
    await vi.waitFor(() => expect(f.realtime.connect).toHaveBeenCalled());
    expect(f.roomCommands).toHaveLength(0);
    f.stores.session.setState({ connection: 'online' });
    expect(await entering).toBe(true);
    expect(f.roomCommands).toHaveLength(1);
  });
  it('cancela espera de conexão e descarta ack tardio após sair da tela', async () => {
    const f = fixture();
    await f.stores.session.getState().activate();
    f.stores.session.setState({ connection: 'connecting' });
    const entering = f.stores.lobby.getState().join('ABCDEF');
    await Promise.resolve();
    f.stores.lobby.getState().cancel();
    expect(await entering).toBe(false);
    expect(f.roomCommands).toHaveLength(0);
    f.stores.session.setState({ connection: 'online' });
    let resolve!: (value: Awaited<ReturnType<typeof f.realtime.command>>) => void;
    vi.mocked(f.realtime.command).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const next = f.stores.lobby.getState().join('ABCDEF');
    await vi.waitFor(() => expect(resolve).toBeDefined());
    f.stores.lobby.getState().cancel();
    resolve(
      acknowledgementSchema.parse({
        protocolVersion: 1,
        actionId: crypto.randomUUID(),
        status: 'ok',
        event: 'room:join',
        result: {
          roomId: roomView.roomId,
          code: roomView.code,
          playerId: issuedSession.playerId,
          stateVersion: 1,
        },
      }),
    );
    expect(await next).toBe(false);
    expect(window.location.pathname).toBe('/');
  });
  it.each(['ROOM_NOT_FOUND', 'ROOM_FULL', 'FORBIDDEN'] as const)(
    'mostra %s sem fabricar participação ou repetir a ação',
    async (code) => {
      const f = fixture();
      await f.stores.session.getState().activate();
      vi.mocked(f.realtime.command).mockImplementation(async (command) =>
        acknowledgementSchema.parse({
          protocolVersion: 1,
          actionId: command.actionId,
          status: 'error',
          error: createDomainError(code),
        }),
      );
      expect(await f.stores.lobby.getState().join('ABCDEF')).toBe(false);
      expect(f.stores.lobby.getState().error).toBe(createDomainError(code).message);
      expect(f.stores.room.getState().view).toBe(null);
      expect(window.location.pathname).toBe('/');
    },
  );
  it('preserva a visão quando a confirmação se perde e oferece recuperação sem retry automático', async () => {
    const f = fixture();
    await f.stores.session.getState().activate();
    vi.mocked(f.realtime.command).mockImplementation(async () => {
      f.callbacks()?.event({ protocolVersion: 1, event: 'room:view', payload: roomView });
      throw new Error(strings.errors.unconfirmed);
    });
    expect(await f.stores.lobby.getState().create(settings)).toBe(false);
    expect(f.stores.room.getState().view).toEqual(roomView);
    expect(f.stores.lobby.getState().error).toBe(strings.errors.unconfirmed);
    const count = vi.mocked(f.realtime.command).mock.calls.length;
    expect(await f.stores.lobby.getState().join('ABCDEF')).toBe(true);
    expect(vi.mocked(f.realtime.command).mock.calls).toHaveLength(count);
    expect(await f.stores.lobby.getState().join('BCDEFG')).toBe(false);
    expect(f.stores.lobby.getState().error).toBe(strings.room.alreadyMember);
  });
  it('não emite ação quando a ativação falha nem reconecta uma ação administrativa offline', async () => {
    const f = fixture();
    vi.mocked(f.http.health).mockRejectedValue(new Error('offline'));
    expect(await f.stores.lobby.getState().join('ABCDEF')).toBe(false);
    expect(f.stores.lobby.getState().error).toBe(strings.errors.network);
    expect(await f.stores.lobby.getState().updateSettings(settings)).toBe(false);
    expect(f.roomCommands).toHaveLength(0);
  });
  it('recupera uma associação do servidor sem código esperado e mantém durante navegação', async () => {
    const f = fixture();
    await f.stores.session.getState().activate();
    f.callbacks()?.event({ protocolVersion: 1, event: 'room:view', payload: roomView });
    expect(f.stores.room.getState().view).toEqual(roomView);
    expect(await f.stores.lobby.getState().join('ABCDEF')).toBe(true);
    expect(f.roomCommands).toHaveLength(0);
  });
});

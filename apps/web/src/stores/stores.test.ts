import { describe, expect, it, vi } from 'vitest';
import { GUEST_SESSION_STORAGE_KEY, playerIdSchema } from '@penshow/shared';
import { ApiError } from '../lib/http';
import { issuedSession, memoryStorage, profile, roomView, testStores } from '../test/fixtures';
import { createProfileStore } from './profile-store';
import { createRoomStore } from './room-store';

describe('sessão', () => {
  it('mantém o socket durante falha transitória de renovação', async () => {
    const { stores, http, realtime } = testStores();
    await stores.session.getState().activate();
    vi.mocked(http.renewSession).mockRejectedValueOnce(new ApiError(0, 'offline'));
    await stores.session.getState().renew();
    expect(stores.session.getState().status).toBe('active');
    expect(stores.session.getState().connection).toBe('online');
    expect(stores.session.getState().message).toBe('offline');
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });
  it('não restaura sessão encerrada enquanto aguarda renovação', async () => {
    const { stores, http, callbacks } = testStores();
    await stores.session.getState().activate();
    const status = {
      scope: issuedSession.scope,
      playerId: issuedSession.playerId,
      expiresAt: issuedSession.expiresAt,
    };
    let resolve!: (value: typeof status) => void;
    vi.mocked(http.renewSession).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const operation = stores.session.getState().renew();
    await vi.waitFor(() => expect(http.renewSession).toHaveBeenCalled());
    callbacks()?.event({
      protocolVersion: 1,
      event: 'session:ended',
      payload: { reason: 'expired' },
    });
    resolve(status);
    await operation;
    expect(stores.session.getState().status).toBe('ended');
    expect(stores.session.getState().session).toBe(null);
  });
  it('restaura credencial por HTTP antes de abrir o socket e renova explicitamente', async () => {
    const storage = memoryStorage();
    storage.values.set(GUEST_SESSION_STORAGE_KEY, JSON.stringify(issuedSession));
    const { stores, http, realtime } = testStores(storage.access);
    await stores.session.getState().initialize();
    expect(http.verifySession).toHaveBeenCalledWith(issuedSession);
    expect(http.renewSession).not.toHaveBeenCalled();
    expect(realtime.connect).toHaveBeenCalledWith(issuedSession.token, expect.any(Object));
    expect(stores.session.getState().session).not.toHaveProperty('token');
    await stores.session.getState().renew();
    expect(stores.session.getState().session?.expiresAt).toBe(issuedSession.expiresAt + 1000);
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });
  it('preserva a identidade durante erro de rede e recupera no retry', async () => {
    const storage = memoryStorage();
    storage.values.set(GUEST_SESSION_STORAGE_KEY, JSON.stringify(issuedSession));
    const { stores, http } = testStores(storage.access);
    vi.mocked(http.verifySession).mockRejectedValueOnce(new ApiError(0, 'offline'));
    await stores.session.getState().initialize();
    expect(stores.session.getState().status).toBe('offline');
    expect(storage.values.has(GUEST_SESSION_STORAGE_KEY)).toBe(true);
    await stores.session.getState().initialize();
    expect(stores.session.getState().session?.playerId).toBe(issuedSession.playerId);
    expect(http.createSession).not.toHaveBeenCalled();
  });
  it('descarta sessão recusada sem criar outra silenciosamente', async () => {
    const storage = memoryStorage();
    storage.values.set(GUEST_SESSION_STORAGE_KEY, JSON.stringify(issuedSession));
    const { stores, http, realtime } = testStores(storage.access);
    vi.mocked(http.verifySession).mockRejectedValueOnce(new ApiError(401, 'expired'));
    await stores.session.getState().initialize();
    expect(stores.session.getState().status).toBe('ended');
    expect(storage.values.has(GUEST_SESSION_STORAGE_KEY)).toBe(false);
    expect(http.createSession).not.toHaveBeenCalled();
    expect(realtime.connect).not.toHaveBeenCalled();
  });
  it('para após substituição e exige ação explícita para recuperar a mesma identidade', async () => {
    const { stores, callbacks, http, realtime } = testStores();
    await stores.session.getState().activate();
    callbacks()?.event({
      protocolVersion: 1,
      event: 'session:ended',
      payload: { reason: 'replaced' },
    });
    expect(stores.session.getState().status).toBe('ended');
    expect(stores.room.getState().view).toBe(null);
    expect(realtime.connect).toHaveBeenCalledTimes(1);
    await stores.session.getState().activate();
    expect(http.createSession).toHaveBeenCalledTimes(1);
    expect(http.verifySession).toHaveBeenCalledWith(issuedSession);
  });
  it('não abre socket com resposta atrasada após desmontagem', async () => {
    const { stores, http, realtime } = testStores();
    let resolve!: (value: typeof issuedSession) => void;
    vi.mocked(http.createSession).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const operation = stores.session.getState().activate();
    await vi.waitFor(() => expect(http.createSession).toHaveBeenCalled());
    stores.session.getState().dispose();
    resolve(issuedSession);
    await operation;
    expect(realtime.connect).not.toHaveBeenCalled();
  });
  it('deduplica cliques concorrentes e avisa sobre dados de sessão inválidos', async () => {
    const storage = memoryStorage();
    storage.values.set(GUEST_SESSION_STORAGE_KEY, JSON.stringify({ token: 'comicle' }));
    const { stores, http } = testStores(storage.access);
    await Promise.all([stores.session.getState().activate(), stores.session.getState().activate()]);
    expect(http.createSession).toHaveBeenCalledTimes(1);
    expect(stores.session.getState().storageIssue).toBe('corrupt');
  });
});

describe('perfil e sala', () => {
  it('valida e normaliza o perfil antes de persistir', () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage.access);
    expect(store.getState().save({ ...profile, nickname: '  Joana  Silva  ' })).toBe(true);
    expect(store.getState().profile?.nickname).toBe('Joana Silva');
    expect(store.getState().save({ ...profile, nickname: '' })).toBe(false);
    expect(store.getState().profile?.nickname).toBe('Joana Silva');
  });
  it('mantém perfil em memória se a quota for excedida', () => {
    const access = () => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota');
      },
      removeItem: vi.fn(),
    });
    const store = createProfileStore(access);
    expect(store.getState().save(profile)).toBe(true);
    expect(store.getState().profile).toEqual(profile);
    expect(store.getState().storageIssue).toBe('unavailable');
  });
  it('rejeita projeções de outra sala, de outro jogador, inválidas e versões antigas', () => {
    const store = createRoomStore();
    expect(store.getState().receive(roomView, issuedSession.playerId)).toBe(false);
    store.getState().expectRoom('ABCDEF');
    expect(store.getState().receive({}, issuedSession.playerId)).toBe(false);
    expect(
      store
        .getState()
        .receive(roomView, playerIdSchema.parse('10000000-0000-4000-8000-000000000002')),
    ).toBe(false);
    expect(store.getState().receive(roomView, issuedSession.playerId)).toBe(true);
    expect(
      store
        .getState()
        .receive({ ...roomView, code: 'BCDEFG', stateVersion: 2 }, issuedSession.playerId),
    ).toBe(false);
    expect(store.getState().receive(roomView, issuedSession.playerId)).toBe(false);
    expect(store.getState().receive({ ...roomView, stateVersion: 0 }, issuedSession.playerId)).toBe(
      false,
    );
    expect(store.getState().receive({ ...roomView, stateVersion: 2 }, issuedSession.playerId)).toBe(
      true,
    );
    store.getState().reset();
    expect(store.getState().view).toBe(null);
  });
});

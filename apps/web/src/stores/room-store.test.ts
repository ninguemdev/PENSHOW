import { expect, it } from 'vitest';
import { issuedSession, roomView, testStores } from '../test/fixtures';
import { createRoomStore } from './room-store';
it('aplica remoção somente à sala atual e impede fotografia atrasada de restaurá-la', () => {
  const store = createRoomStore();
  store.getState().expectRoom(roomView.code);
  store.getState().receive({ ...roomView, stateVersion: 3 }, issuedSession.playerId);
  expect(
    store.getState().remove({ roomId: roomView.roomId, stateVersion: 2, reason: 'kicked' }),
  ).toBe(false);
  expect(
    store.getState().remove({
      roomId: '20000000-0000-4000-8000-000000000002',
      stateVersion: 4,
      reason: 'kicked',
    }),
  ).toBe(false);
  expect(
    store.getState().remove({ roomId: roomView.roomId, stateVersion: 4, reason: 'kicked' }),
  ).toBe(true);
  expect(store.getState().view).toBe(null);
  expect(store.getState().removed?.reason).toBe('kicked');
  expect(store.getState().receive({ ...roomView, stateVersion: 3 }, issuedSession.playerId)).toBe(
    false,
  );
});
it('encaminha a remoção pelo mesmo contrato de eventos da sessão sem encerrar a identidade', async () => {
  const { stores, callbacks } = testStores();
  await stores.session.getState().activate();
  stores.room.getState().expectRoom(roomView.code);
  callbacks()?.event({ protocolVersion: 1, event: 'room:view', payload: roomView });
  callbacks()?.event({
    protocolVersion: 1,
    event: 'room:removed',
    payload: { roomId: roomView.roomId, stateVersion: 2, reason: 'left' },
  });
  expect(stores.room.getState().view).toBe(null);
  expect(stores.session.getState().status).toBe('active');
  expect(stores.session.getState().session?.playerId).toBe(issuedSession.playerId);
});

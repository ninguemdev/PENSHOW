import type { ClientStores } from '../../stores/client-stores';

export function watchGameSounds(
  stores: Pick<ClientStores, 'room' | 'session' | 'sound'>,
  page: Document = document,
) {
  const update = () => {
    const session = stores.session.getState();
    const view = stores.room.getState().view;
    const ready =
      session.status === 'active' &&
      session.connection === 'online' &&
      session.viewReady &&
      view?.viewerId === session.session?.playerId &&
      page.visibilityState !== 'hidden';
    stores.sound.getState().observe(view, session.connectionEpoch, ready);
  };
  const room = stores.room.subscribe(update),
    session = stores.session.subscribe(update);
  page.addEventListener('visibilitychange', update);
  update();
  return () => {
    room();
    session();
    page.removeEventListener('visibilitychange', update);
    stores.sound.getState().stop();
  };
}

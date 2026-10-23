import type { ClientStores } from '../../stores/client-stores';

export function watchGameSounds(
  stores: Pick<ClientStores, 'room' | 'session' | 'sound'> &
    Partial<Pick<ClientStores, 'narrator'>>,
  page: Document = document,
) {
  const update = () => {
    const narrator = stores.narrator?.getState();
    stores.sound
      .getState()
      .setDucked(narrator?.status === 'loading' || narrator?.status === 'speaking');
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
    session = stores.session.subscribe(update),
    narrator = stores.narrator?.subscribe(update);
  page.addEventListener('visibilitychange', update);
  update();
  return () => {
    room();
    session();
    narrator?.();
    page.removeEventListener('visibilitychange', update);
    stores.sound.getState().stop();
  };
}

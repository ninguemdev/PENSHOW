import type { ClientStores } from '../../stores/client-stores';

export function watchNarrator(
  stores: Pick<ClientStores, 'room' | 'session' | 'narrator'>,
  page: Document = document,
) {
  const update = () => {
    if (page.visibilityState === 'hidden') {
      stores.narrator.getState().stop();
      return;
    }
    const session = stores.session.getState(),
      view = stores.room.getState().view;
    const ready =
      session.status === 'active' &&
      session.connection === 'online' &&
      session.viewReady &&
      view?.viewerId === session.session?.playerId;
    stores.narrator
      .getState()
      .observe(
        view,
        session.connectionEpoch,
        ready,
        () => Date.now() + stores.session.getState().offset,
      );
  };
  const room = stores.room.subscribe(update),
    session = stores.session.subscribe(update),
    preferences = stores.narrator.subscribe(update);
  page.addEventListener('visibilitychange', update);
  update();
  return () => {
    room();
    session();
    preferences();
    page.removeEventListener('visibilitychange', update);
    stores.narrator.getState().stop();
  };
}

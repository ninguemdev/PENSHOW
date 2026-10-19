import { useStore } from 'zustand';
import type { ClientStores } from '../../stores/client-stores';
import { matchActionKey } from '../../stores/match-store';

export function useMatchControls(stores: ClientStores) {
  const view = useStore(stores.room, (state) => state.view);
  const session = useStore(stores.session);
  const actions = useStore(stores.match);
  const key = matchActionKey(view, session.connectionEpoch);
  return {
    ...actions,
    online: session.status === 'active' && session.connection === 'online',
    blocked:
      session.status !== 'active' ||
      session.connection !== 'online' ||
      !session.viewReady ||
      actions.busyKey === key,
    waitingView: !session.viewReady,
    offset: session.offset,
    error: actions.errorKey === key ? actions.error : null,
    attempt: actions.attempt?.key === key ? actions.attempt : null,
  };
}

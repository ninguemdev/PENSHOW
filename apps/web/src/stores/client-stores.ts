import { createHttpClient } from '../lib/http';
import { createRealtimeClient } from '../lib/socket';
import { browserStorage } from '../lib/storage';
import { createProfileStore } from './profile-store';
import { createRoomStore } from './room-store';
import { createSessionStore } from './session-store';
import { createLobbyStore } from './lobby-store';
import { createMatchStore } from './match-store';

export function createClientStores() {
  const room = createRoomStore();
  const profile = createProfileStore(browserStorage);
  const realtime = createRealtimeClient();
  const session = createSessionStore(createHttpClient(), realtime, browserStorage, room);
  return {
    room,
    profile,
    session,
    lobby: createLobbyStore({ room, profile, session, realtime }),
    match: createMatchStore({ room, session, realtime }),
  };
}
export type ClientStores = ReturnType<typeof createClientStores>;

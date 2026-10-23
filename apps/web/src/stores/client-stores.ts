import { createHttpClient } from '../lib/http';
import { createRealtimeClient } from '../lib/socket';
import { browserStorage } from '../lib/storage';
import { createProfileStore } from './profile-store';
import { createRoomStore } from './room-store';
import { createSessionStore } from './session-store';
import { createLobbyStore } from './lobby-store';
import { createMatchStore } from './match-store';
import { createSoundEngine } from '../features/sound/sound-engine';
import { createSoundStore } from './sound-store';
import { createNarratorStore } from './narrator-store';
import { createNarratorEngine } from '../features/sound/narrator-engine';

export function createClientStores() {
  const room = createRoomStore();
  const profile = createProfileStore(browserStorage);
  const realtime = createRealtimeClient();
  const http = createHttpClient();
  const session = createSessionStore(http, realtime, browserStorage, room);
  return {
    room,
    profile,
    session,
    sound: createSoundStore(browserStorage, createSoundEngine()),
    narrator: createNarratorStore(browserStorage, createNarratorEngine(), {
      question: (...args) => session.getState().loadNarration(...args),
      preview: (signal) => http.narrationPreview(signal),
    }),
    lobby: createLobbyStore({ room, profile, session, realtime }),
    match: createMatchStore({ room, session, realtime }),
  };
}
export type ClientStores = ReturnType<typeof createClientStores>;

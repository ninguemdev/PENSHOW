import { vi } from 'vitest';
import { issuedGuestSessionSchema, playerProfileSchema, roomViewSchema } from '@penshow/shared';
import { createHttpClient } from '../lib/http';
import type { RealtimeCallbacks, RealtimeClient } from '../lib/socket';
import type { StorageAccess } from '../lib/storage';
import { createProfileStore } from '../stores/profile-store';
import { createRoomStore } from '../stores/room-store';
import { createSessionStore } from '../stores/session-store';
import { createLobbyStore } from '../stores/lobby-store';
import { createMatchStore } from '../stores/match-store';
import { createSoundEngine } from '../features/sound/sound-engine';
import { createSoundStore } from '../stores/sound-store';

export const issuedSession = issuedGuestSessionSchema.parse({
  scope: 'penshow',
  playerId: '10000000-0000-4000-8000-000000000001',
  token: `penshow_v1_${'A'.repeat(43)}`,
  expiresAt: 9999999999999,
});
export const profile = playerProfileSchema.parse({
  nickname: 'Joana',
  avatar: {
    head: 'head-round',
    eyes: 'eyes-dots',
    mouth: 'mouth-smile',
    cheeks: null,
    faceAccessory: null,
    hat: null,
  },
});
export const roomView = roomViewSchema.parse({
  roomId: '20000000-0000-4000-8000-000000000001',
  code: 'ABCDEF',
  viewerId: issuedSession.playerId,
  stateVersion: 1,
  serverNow: 1000,
  members: [
    {
      playerId: issuedSession.playerId,
      profile,
      connection: { status: 'connected' },
      role: 'player',
      isHost: true,
    },
  ],
  state: {
    status: 'lobby',
    settings: { format: 'prototype-v1', maxPlayers: 12, enabledCategories: ['ciencia'] },
  },
});
export function memoryStorage() {
  const values = new Map<string, string>();
  const access: StorageAccess = () => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  });
  return { values, access };
}
export function testStores(access = memoryStorage().access) {
  let callbacks: RealtimeCallbacks | undefined;
  const realtime: RealtimeClient = {
    connect: vi.fn((_token, next) => {
      callbacks = next;
      next.status('online');
    }),
    disconnect: vi.fn(),
    command: vi.fn().mockRejectedValue(new Error('not synchronized')),
  };
  const http = createHttpClient();
  vi.spyOn(http, 'health').mockResolvedValue({ service: 'penshow', status: 'ok' });
  vi.spyOn(http, 'createSession').mockResolvedValue(issuedSession);
  vi.spyOn(http, 'verifySession').mockResolvedValue({
    scope: issuedSession.scope,
    playerId: issuedSession.playerId,
    expiresAt: issuedSession.expiresAt,
  });
  vi.spyOn(http, 'renewSession').mockResolvedValue({
    scope: issuedSession.scope,
    playerId: issuedSession.playerId,
    expiresAt: issuedSession.expiresAt + 1000,
  });
  const room = createRoomStore();
  const profileStore = createProfileStore(access);
  const session = createSessionStore(http, realtime, access, room);
  return {
    http,
    realtime,
    callbacks: () => callbacks,
    stores: {
      room,
      profile: profileStore,
      session,
      sound: createSoundStore(
        access,
        createSoundEngine(() => null),
      ),
      lobby: createLobbyStore({ room, profile: profileStore, session, realtime }),
      match: createMatchStore({ room, session, realtime }),
    },
  };
}

import { createStore } from 'zustand/vanilla';
import {
  actionIdSchema,
  GUEST_SESSION_STORAGE_KEY,
  issuedGuestSessionSchema,
  type GuestSession,
  type IssuedGuestSession,
} from '@penshow/shared';
import { ApiError, type HttpClient } from '../lib/http';
import type { RealtimeClient, ConnectionStatus } from '../lib/socket';
import { readStored, writeStored, type StorageAccess, type StorageIssue } from '../lib/storage';
import { clockOffset } from '../lib/time-sync';
import { strings } from '../strings/pt-BR';
import type { createRoomStore } from './room-store';

interface SessionState {
  session: GuestSession | null;
  status: 'loading' | 'idle' | 'active' | 'offline' | 'ended';
  connection: ConnectionStatus;
  message: string | null;
  storageIssue: StorageIssue;
  offset: number;
  viewReady: boolean;
  connectionEpoch: number;
  initialize: () => Promise<void>;
  activate: () => Promise<void>;
  renew: () => Promise<void>;
  dispose: () => void;
}

export function createSessionStore(
  http: HttpClient,
  realtime: RealtimeClient,
  storage: StorageAccess,
  room: ReturnType<typeof createRoomStore>,
) {
  let credentials: IssuedGuestSession | null = null;
  let generation = 0;
  let pending: Promise<void> | null = null;
  let hydrated = false;
  let hasClockSample = false;
  return createStore<SessionState>((set, get) => {
    function storeCredentials(value: IssuedGuestSession | null) {
      credentials = value;
      const issue = writeStored(storage, GUEST_SESSION_STORAGE_KEY, value);
      if (issue) set({ storageIssue: issue });
    }
    function end(message: string, keepCredentials = false) {
      generation++;
      pending = null;
      realtime.disconnect();
      if (!keepCredentials) storeCredentials(null);
      room.getState().reset();
      set({ session: null, status: 'ended', connection: 'offline', viewReady: false, message });
    }
    function connect(value: IssuedGuestSession, version: number) {
      room.getState().listen();
      set({
        session: { scope: value.scope, playerId: value.playerId, expiresAt: value.expiresAt },
        status: 'active',
        message: null,
        viewReady: false,
      });
      realtime.connect(value.token, {
        status(connection) {
          if (version !== generation) return;
          set({
            connection,
            viewReady: false,
            ...(connection === 'online' ? { connectionEpoch: get().connectionEpoch + 1 } : {}),
          });
          if (connection === 'online') {
            hasClockSample = false;
            const epoch = get().connectionEpoch;
            const clientSentAt = Date.now();
            void realtime
              .command({
                protocolVersion: 1,
                actionId: actionIdSchema.parse(crypto.randomUUID()),
                event: 'time:sync',
                payload: { clientSentAt },
              })
              .then((ack) => {
                if (version !== generation || epoch !== get().connectionEpoch) return;
                if (
                  ack.status === 'ok' &&
                  ack.event === 'time:sync' &&
                  ack.result.clientSentAt === clientSentAt
                ) {
                  hasClockSample = true;
                  set({
                    offset: clockOffset(
                      clientSentAt,
                      Date.now(),
                      ack.result.serverReceivedAt,
                      ack.result.serverSentAt,
                    ),
                  });
                }
              })
              .catch(() => {
                /* Clock sync is best effort; the server still owns deadlines. */
              });
          }
        },
        event(event) {
          if (version !== generation) return;
          if (event.event === 'session:ended')
            end(strings.session.ended[event.payload.reason], event.payload.reason === 'replaced');
          else if (event.event === 'room:view') {
            if (room.getState().receive(event.payload, value.playerId))
              set({
                viewReady: true,
                ...(!hasClockSample ? { offset: event.payload.serverNow - Date.now() } : {}),
              });
          } else room.getState().remove(event.payload);
        },
        invalid() {
          if (version === generation) set({ message: strings.errors.protocol });
        },
      });
    }
    function run(mode: 'verify' | 'activate' | 'renew') {
      if (pending) return pending;
      const renewing = mode === 'renew' && credentials !== null && get().session !== null;
      const version = renewing ? generation : ++generation;
      if (!renewing) realtime.disconnect();
      set({
        status: 'loading',
        ...(!renewing ? { connection: 'connecting' as const } : {}),
        message: null,
      });
      pending = (async () => {
        try {
          if (!hydrated) {
            const saved = readStored(storage, GUEST_SESSION_STORAGE_KEY, issuedGuestSessionSchema);
            credentials = saved.value;
            hydrated = true;
            set({ storageIssue: saved.issue });
          }
          await http.health();
          if (version !== generation) return;
          let value = credentials;
          if (value) {
            const status = await (mode === 'renew'
              ? http.renewSession(value)
              : http.verifySession(value));
            if (status.playerId !== value.playerId) throw new ApiError(0, strings.errors.protocol);
            value = { ...value, ...status };
          } else if (mode === 'activate') value = await http.createSession();
          if (version !== generation) return;
          if (value) {
            storeCredentials(value);
            if (renewing)
              set({
                session: {
                  scope: value.scope,
                  playerId: value.playerId,
                  expiresAt: value.expiresAt,
                },
                status: 'active',
              });
            else connect(value, version);
          } else set({ status: 'idle', connection: 'offline', session: null });
        } catch (error) {
          if (version !== generation) return;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            end(strings.session.ended.expired);
          } else {
            set({
              status: renewing ? 'active' : 'offline',
              ...(!renewing ? { connection: 'offline' as const } : {}),
              message: error instanceof ApiError ? error.message : strings.errors.network,
            });
          }
        } finally {
          if (version === generation) pending = null;
        }
      })();
      return pending;
    }
    return {
      session: null,
      status: 'loading',
      connection: 'connecting',
      message: null,
      storageIssue: null,
      offset: 0,
      viewReady: false,
      connectionEpoch: 0,
      initialize: () => run('verify'),
      activate: () => run('activate'),
      renew: () => (get().session ? run('renew') : Promise.resolve()),
      dispose() {
        generation++;
        pending = null;
        realtime.disconnect();
      },
    };
  });
}

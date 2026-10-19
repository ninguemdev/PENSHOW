import { createStore } from 'zustand/vanilla';
import {
  actionIdSchema,
  type ClientCommand,
  type PlayerId,
  type RoomSettings,
} from '@penshow/shared';
import type { RealtimeClient } from '../lib/socket';
import { navigate } from '../lib/navigation';
import { normalizeRoomCode } from '../lib/room-code';
import { strings } from '../strings/pt-BR';
import type { createRoomStore } from './room-store';
import type { createSessionStore } from './session-store';
import type { createProfileStore } from './profile-store';

interface Dependencies {
  room: ReturnType<typeof createRoomStore>;
  session: ReturnType<typeof createSessionStore>;
  profile: ReturnType<typeof createProfileStore>;
  realtime: RealtimeClient;
  navigate?: (path: string) => void;
}
type RoomCommand = Extract<ClientCommand, { event: `room:${string}` }>;
type Intent = RoomCommand extends infer Command
  ? Command extends RoomCommand
    ? Omit<Command, 'protocolVersion' | 'actionId'>
    : never
  : never;

export function createLobbyStore(deps: Dependencies) {
  const go = deps.navigate ?? navigate;
  let generation = 0;
  let stopWaiting: (() => void) | null = null;
  return createStore<{
    busy: boolean;
    error: string | null;
    create: (settings: RoomSettings) => Promise<boolean>;
    join: (rawCode: string) => Promise<boolean>;
    leave: () => Promise<boolean>;
    updateSettings: (settings: RoomSettings) => Promise<boolean>;
    updateProfile: () => Promise<boolean>;
    kick: (playerId: PlayerId) => Promise<boolean>;
    cancel: () => void;
  }>((set, get) => {
    async function online(version: number) {
      const current = deps.session.getState();
      if (!current.session || current.status !== 'active') await current.activate();
      if (version !== generation) return;
      const ready = deps.session.getState();
      if (ready.status !== 'active') throw new Error(ready.message ?? strings.errors.network);
      if (ready.connection === 'online') return;
      if (ready.connection === 'offline') throw new Error(strings.errors.offlineAction);
      await new Promise<void>((resolve, reject) => {
        const stop = deps.session.subscribe((state) => {
          if (state.connection === 'online' && state.status === 'active') finish();
          else if (state.connection === 'offline' || state.status === 'ended')
            finish(new Error(strings.errors.offlineAction));
        });
        const timer = setTimeout(() => finish(new Error(strings.errors.offlineAction)), 8000);
        function finish(error?: Error) {
          clearTimeout(timer);
          stop();
          stopWaiting = null;
          if (error) reject(error);
          else resolve();
        }
        stopWaiting = () => finish(new Error(strings.errors.offlineAction));
      });
    }
    async function run(makeIntent: () => Intent | null, admission = false) {
      if (get().busy) return false;
      const version = ++generation;
      set({ busy: true, error: null });
      try {
        if (admission) await online(version);
        if (version !== generation) return false;
        if (deps.session.getState().connection !== 'online')
          throw new Error(strings.errors.offlineAction);
        const playerId = deps.session.getState().session?.playerId;
        if (!playerId) throw new Error(strings.errors.offlineAction);
        const intent = makeIntent();
        if (!intent) return true;
        // During a match, leaving reserves the player's slot but stops their room updates.
        if (intent.event === 'room:leave' && deps.room.getState().view?.state.status === 'match')
          deps.session.setState({ viewReady: false });
        const ack = await deps.realtime.command({
          ...intent,
          protocolVersion: 1,
          actionId: actionIdSchema.parse(crypto.randomUUID()),
        });
        if (version !== generation || deps.session.getState().session?.playerId !== playerId)
          return false;
        if (ack.status === 'error') throw new Error(ack.error.message);
        if (ack.event !== intent.event) throw new Error(strings.errors.protocol);
        if (ack.event === 'room:create' || ack.event === 'room:join') go(`sala/${ack.result.code}`);
        else if (ack.event === 'room:leave') go('');
        return true;
      } catch (error) {
        if (version === generation)
          set({ error: error instanceof Error ? error.message : strings.errors.network });
        return false;
      } finally {
        if (version === generation) set({ busy: false });
      }
    }
    function profile() {
      const saved = deps.profile.getState().profile;
      if (!saved) throw new Error(strings.room.profileRequired);
      return saved;
    }
    function membership() {
      const view = deps.room.getState().view;
      if (!view) throw new Error(strings.room.empty);
      return view;
    }
    return {
      busy: false,
      error: null,
      create: (settings) => {
        if (!deps.profile.getState().profile) {
          set({ error: strings.room.profileRequired });
          return Promise.resolve(false);
        }
        return run(() => {
          if (deps.room.getState().view) throw new Error(strings.room.alreadyMember);
          deps.room.getState().expectRoom(null);
          return { event: 'room:create', payload: { profile: profile(), settings } };
        }, true);
      },
      join: (rawCode) => {
        const code = normalizeRoomCode(rawCode);
        if (!code || !deps.profile.getState().profile) {
          set({ error: code ? strings.room.profileRequired : strings.room.codeError });
          return Promise.resolve(false);
        }
        return run(() => {
          const current = deps.room.getState().view;
          if (current) {
            if (current.code !== code) throw new Error(strings.room.alreadyMember);
            go(`sala/${code}`);
            return null;
          }
          deps.room.getState().expectRoom(code);
          return { event: 'room:join', payload: { code, profile: profile() } };
        }, true);
      },
      leave: () => run(() => ({ event: 'room:leave', payload: { roomId: membership().roomId } })),
      updateSettings: (settings) =>
        run(() => ({
          event: 'room:updateSettings',
          payload: { roomId: membership().roomId, settings },
        })),
      updateProfile: () =>
        run(() => ({
          event: 'room:updateProfile',
          payload: { roomId: membership().roomId, profile: profile() },
        })),
      kick: (targetPlayerId) =>
        run(() => ({
          event: 'room:kick',
          payload: { roomId: membership().roomId, targetPlayerId },
        })),
      cancel() {
        generation++;
        stopWaiting?.();
        set({ busy: false, error: null });
      },
    };
  });
}

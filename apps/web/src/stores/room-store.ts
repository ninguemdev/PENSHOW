import { createStore } from 'zustand/vanilla';
import {
  roomRemovedSchema,
  roomViewSchema,
  type PlayerId,
  type RoomRemoved,
  type RoomView,
  type TiebreakFrame,
  type ServerEvent,
} from '@penshow/shared';

export function createRoomStore() {
  const versions = new Map<string, number>();
  return createStore<{
    view: RoomView | null;
    combatFrame: TiebreakFrame | null;
    receiveCombat: (event: Extract<ServerEvent, { event: 'tiebreak:frame' }>['payload']) => boolean;
    expectedCode: string | null;
    removed: RoomRemoved | null;
    removedCode: string | null;
    listening: boolean;
    listen: () => void;
    remove: (raw: unknown) => boolean;
    expectRoom: (code: string | null) => void;
    receive: (raw: unknown, viewerId: PlayerId) => boolean;
    reset: () => void;
  }>((set, get) => ({
    view: null,
    combatFrame: null,
    receiveCombat(payload) {
      const view = get().view;
      if (
        !get().listening ||
        !view ||
        view.roomId !== payload.roomId ||
        view.state.status !== 'match' ||
        view.state.match.matchId !== payload.matchId ||
        view.state.match.stage.phase !== 'final-tiebreak'
      )
        return false;
      const stage = view.state.match.stage;
      const frame = payload.frame;
      const current = get().combatFrame ?? stage.tiebreak.frame;
      if (
        stage.round.roundId !== payload.roundId ||
        stage.tiebreak.phase !== 'combat' ||
        frame.tiebreakId !== stage.tiebreak.frame.tiebreakId ||
        frame.bout !== stage.tiebreak.frame.bout ||
        frame.generation !== stage.tiebreak.frame.generation ||
        frame.tick <= current.tick
      )
        return false;
      set({ combatFrame: frame });
      return true;
    },
    expectedCode: null,
    removed: null,
    removedCode: null,
    listening: false,
    listen() {
      set({ listening: true });
    },
    expectRoom(code) {
      set({
        expectedCode: code,
        view: null,
        combatFrame: null,
        removed: null,
        removedCode: null,
        listening: true,
      });
    },
    receive(raw, viewerId) {
      const parsed = roomViewSchema.safeParse(raw);
      if (!parsed.success) return false;
      const incoming = parsed.data;
      const identity = `${incoming.roomId}:${viewerId}`;
      if (incoming.stateVersion <= (versions.get(identity) ?? -1)) return false;
      const { view, listening } = get();
      if (!listening || incoming.viewerId !== viewerId) return false;
      if (
        view &&
        (incoming.roomId !== view.roomId ||
          incoming.code !== view.code ||
          incoming.stateVersion <= view.stateVersion)
      )
        return false;
      versions.set(identity, incoming.stateVersion);
      set({ view: incoming, expectedCode: incoming.code, removed: null, removedCode: null });
      const stage = incoming.state.status === 'match' ? incoming.state.match.stage : null;
      const currentFrame = get().combatFrame;
      const nextFrame = stage?.phase === 'final-tiebreak' ? stage.tiebreak.frame : null;
      const preserve =
        stage?.phase === 'final-tiebreak' &&
        stage.tiebreak.phase === 'combat' &&
        currentFrame &&
        nextFrame &&
        currentFrame.tiebreakId === nextFrame.tiebreakId &&
        currentFrame.bout === nextFrame.bout &&
        currentFrame.generation === nextFrame.generation &&
        currentFrame.tick > nextFrame.tick;
      set({ combatFrame: preserve ? currentFrame : nextFrame });
      return true;
    },
    remove(raw) {
      const parsed = roomRemovedSchema.safeParse(raw);
      const { view } = get();
      if (
        !parsed.success ||
        !view ||
        parsed.data.roomId !== view.roomId ||
        parsed.data.stateVersion < view.stateVersion
      )
        return false;
      versions.set(`${view.roomId}:${view.viewerId}`, parsed.data.stateVersion);
      set({
        view: null,
        combatFrame: null,
        expectedCode: null,
        removed: parsed.data,
        removedCode: view.code,
        listening: false,
      });
      return true;
    },
    reset() {
      set({
        view: null,
        combatFrame: null,
        expectedCode: null,
        removed: null,
        removedCode: null,
        listening: false,
      });
    },
  }));
}

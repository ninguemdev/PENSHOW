import { createStore } from 'zustand/vanilla';
import {
  roomRemovedSchema,
  roomViewSchema,
  type PlayerId,
  type RoomRemoved,
  type RoomView,
} from '@penshow/shared';

export function createRoomStore() {
  return createStore<{
    view: RoomView | null;
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
    expectedCode: null,
    removed: null,
    removedCode: null,
    listening: false,
    listen() {
      set({ listening: true });
    },
    expectRoom(code) {
      set({ expectedCode: code, view: null, removed: null, removedCode: null, listening: true });
    },
    receive(raw, viewerId) {
      const parsed = roomViewSchema.safeParse(raw);
      if (!parsed.success) return false;
      const incoming = parsed.data;
      const { view, listening } = get();
      if (!listening || incoming.viewerId !== viewerId) return false;
      if (
        view &&
        (incoming.roomId !== view.roomId ||
          incoming.code !== view.code ||
          incoming.stateVersion <= view.stateVersion)
      )
        return false;
      set({ view: incoming, expectedCode: incoming.code, removed: null, removedCode: null });
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
      set({
        view: null,
        expectedCode: null,
        removed: parsed.data,
        removedCode: view.code,
        listening: false,
      });
      return true;
    },
    reset() {
      set({ view: null, expectedCode: null, removed: null, removedCode: null, listening: false });
    },
  }));
}

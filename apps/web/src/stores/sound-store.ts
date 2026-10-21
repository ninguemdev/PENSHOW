import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import type { RoomView } from '@penshow/shared';
import { readStored, writeStored, type StorageAccess, type StorageIssue } from '../lib/storage';
import { createSoundTracker } from '../features/sound/game-sounds';
import type { SoundEngine } from '../features/sound/sound-engine';

export const SOUND_STORAGE_KEY = 'penshow.sound';
const preferencesSchema = z.strictObject({
  version: z.literal(1),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});
export const DEFAULT_SOUND_PREFERENCES = { version: 1, volume: 0.4, muted: true } as const;
type Preferences = z.infer<typeof preferencesSchema>;

export function createSoundStore(storage: StorageAccess, engine: SoundEngine) {
  const tracker = createSoundTracker();
  let generation = 0;
  return createStore<
    Preferences & {
      hydrated: boolean;
      storageIssue: StorageIssue;
      status: 'locked' | 'unlocking' | 'ready' | 'unavailable';
      hydrate(): void;
      activate(): Promise<void>;
      mute(): void;
      setVolume(volume: number): void;
      preview(): void;
      observe(view: RoomView | null, epoch: number, ready: boolean): void;
      stop(): void;
      dispose(): void;
    }
  >((set, get) => {
    function save(next: Preferences) {
      engine.configure(next.volume, next.muted);
      set({ ...next, storageIssue: writeStored(storage, SOUND_STORAGE_KEY, next) });
    }
    return {
      ...DEFAULT_SOUND_PREFERENCES,
      hydrated: false,
      storageIssue: null,
      status: 'locked',
      hydrate() {
        if (get().hydrated) return;
        const saved = readStored(storage, SOUND_STORAGE_KEY, preferencesSchema);
        const preferences = saved.value ?? DEFAULT_SOUND_PREFERENCES;
        engine.configure(preferences.volume, preferences.muted);
        set({ ...preferences, hydrated: true, storageIssue: saved.issue });
      },
      async activate() {
        get().hydrate();
        const current = ++generation;
        save({ version: 1, volume: get().volume, muted: false });
        set({ status: 'unlocking' });
        let available = false;
        try {
          available = await engine.unlock();
        } catch {
          /* Keep the game playable. */
        }
        if (current === generation) set({ status: available ? 'ready' : 'unavailable' });
      },
      mute() {
        get().hydrate();
        generation++;
        save({ version: 1, volume: get().volume, muted: true });
        if (get().status === 'unlocking') set({ status: 'locked' });
      },
      setVolume(volume) {
        get().hydrate();
        if (!Number.isFinite(volume)) return;
        save({ version: 1, muted: get().muted, volume: Math.min(1, Math.max(0, volume)) });
      },
      preview() {
        if (get().status === 'ready' && !get().muted) engine.play('start');
      },
      observe(view, epoch, ready) {
        const cue = tracker.observe(view, epoch, ready);
        if (!ready) engine.stop();
        if (
          cue &&
          get().status === 'ready' &&
          !get().muted &&
          get().volume > 0 &&
          !engine.play(cue)
        )
          set({ status: 'locked' });
      },
      stop: () => engine.stop(),
      dispose() {
        generation++;
        engine.dispose();
        set({ status: 'locked' });
      },
    };
  });
}

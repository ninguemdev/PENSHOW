import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import type { RoomView } from '@penshow/shared';
import { readStored, writeStored, type StorageAccess, type StorageIssue } from '../lib/storage';
import type { NarratorEngine } from '../features/sound/narrator-engine';

export const NARRATOR_STORAGE_KEY = 'penshow.narrator';
const schema = z.strictObject({
  version: z.literal(1),
  enabled: z.boolean(),
  volume: z.number().min(0).max(1),
});
type Preferences = z.infer<typeof schema>;
interface Loader {
  question(roomId: string, questionId: string, signal: AbortSignal): Promise<ArrayBuffer>;
  preview(signal: AbortSignal): Promise<ArrayBuffer>;
}
export function createNarratorStore(
  storage: StorageAccess,
  engine: NarratorEngine,
  loader: Loader,
) {
  let generation = 0,
    pending: AbortController | undefined,
    lastKey: string | undefined;
  const defaults: Preferences = { version: 1, enabled: false, volume: 0.6 };
  return createStore<
    Preferences & {
      hydrated: boolean;
      storageIssue: StorageIssue;
      status: 'locked' | 'unlocking' | 'ready' | 'loading' | 'speaking' | 'unavailable';
      hydrate(): void;
      activate(): Promise<void>;
      disable(): void;
      setVolume(volume: number): void;
      preview(): Promise<void>;
      observe(view: RoomView | null, epoch: number, ready: boolean, now: () => number): void;
      stop(): void;
      dispose(): void;
    }
  >((set, get) => {
    function stop() {
      generation++;
      pending?.abort();
      pending = undefined;
      engine.stop();
    }
    function save(preferences: Preferences) {
      engine.configure(preferences.volume);
      set({
        ...preferences,
        storageIssue: writeStored(storage, NARRATOR_STORAGE_KEY, preferences),
      });
    }
    async function play(
      load: (signal: AbortSignal) => Promise<ArrayBuffer>,
      timing: { startsAt: number; endsAt: number; now(): number },
    ) {
      stop();
      const current = generation;
      const abort = new AbortController();
      pending = abort;
      set({ status: 'loading' });
      try {
        const data = await load(abort.signal);
        if (current !== generation || abort.signal.aborted) return;
        const played = await engine.play(data, timing, () => {
          if (current === generation) set({ status: 'ready' });
        });
        if (current === generation)
          set({
            status: played ? 'speaking' : timing.now() >= timing.endsAt ? 'ready' : 'unavailable',
          });
      } catch {
        if (current === generation && !abort.signal.aborted) set({ status: 'unavailable' });
      }
    }
    return {
      ...defaults,
      hydrated: false,
      storageIssue: null,
      status: 'locked',
      hydrate() {
        if (get().hydrated) return;
        const saved = readStored(storage, NARRATOR_STORAGE_KEY, schema);
        const value = saved.value ?? defaults;
        engine.configure(value.volume);
        set({ ...value, hydrated: true, storageIssue: saved.issue });
      },
      async activate() {
        get().hydrate();
        stop();
        const current = generation;
        // Unlock happens in the user's gesture, before fetching any audio.
        const unlocking = engine.unlock();
        save({ version: 1, enabled: true, volume: get().volume });
        set({ status: 'unlocking' });
        const available = await unlocking.catch(() => false);
        if (current === generation) {
          lastKey = undefined;
          set({ status: available ? 'ready' : 'unavailable' });
        }
      },
      disable() {
        stop();
        lastKey = undefined;
        save({ version: 1, enabled: false, volume: get().volume });
        set({ status: 'locked' });
      },
      setVolume(volume) {
        if (!Number.isFinite(volume)) return;
        save({ version: 1, enabled: get().enabled, volume: Math.min(1, Math.max(0, volume)) });
        if (volume === 0) {
          stop();
          set({ status: 'ready' });
        }
      },
      async preview() {
        if (!get().enabled || get().status !== 'ready' || !get().volume) return;
        const now = Date.now();
        await play(loader.preview, { startsAt: now + 1000, endsAt: now + 30_000, now: Date.now });
      },
      observe(view, epoch, ready, now) {
        const state = view?.state;
        const currentStage = state?.status === 'match' ? state.match.stage : undefined;
        const own =
          currentStage?.phase === 'final-tiebreak' ? currentStage.tiebreak.ownQuestion : undefined;
        const stage =
          own?.status === 'reading'
            ? { phase: 'final-question-reading' as const, ...own }
            : currentStage;
        if (
          !view ||
          state?.status !== 'match' ||
          !ready ||
          !get().enabled ||
          !get().volume ||
          !stage ||
          (stage.phase !== 'question-reading' && stage.phase !== 'final-question-reading') ||
          !stage.narration
        ) {
          if (lastKey !== undefined) {
            stop();
            lastKey = undefined;
            if (get().status === 'speaking' || get().status === 'loading') set({ status: 'ready' });
          }
          return;
        }
        if (
          get().status === 'locked' ||
          get().status === 'unlocking' ||
          get().status === 'unavailable'
        )
          return;
        const key = `${view.roomId}:${state.match.matchId}:${stage.question.questionId}:${epoch}`;
        if (lastKey === key || now() >= stage.opensAt - 300) return;
        lastKey = key;
        void play((signal) => loader.question(view.roomId, stage.question.questionId, signal), {
          startsAt: stage.opensAt - stage.narration.durationMs - 300,
          endsAt: stage.opensAt - 300,
          now,
        });
      },
      stop() {
        stop();
        lastKey = undefined;
        if (get().status === 'loading' || get().status === 'speaking') set({ status: 'ready' });
      },
      dispose() {
        stop();
        lastKey = undefined;
        engine.dispose();
        set({ status: 'locked' });
      },
    };
  });
}

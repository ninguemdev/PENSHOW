import { SOUND_CATALOG, type SoundId } from './sound-catalog.js';

export interface SoundEngine {
  unlock(): Promise<boolean>;
  configure(volume: number, muted: boolean): void;
  play(id: SoundId): boolean;
  stop(): void;
  dispose(): void;
}
export type SoundContext = Pick<
  AudioContext,
  'currentTime' | 'state' | 'destination' | 'createGain' | 'createOscillator' | 'resume' | 'close'
>;

export function browserAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    return typeof window.AudioContext === 'function' ? new window.AudioContext() : null;
  } catch {
    return null;
  }
}

export function soundLevel(volume: number, muted: boolean) {
  return muted || !Number.isFinite(volume) ? 0 : 0.5 * Math.min(1, Math.max(0, volume)) ** 2;
}

export function createSoundEngine(
  createContext: () => SoundContext | null = browserAudioContext,
): SoundEngine {
  let context: SoundContext | null = null;
  let master: GainNode | null = null;
  let level = 0;
  let pending: Promise<boolean> | null = null;
  const active = new Map<OscillatorNode, GainNode>();
  function stop() {
    for (const [source, gain] of active) {
      try {
        source.stop();
      } catch {
        /* A finished source may already be stopped. */
      }
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* A device can disappear during cleanup. */
      }
    }
    active.clear();
  }
  return {
    unlock() {
      if (pending) return pending;
      try {
        if (!context || context.state === 'closed') {
          context = createContext();
          if (!context) return Promise.resolve(false);
          master = context.createGain();
          master.gain.value = level;
          master.connect(context.destination);
        }
        const current = context;
        // Called synchronously from the activation button, before awaiting anything.
        const resumed = current.state === 'running' ? Promise.resolve() : current.resume();
        const result = resumed.then(
          () => context === current && current.state === 'running',
          () => false,
        );
        pending = result;
        void result.then(() => {
          if (pending === result) pending = null;
        });
        return result;
      } catch {
        const broken = context;
        context = null;
        master = null;
        try {
          if (broken && broken.state !== 'closed') void broken.close().catch(() => undefined);
        } catch {
          /* No audio device. */
        }
        return Promise.resolve(false);
      }
    },
    configure(volume, muted) {
      level = soundLevel(volume, muted);
      try {
        master?.gain.setTargetAtTime(level, context!.currentTime, 0.01);
      } catch {
        /* Audio never affects game state. */
      }
      if (level === 0) stop();
    },
    play(id) {
      if (!context || !master || context.state !== 'running' || level === 0) return false;
      try {
        // A new cue replaces the previous one; unavailable sounds are never queued.
        stop();
        const at = context.currentTime;
        for (const tone of SOUND_CATALOG[id]) {
          const source = context.createOscillator(),
            gain = context.createGain();
          const start = at + tone.delay,
            end = start + tone.duration;
          source.type = tone.wave;
          source.frequency.setValueAtTime(tone.frequency, start);
          if (tone.endFrequency)
            source.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
          gain.gain.setValueAtTime(0, at);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          source.connect(gain);
          gain.connect(master);
          active.set(source, gain);
          source.onended = () => {
            active.delete(source);
            try {
              source.disconnect();
              gain.disconnect();
            } catch {
              /* Device teardown is best effort. */
            }
          };
          source.start(start);
          source.stop(end + 0.015);
        }
        return true;
      } catch {
        stop();
        return false;
      }
    },
    stop,
    dispose() {
      stop();
      const previous = context;
      context = null;
      master = null;
      pending = null;
      try {
        if (previous && previous.state !== 'closed') void previous.close().catch(() => undefined);
      } catch {
        /* Teardown must also work without an audio device. */
      }
    },
  };
}

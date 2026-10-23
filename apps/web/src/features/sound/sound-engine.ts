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
  type Lane = 'ui' | 'game';
  interface Voice {
    gain: GainNode;
    lane: Lane;
    startsAt: number;
  }
  const active = new Map<OscillatorNode, Voice>();
  let lastInteractionAt = -Infinity;
  function release(source: OscillatorNode, voice: Voice) {
    active.delete(source);
    try {
      source.disconnect();
      voice.gain.disconnect();
    } catch {
      /* Device removed. */
    }
  }
  function stop() {
    for (const [source, voice] of active) {
      try {
        source.stop();
      } catch {
        /* A finished source may already be stopped. */
      }
      release(source, voice);
    }
    active.clear();
    lastInteractionAt = -Infinity;
  }
  function retire(lane: Lane, at: number) {
    for (const [source, voice] of active) {
      if (voice.lane !== lane) continue;
      try {
        if (at <= voice.startsAt) {
          source.stop(at);
          release(source, voice);
          continue;
        }
        const envelope = voice.gain.gain;
        if (typeof envelope.cancelAndHoldAtTime === 'function') envelope.cancelAndHoldAtTime(at);
        else {
          envelope.cancelScheduledValues(at);
          envelope.setValueAtTime(Math.max(0.0001, envelope.value), at);
        }
        envelope.linearRampToValueAtTime(0, at + 0.012);
        source.stop(at + 0.015);
      } catch {
        release(source, voice);
      }
    }
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
        const at = context.currentTime;
        const lane: Lane = id === 'click' || id === 'navigate' ? 'ui' : 'game';
        // Native keyboard/touch double activation must not create a burst of overlapping taps.
        if (lane === 'ui' && at - lastInteractionAt < 0.06) return true;
        if (lane === 'ui') lastInteractionAt = at;
        retire(lane, at);
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
          const voice: Voice = { gain, lane, startsAt: start };
          active.set(source, voice);
          source.onended = () => {
            release(source, voice);
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

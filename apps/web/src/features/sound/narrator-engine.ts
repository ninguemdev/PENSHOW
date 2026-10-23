export interface NarratorEngine {
  unlock(): Promise<boolean>;
  configure(volume: number): void;
  play(
    data: ArrayBuffer,
    timing: { startsAt: number; endsAt: number; now(): number },
    ended: () => void,
  ): Promise<boolean>;
  stop(): void;
  dispose(): void;
}

/** Plays the same pre-rendered formant voice on every device; browser voices are never selected. */
export function createNarratorEngine(createContext = () => new AudioContext()): NarratorEngine {
  let context: AudioContext | undefined,
    master: GainNode | undefined,
    source: AudioBufferSourceNode | undefined;
  let volume = 0.6,
    generation = 0;
  function stop() {
    generation++;
    if (source) {
      source.onended = null;
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* Already stopped. */
      }
      source = undefined;
    }
  }
  return {
    async unlock() {
      try {
        if (!context || context.state === 'closed') {
          context = createContext();
          master = context.createGain();
          master.gain.value = volume ** 2;
          master.connect(context.destination);
        }
        await context.resume();
        return context.state === 'running';
      } catch {
        return false;
      }
    },
    configure(value) {
      volume = Math.min(1, Math.max(0, value));
      try {
        master?.gain.setValueAtTime(volume ** 2, context!.currentTime);
      } catch {
        /* Device unavailable. */
      }
      if (!volume) stop();
    },
    async play(data, timing, ended) {
      stop();
      const current = generation;
      if (!context || !master || context.state !== 'running' || !volume) return false;
      try {
        const buffer = await context.decodeAudioData(data);
        if (current !== generation || context.state !== 'running') return false;
        const now = timing.now(),
          offset = Math.max(0, (now - timing.startsAt) / 1000),
          delay = Math.max(0, (timing.startsAt - now) / 1000);
        const duration = Math.min(buffer.duration - offset, (timing.endsAt - now) / 1000 - delay);
        if (duration <= 0) return false;
        source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(master);
        const active = source;
        source.onended = () => {
          active.disconnect();
          if (source === active) {
            source = undefined;
            ended();
          }
        };
        source.start(context.currentTime + delay, offset, duration);
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
      context = undefined;
      master = undefined;
      if (previous && previous.state !== 'closed') void previous.close().catch(() => undefined);
    },
  };
}

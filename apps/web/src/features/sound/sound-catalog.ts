export type SoundId = 'start' | 'correct' | 'wrong' | 'explosion' | 'damage' | 'victory';

export interface SoundTone {
  frequency: number;
  endFrequency?: number;
  delay: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
}

const tone = (frequency: number, delay = 0, duration = 0.14): SoundTone => ({
  frequency,
  delay,
  duration,
  gain: 0.22,
  wave: 'sine',
});

/** Original short cues synthesized locally; no downloads, speech or continuous ticking. */
export const SOUND_CATALOG: Readonly<Record<SoundId, readonly SoundTone[]>> = {
  start: [tone(392), tone(523.25, 0.12, 0.2)],
  correct: [tone(659.25, 0, 0.1), tone(880, 0.09, 0.18)],
  wrong: [{ ...tone(246.94, 0, 0.22), endFrequency: 164.81, wave: 'triangle' }],
  explosion: [
    { ...tone(110, 0, 0.38), endFrequency: 35, wave: 'sawtooth', gain: 0.13 },
    { ...tone(73.42, 0.03, 0.32), endFrequency: 28, wave: 'triangle', gain: 0.2 },
  ],
  damage: [{ ...tone(220, 0, 0.19), endFrequency: 110, wave: 'triangle' }, tone(98, 0.16, 0.15)],
  victory: [
    tone(523.25, 0, 0.18),
    tone(659.25, 0.13, 0.18),
    tone(783.99, 0.26, 0.18),
    tone(1046.5, 0.39, 0.27),
  ],
};

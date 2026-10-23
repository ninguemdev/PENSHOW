export type SoundId =
  | 'click'
  | 'navigate'
  | 'question'
  | 'open'
  | 'confirm'
  | 'choice'
  | 'join'
  | 'leave'
  | 'results'
  | 'notice'
  | 'start'
  | 'correct'
  | 'wrong'
  | 'explosion'
  | 'damage'
  | 'victory';

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
  click: [{ ...tone(720, 0, 0.045), endFrequency: 580, gain: 0.1 }],
  navigate: [
    { ...tone(480, 0, 0.075), gain: 0.12 },
    { ...tone(720, 0.045, 0.08), gain: 0.12 },
  ],
  question: [
    { ...tone(520, 0, 0.08), gain: 0.14 },
    { ...tone(780, 0.065, 0.11), gain: 0.14 },
  ],
  open: [
    { ...tone(610, 0, 0.065), gain: 0.12 },
    { ...tone(915, 0.05, 0.075), gain: 0.12 },
  ],
  confirm: [{ ...tone(560, 0, 0.085), endFrequency: 700, gain: 0.12 }],
  choice: [
    { ...tone(460, 0, 0.065), gain: 0.12 },
    { ...tone(690, 0.05, 0.08), gain: 0.12 },
  ],
  join: [{ ...tone(540, 0, 0.11), endFrequency: 720, gain: 0.12 }],
  leave: [{ ...tone(540, 0, 0.11), endFrequency: 405, gain: 0.12 }],
  results: [
    { ...tone(600, 0, 0.1), gain: 0.14 },
    { ...tone(750, 0.065, 0.1), gain: 0.14 },
    { ...tone(900, 0.13, 0.12), gain: 0.14 },
  ],
  notice: [{ ...tone(330, 0, 0.14), endFrequency: 275, gain: 0.12, wave: 'triangle' }],
  start: [tone(392), tone(523.25, 0.12, 0.2)],
  correct: [tone(659.25, 0, 0.1), tone(880, 0.09, 0.18)],
  wrong: [{ ...tone(246.94, 0, 0.22), endFrequency: 164.81, wave: 'triangle' }],
  explosion: [
    { ...tone(110, 0, 0.3), endFrequency: 45, wave: 'triangle', gain: 0.16 },
    { ...tone(73.42, 0.025, 0.27), endFrequency: 35, wave: 'sine', gain: 0.17 },
  ],
  damage: [{ ...tone(220, 0, 0.19), endFrequency: 110, wave: 'triangle' }, tone(98, 0.16, 0.15)],
  victory: [
    tone(523.25, 0, 0.18),
    tone(659.25, 0.13, 0.18),
    tone(783.99, 0.26, 0.18),
    tone(1046.5, 0.39, 0.27),
  ],
};

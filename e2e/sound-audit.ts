import type { BrowserContext, Page } from '@playwright/test';

declare global {
  interface Window {
    penshowAudioAudit: {
      contexts: AudioContext[];
      starts: { frequency: number; at: number }[];
      ended: number;
    };
  }
}

/** Observe native Web Audio; no fake playback, game state or autoplay bypass. */
export async function observeAudio(context: BrowserContext) {
  await context.addInitScript(() => {
    const Original = window.AudioContext;
    const audit: Window['penshowAudioAudit'] = { contexts: [], starts: [], ended: 0 };
    window.penshowAudioAudit = audit;
    window.AudioContext = class extends Original {
      constructor() {
        super();
        audit.contexts.push(this);
      }
      override createOscillator() {
        const oscillator = super.createOscillator();
        let frequency = 0;
        const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, time) => {
          frequency = value;
          return set(value, time);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (at = 0) => {
          audit.starts.push({ frequency, at });
          start(at);
        };
        oscillator.addEventListener('ended', () => {
          audit.ended++;
        });
        return oscillator;
      }
    };
  });
}
export function audioState(page: Page) {
  return page.evaluate(() => ({
    states: window.penshowAudioAudit.contexts.map((context) => context.state),
    starts: window.penshowAudioAudit.starts,
    ended: window.penshowAudioAudit.ended,
  }));
}

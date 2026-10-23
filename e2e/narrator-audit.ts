import type { BrowserContext, Page } from '@playwright/test';

declare global {
  interface Window {
    penshowNarratorAudit: {
      starts: { offset: number; duration: number; bufferDuration: number; peak: number }[];
    };
  }
}
export async function observeNarrator(context: BrowserContext) {
  await context.addInitScript(() => {
    const Original = window.AudioContext;
    const audit: Window['penshowNarratorAudit'] = { starts: [] };
    window.penshowNarratorAudit = audit;
    window.AudioContext = class extends Original {
      override createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (when = 0, offset = 0, duration?) => {
          const samples = source.buffer?.getChannelData(0) ?? [];
          let peak = 0;
          for (const value of samples) peak = Math.max(peak, Math.abs(value));
          audit.starts.push({
            offset,
            duration: duration ?? 0,
            bufferDuration: source.buffer?.duration ?? 0,
            peak,
          });
          start(when, offset, duration);
        };
        return source;
      }
    };
  });
}
export function narratorAudio(page: Page) {
  return page.evaluate(() => window.penshowNarratorAudit.starts);
}

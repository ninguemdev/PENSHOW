import { writeFile } from 'node:fs/promises';
import { test, expect } from '../fixtures.ts';
import { soundEngineLibrary, waveFile } from '../sound-render.ts';
import { SOUND_CATALOG, type SoundId } from '../../apps/web/src/features/sound/sound-catalog.ts';

declare global {
  interface Window {
    PenshowSound: typeof import('../../apps/web/src/features/sound/sound-engine.ts');
  }
}

test('som: renderiza motor real, volume, silêncio e substituição sem sobreposição', async ({
  players,
}, info) => {
  const page = players[0].page;
  await page.goto('/');
  await page.addScriptTag({ content: await soundEngineLibrary() });
  const renderings = await page.evaluate(
    async (ids: SoundId[]) => {
      async function render(id: SoundId, volume: number, replace = false, mute = false) {
        const offline = new OfflineAudioContext(1, 44100 * 0.8, 44100);
        // Offline rendering has no playback permission/state. Only its real audio graph is adapted.
        const engine = window.PenshowSound.createSoundEngine(() => ({
          get currentTime() {
            return offline.currentTime;
          },
          state: 'running',
          destination: offline.destination,
          createGain: () => offline.createGain(),
          createOscillator: () => offline.createOscillator(),
          resume: async () => undefined,
          close: async () => undefined,
        }));
        engine.configure(volume, false);
        await engine.unlock();
        if (replace) engine.play('victory');
        const played = engine.play(id);
        if (mute) engine.configure(volume, true);
        const rendered = await offline.startRendering();
        engine.dispose();
        const samples = Array.from(rendered.getChannelData(0));
        const peak = Math.max(...samples.map(Math.abs));
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
        );
        const last = samples.findLastIndex((sample) => Math.abs(sample) > 0.000001) / 44100;
        return { id, played, samples, peak, rms, last };
      }
      const cues = [];
      for (const id of ids) cues.push(await render(id, 1));
      return {
        cues,
        quiet: await render('start', 0.4),
        zero: await render('start', 0),
        muted: await render('victory', 1, false, true),
        replacement: await render('wrong', 1, true),
      };
    },
    Object.keys(SOUND_CATALOG) as SoundId[],
  );
  for (const cue of renderings.cues) {
    expect(cue.played).toBe(true);
    expect(cue.peak).toBeGreaterThan(0.01);
    expect(cue.peak).toBeLessThan(0.5);
    expect(cue.last).toBeLessThanOrEqual(0.7);
    expect(cue.samples.slice(-1000).every((sample) => sample === 0)).toBe(true);
  }
  const start = renderings.cues.find((cue) => cue.id === 'start')!;
  const wrong = renderings.cues.find((cue) => cue.id === 'wrong')!;
  expect(renderings.quiet.rms / start.rms).toBeCloseTo(0.16, 3);
  expect(renderings.zero.played).toBe(false);
  expect(renderings.zero.peak).toBe(0);
  expect(renderings.muted.peak).toBe(0);
  expect(renderings.replacement.rms).toBeCloseTo(wrong.rms, 6);
  expect(renderings.replacement.last).toBeCloseTo(wrong.last, 3);
  const preview = renderings.cues.flatMap((cue) => [
    ...cue.samples,
    ...Array<number>(11025).fill(0),
  ]);
  const path = info.outputPath('penshow-sons-inicio-acerto-erro-explosao-dano-vitoria.wav');
  await writeFile(path, waveFile(preview, 44100));
  await info.attach('previa-dos-seis-sons', { path, contentType: 'audio/wav' });
  await info.attach('medidas-audio.json', {
    body: JSON.stringify(
      renderings.cues.map(({ id, peak, rms, last }) => ({ id, peak, rms, last })),
      null,
      2,
    ),
    contentType: 'application/json',
  });
});

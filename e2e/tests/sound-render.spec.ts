import { mkdir, writeFile } from 'node:fs/promises';
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
      async function render(
        id: SoundId,
        volume: number,
        replace = false,
        mute = false,
        clicks = 0,
        replaceDuringPlayback = false,
      ) {
        const offline = new OfflineAudioContext(1, 44100 * 0.8, 44100);
        let sources = 0;
        // Offline rendering has no playback permission/state. Only its real audio graph is adapted.
        const engine = window.PenshowSound.createSoundEngine(() => ({
          get currentTime() {
            return offline.currentTime;
          },
          state: 'running',
          destination: offline.destination,
          createGain: () => offline.createGain(),
          createOscillator: () => {
            sources++;
            return offline.createOscillator();
          },
          resume: async () => undefined,
          close: async () => undefined,
        }));
        engine.configure(volume, false);
        await engine.unlock();
        if (replace) engine.play('victory');
        const played = engine.play(id);
        for (let click = 0; click < clicks; click++) engine.play('click');
        if (mute) engine.configure(volume, true);
        const replacement = replaceDuringPlayback
          ? offline.suspend(0.08).then(async () => {
              engine.play('wrong');
              await offline.resume();
            })
          : Promise.resolve();
        const rendered = await offline.startRendering();
        await replacement;
        engine.dispose();
        const samples = Array.from(rendered.getChannelData(0));
        const peak = Math.max(...samples.map(Math.abs));
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
        );
        const last = samples.findLastIndex((sample) => Math.abs(sample) > 0.000001) / 44100;
        let maxStep = 0;
        for (let sample = 1; sample < samples.length; sample++)
          maxStep = Math.max(maxStep, Math.abs(samples[sample]! - samples[sample - 1]!));
        return { id, played, samples, peak, rms, last, maxStep, sources };
      }
      const cues = [];
      for (const id of ids) cues.push(await render(id, 1));
      return {
        cues,
        quiet: await render('start', 0.4),
        zero: await render('start', 0),
        muted: await render('victory', 1, false, true),
        replacement: await render('wrong', 1, true),
        clickDuringVictory: await render('victory', 1, false, false, 20),
        fadeDuringVictory: await render('victory', 1, false, false, 0, true),
      };
    },
    Object.keys(SOUND_CATALOG) as SoundId[],
  );
  for (const cue of renderings.cues) {
    expect(cue.played).toBe(true);
    expect(cue.peak).toBeGreaterThan(0.01);
    expect(cue.peak).toBeLessThan(0.5);
    expect(cue.last).toBeLessThanOrEqual(0.7);
    expect(cue.maxStep).toBeLessThan(0.045);
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
  const victory = renderings.cues.find((cue) => cue.id === 'victory')!;
  expect(renderings.clickDuringVictory.sources).toBe(victory.sources + 1);
  expect(renderings.clickDuringVictory.samples.slice(8820)).toEqual(victory.samples.slice(8820));
  expect(renderings.fadeDuringVictory.maxStep).toBeLessThan(0.045);
  expect(renderings.fadeDuringVictory.sources).toBe(victory.sources + 1);
  expect(renderings.fadeDuringVictory.last).toBeGreaterThan(0.28);
  expect(renderings.fadeDuringVictory.last).toBeLessThan(0.34);
  const preview = renderings.cues.flatMap((cue) => [
    ...cue.samples,
    ...Array<number>(11025).fill(0),
  ]);
  const path = info.outputPath('penshow-efeitos-simples.wav');
  await writeFile(path, waveFile(preview, 44100));
  await info.attach('previa-dos-efeitos', { path, contentType: 'audio/wav' });
  const directory = new URL('../../data/audio-previews/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('penshow-efeitos-simples.wav', directory), waveFile(preview, 44100));
  for (const cue of renderings.cues)
    await writeFile(new URL(`${cue.id}.wav`, directory), waveFile(cue.samples, 44100));
  await writeFile(
    new URL('ordem-e-medidas.json', directory),
    JSON.stringify(
      renderings.cues.map(({ id, peak, rms, last, maxStep }) => ({ id, peak, rms, last, maxStep })),
      null,
      2,
    ) + '\n',
  );
  await info.attach('medidas-audio.json', {
    body: JSON.stringify(
      renderings.cues.map(({ id, peak, rms, last }) => ({ id, peak, rms, last })),
      null,
      2,
    ),
    contentType: 'application/json',
  });
});

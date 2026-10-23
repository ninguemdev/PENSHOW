import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { LocalNarrationRepository, NARRATION_ROOT } from './local-narration.repository.js';
import { LocalQuestionRepository } from './local-question.repository.js';

it('valida uma gravação real e recusa áudio corrompido ou narração de uma versão antiga do texto', async () => {
  const catalog = new LocalQuestionRepository();
  await catalog.load();
  const question = catalog.list()[0]!;
  const manifest = JSON.parse(await readFile(new URL('manifest.json', NARRATION_ROOT), 'utf8'));
  const entry = manifest.entries.find(
    (entry: { questionId: string }) => entry.questionId === question.id,
  );
  const root = await mkdtemp(join(tmpdir(), 'penshow-narration-'));
  const url = pathToFileURL(root + '/');
  try {
    const audio = await readFile(new URL(`${entry.fingerprint}.wav`, NARRATION_ROOT));
    await writeFile(new URL(`${entry.fingerprint}.wav`, url), audio);
    await writeFile(
      new URL('manifest.json', url),
      JSON.stringify({ version: 1, voice: manifest.voice, entries: [entry] }),
    );
    const repository = new LocalNarrationRepository(url);
    await repository.load([question]);
    expect(repository.duration(question.id)).toBe(entry.durationMs);
    expect(await repository.audio(question.id)).toEqual(audio);
    await expect(repository.load([{ ...question, prompt: 'Enunciado alterado?' }])).rejects.toThrow(
      'ausente ou desatualizada',
    );
    expect(repository.duration(question.id)).toBeUndefined();
    audio[50] = (audio[50]! + 1) % 256;
    await writeFile(new URL(`${entry.fingerprint}.wav`, url), audio);
    await expect(repository.load([question])).rejects.toThrow('ausente ou desatualizada');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

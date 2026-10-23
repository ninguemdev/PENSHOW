import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { ApprovedQuestion } from '../modules/questions/question.js';

export const NARRATION_ROOT = new URL('../../../../data/narration/generated/', import.meta.url);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const entrySchema = z.strictObject({
  questionId: z.string().min(1),
  fingerprint: hash,
  textHash: hash,
  durationMs: z.number().int().min(1).max(120_000),
  sha256: hash,
});
const manifestSchema = z.strictObject({
  version: z.literal(1),
  voice: z.literal('robot-pt-br-v1'),
  entries: z.array(entrySchema).max(100_000),
});
type Entry = z.infer<typeof entrySchema>;
export class NarrationLoadError extends Error {
  constructor() {
    super('Narração robótica ausente ou desatualizada. Execute pnpm narrations:build.');
    this.name = 'NarrationLoadError';
  }
}
export class LocalNarrationRepository {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly root = NARRATION_ROOT) {}
  async load(questions: readonly ApprovedQuestion[]) {
    this.entries.clear();
    try {
      const manifest = manifestSchema.parse(
        JSON.parse(await readFile(new URL('manifest.json', this.root), 'utf8')),
      );
      if (manifest.entries.length !== questions.length) throw new Error();
      const entries = new Map(manifest.entries.map((entry) => [entry.questionId, entry]));
      if (entries.size !== questions.length) throw new Error();
      for (const question of questions) {
        const entry = entries.get(question.id);
        if (!entry || entry.textHash !== createHash('sha256').update(question.prompt).digest('hex'))
          throw new Error();
        const audio = await readFile(new URL(`${entry.fingerprint}.wav`, this.root));
        if (
          audio.length < 46 ||
          audio.toString('ascii', 0, 4) !== 'RIFF' ||
          audio.toString('ascii', 8, 12) !== 'WAVE' ||
          audio.readUInt32LE(24) !== 22050 ||
          Math.ceil(((audio.length - 44) * 1000) / 44100) !== entry.durationMs ||
          createHash('sha256').update(audio).digest('hex') !== entry.sha256
        )
          throw new Error();
      }
      this.entries.clear();
      for (const [id, entry] of entries) this.entries.set(id, entry);
    } catch {
      throw new NarrationLoadError();
    }
  }
  duration(id: string) {
    return this.entries.get(id)?.durationMs;
  }
  async audio(id: string) {
    const entry = this.entries.get(id);
    return entry ? readFile(new URL(`${entry.fingerprint}.wav`, this.root)) : null;
  }
  preview() {
    return readFile(new URL('preview.wav', this.root));
  }
}

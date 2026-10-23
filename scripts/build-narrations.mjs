import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRobotVoice, promptHash, ROBOT_VOICE } from './lib/robot-voice.mjs';

const root = new URL('../data/narration/generated/', import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL('../data/questions/published/catalog.json', import.meta.url), 'utf8'),
);
await mkdir(root, { recursive: true });
let previous;
try {
  previous = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
} catch {
  /* First build. */
}
let synthesize;
const entries = [];
for (const question of catalog.questions) {
  const fingerprint = promptHash(question.prompt);
  let entry = previous?.entries?.find(
    (entry) => entry.questionId === question.id && entry.fingerprint === fingerprint,
  );
  if (entry) {
    try {
      const data = await readFile(new URL(`${fingerprint}.wav`, root));
      if (createHash('sha256').update(data).digest('hex') !== entry.sha256) entry = undefined;
    } catch {
      entry = undefined;
    }
  }
  if (!entry) {
    synthesize ??= await createRobotVoice();
    const { wav, durationMs } = synthesize(question.prompt);
    if (durationMs > 120_000) throw new Error('Enunciado excede o limite de narração.');
    await writeFile(new URL(`${fingerprint}.wav`, root), wav);
    entry = {
      questionId: question.id,
      fingerprint,
      durationMs,
      sha256: createHash('sha256').update(wav).digest('hex'),
    };
  }
  entries.push({ ...entry, textHash: createHash('sha256').update(question.prompt).digest('hex') });
}
await writeFile(
  new URL('manifest.json', root),
  JSON.stringify({ version: 1, voice: ROBOT_VOICE.id, entries }, null, 2) + '\n',
);
synthesize ??= await createRobotVoice();
await writeFile(
  new URL('preview.wav', root),
  synthesize(
    'Olá, jogadores. Eu sou o narrador robótico do PENSHOW. Atenção. Qual planeta é conhecido como planeta vermelho?',
  ).wav,
);
console.log(
  `Narração robótica pt-BR: ${entries.length} enunciados preparados, sem alternativas ou gabaritos.`,
);

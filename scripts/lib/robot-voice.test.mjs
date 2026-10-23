import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRobotVoice, promptHash } from './robot-voice.mjs';

test('sintetiza português com áudio PCM real, duração medida e identidade sensível ao enunciado', async () => {
  const speak = await createRobotVoice();
  const { wav, durationMs } = speak('Olá. Qual é a capital do Brasil?');
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 22050);
  assert.equal(durationMs, Math.ceil(((wav.length - 44) * 1000) / 44100));
  assert.ok(durationMs > 1000 && durationMs < 30_000);
  let peak = 0;
  for (let index = 44; index < wav.length; index += 2)
    peak = Math.max(peak, Math.abs(wav.readInt16LE(index)));
  assert.ok(peak > 100 && peak < 32767);
  assert.notEqual(
    promptHash('Qual é a capital do Brasil?'),
    promptHash('Qual é a capital do Chile?'),
  );
});

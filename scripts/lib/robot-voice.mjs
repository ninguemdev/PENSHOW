import { createHash } from 'node:crypto';

export const ROBOT_VOICE = Object.freeze({
  id: 'robot-pt-br-v1',
  voice: 'pt-br',
  rate: 165,
  pitch: 35,
  range: 0,
});
export const promptHash = (prompt) =>
  createHash('sha256')
    .update(JSON.stringify([ROBOT_VOICE, prompt]))
    .digest('hex');

export async function createRobotVoice() {
  const { default: initialize } = await import('@echogarden/espeak-ng-emscripten');
  const module = await initialize();
  const engine = new module.eSpeakNGWorker();
  engine.set_voice(ROBOT_VOICE.voice);
  engine.set_rate(ROBOT_VOICE.rate);
  engine.set_pitch(ROBOT_VOICE.pitch);
  engine.set_range(ROBOT_VOICE.range);
  if (
    engine.get_rate() !== ROBOT_VOICE.rate ||
    engine.get_pitch() !== ROBOT_VOICE.pitch ||
    engine.get_range() !== ROBOT_VOICE.range
  )
    throw new Error('Configuração da voz robótica incompatível com o sintetizador.');
  const sampleRate = engine.get_samplerate();
  return (prompt) => {
    const chunks = [];
    const text = prompt
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('[[', ' ')
      .replaceAll(']]', ' ');
    engine.synthesize(text, (samples) => {
      if (samples?.length) chunks.push(Int16Array.from(samples));
    });
    const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (!count || sampleRate !== 22050) throw new Error('Síntese robótica indisponível.');
    const wav = Buffer.alloc(44 + count * 2);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(count * 2, 40);
    let offset = 44;
    for (const chunk of chunks)
      for (const sample of chunk) {
        wav.writeInt16LE(Math.round(sample * 0.7), offset);
        offset += 2;
      }
    return { wav, durationMs: Math.ceil((count * 1000) / sampleRate) };
  };
}

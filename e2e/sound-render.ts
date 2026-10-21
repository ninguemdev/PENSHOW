import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/** Bundle the production engine into test memory; nothing is published or written to web/dist. */
export async function soundEngineLibrary() {
  const built = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      target: 'es2022',
      lib: {
        entry: fileURLToPath(
          new URL('../apps/web/src/features/sound/sound-engine.ts', import.meta.url),
        ),
        name: 'PenshowSound',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(built) ? built[0] : built;
  if (!output || !('output' in output))
    throw new Error('Biblioteca de teste de áudio não compilada.');
  const chunk = output.output.find((item) => item.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Código de áudio ausente.');
  return chunk.code;
}

export function waveFile(samples: readonly number[], sampleRate: number) {
  const wave = Buffer.alloc(44 + samples.length * 2);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(samples.length * 2, 40);
  for (const [index, sample] of samples.entries())
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  return wave;
}

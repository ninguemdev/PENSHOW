import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT } from './lib/questions.mjs';
import { publishQuestionCatalog } from './lib/question-publication.mjs';

try {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--check') || args.length > 1)
    throw new Error('Use questions:publish ou questions:check, sem outros argumentos.');
  const result = await publishQuestionCatalog(fileURLToPath(PROJECT_ROOT), {
    check: args.includes('--check'),
  });
  if (!result.ok) {
    console.error(result.report.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          approvedCount: result.report.approvedCount,
          candidatesExcluded: result.report.candidates.count,
          availability: result.report.availability,
          result: 'Catálogo privado verificado. Aprovação factual é uma decisão editorial.',
        },
        null,
        2,
      ),
    );
  }
} catch {
  console.error(
    'Falha na publicação editorial. Confira entradas, manifesto, licenças e permissão dos arquivos.',
  );
  process.exitCode = 1;
}

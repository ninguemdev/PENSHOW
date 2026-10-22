import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileQuestionCatalog } from './lib/question-publication.mjs';
import { auditEditorialBatches } from './lib/editorial-batches.mjs';
import { jsonFiles, loadQuestions, readJson, PROJECT_ROOT } from './lib/questions.mjs';
import { stableJson } from '../apps/server/src/modules/questions/catalog-format.ts';
import { editorialSlugSchema } from '../apps/server/src/modules/questions/editorial-question.schema.ts';

const args = process.argv.slice(2);
if (
  args.some((arg) => arg !== '--check' && !arg.startsWith('--batch=')) ||
  new Set(args).size !== args.length ||
  args.filter((arg) => arg.startsWith('--batch=')).length > 1
)
  throw new Error('Use questions:audit [--check] [--batch=t33-001].');
const batchId = args.find((arg) => arg.startsWith('--batch='))?.slice('--batch='.length);
if (batchId !== undefined && !editorialSlugSchema.safeParse(batchId).success)
  throw new Error('ID de lote inválido.');
const root = fileURLToPath(PROJECT_ROOT);
const compilation = await compileQuestionCatalog(root);
if (!compilation.catalog) throw new Error(compilation.report.errors.join('\n'));
const published = await readJson(join(root, 'data/questions/published/catalog.json'), null);
if (stableJson(published) !== stableJson(compilation.catalog))
  throw new Error('Publicação desatualizada; execute questions:publish.');
const batchFiles = await jsonFiles(join(root, 'data/editorial-batches'));
const batches = await Promise.all(batchFiles.map((file) => readJson(file, null)));
const report = auditEditorialBatches({
  baseline: await readJson(join(root, 'data/editorial-baselines/t27-catalog.json'), null),
  candidates: await loadQuestions(join(root, 'data/questions/candidates')),
  reviewed: await loadQuestions(join(root, 'data/questions/reviewed')),
  batches,
  catalog: published,
});
const selected = batchId === undefined ? undefined : report.batches.find((b) => b.id === batchId);
if (batchId !== undefined && !selected) throw new Error('Lote não encontrado.');
// Selecting a batch prints its receipt but still checks shared history and cross-batch collisions.
const target = join(root, 'data/publication-reports/t33-expansion.json');
if (args.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== stableJson(report))
    throw new Error('Auditoria desatualizada; execute questions:audit.');
} else if (!selected) await writeFile(target, stableJson(report));
console.log(
  JSON.stringify(
    selected ?? {
      approved: report.approved,
      remaining: report.remaining,
      rejected: report.rejected,
      candidateBacklog: report.candidateBacklog.count,
      minimumAdditionalCandidates: report.candidateBacklog.minimumAdditionalCandidates,
    },
    null,
    2,
  ),
);

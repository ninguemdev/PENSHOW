import { readFile, writeFile } from 'node:fs/promises';
import { LocalQuestionRepository } from '../apps/server/src/platform/local-question.repository.js';
import {
  publishedCatalogSchema,
  stableJson,
} from '../apps/server/src/modules/questions/catalog-format.js';
import { PROTOTYPE_PARAMETERS } from '../apps/server/src/modules/scoring/match-rules.js';
import {
  categoryConfigurations,
  simulateQuestionStock,
  STOCK_CHOICES,
  STOCK_SEEDS,
} from './lib/question-stock.js';

const root = new URL('../', import.meta.url);
const target = new URL('data/publication-reports/t27-stock.json', root);
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1)
  throw new Error('Use questions:simulate [--check].');
// Reproduce the dated T27 experiment against its original, private 300-question snapshot.
const file = new URL('data/editorial-baselines/t27-catalog.json', root);
const catalog = publishedCatalogSchema.parse(JSON.parse(await readFile(file, 'utf8')));
const repository = new LocalQuestionRepository(file);
await repository.load();
const runs = Array.from({ length: 11 }, (_, i) => i + 2).flatMap((count) =>
  STOCK_SEEDS.flatMap((seed) =>
    STOCK_CHOICES.map((choice) => simulateQuestionStock(repository, count, seed, choice)),
  ),
);
const report = {
  schemaVersion: 1,
  task: 'T27',
  scope:
    'Orçamento de conteúdo das cinco fases experimentais e final; não executa pontuação, vidas, rede ou regras de produto ainda pendentes.',
  catalogSha256: catalog.manifest.contentSha256,
  questionCount: catalog.manifest.questionCount,
  availability: catalog.manifest.availability,
  parameters: PROTOTYPE_PARAMETERS,
  runs,
  categoryConfigurations: categoryConfigurations(repository),
};
const bytes = stableJson(report);
if (args.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== bytes)
    throw new Error('Relatório de estoque divergente; execute questions:simulate.');
} else await writeFile(target, bytes);
console.log(
  JSON.stringify(
    {
      simulations: runs.length,
      playerCounts: '2–12',
      categoryConfigurations: 693,
      repeatedQuestions: 0,
      report: 'data/publication-reports/t27-stock.json',
    },
    null,
    2,
  ),
);

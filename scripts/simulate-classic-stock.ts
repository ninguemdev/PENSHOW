import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { LocalQuestionRepository } from '../apps/server/src/platform/local-question.repository.js';
import {
  publishedCatalogSchema,
  stableJson,
} from '../apps/server/src/modules/questions/catalog-format.js';
import { QuestionSelection } from '../apps/server/src/modules/questions/question-selection.js';
import { classicPlanMatrix } from './lib/classic-plan-matrix.js';
import { simulateQuestionStock, stockDependencies, stockOptions } from './lib/question-stock.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1)
  throw new Error('Use questions:simulate:classic [--check].');
const file = new URL('../data/questions/published/catalog.json', import.meta.url);
const target = new URL('../data/publication-reports/t36-stock.json', import.meta.url);
const catalog = publishedCatalogSchema.parse(JSON.parse(await readFile(file, 'utf8')));
const repository = new LocalQuestionRepository(file);
await repository.load();
const plans = classicPlanMatrix().map((plan) => plan.rounds.map((round) => round.mode));
assert.equal(new Set(plans.map((modes) => modes.join(','))).size, 120);
const playerCounts = [2, 4, 8, 12];
const runs = playerCounts.flatMap((count) =>
  plans.map((modes, index) => ({
    modes,
    ...simulateQuestionStock(repository, count, 36 + index, 'timeout', modes),
  })),
);
const categories = [...new Set(repository.list().map((q) => q.category))].sort();
// Eligibility is order-independent; exhaust all five sets and all nonempty theme subsets.
const sets = [...new Map(plans.map((modes) => [modes.toSorted().join(','), modes])).values()];
const categoryConfigurations = playerCounts.flatMap((playerCount) =>
  sets.map((modes) => ({
    playerCount,
    modes,
    configurations: Array.from({ length: 63 }, (_, index) => {
      const enabledCategories = categories.filter((_, bit) => ((index + 1) & (1 << bit)) !== 0);
      const result = QuestionSelection.create(repository, stockDependencies(36), {
        ...stockOptions(playerCount, enabledCategories),
        format: 'classic',
        modes,
      });
      if (enabledCategories.length >= 3) assert.equal(result.status, 'ready');
      if (enabledCategories.length === 1) assert.equal(result.status, 'blocked');
      return { enabledCategories, status: result.status };
    }),
  })),
);
const report = {
  schemaVersion: 1,
  task: 'T36',
  scope:
    'Estoque real para as 120 ordens de quatro modalidades e a final na quinta fase; políticas de produto continuam em consulta.',
  catalogSha256: catalog.manifest.contentSha256,
  runs,
  categoryConfigurations,
};
const bytes = stableJson(report);
if (args.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== bytes) throw new Error('Relatório T36 divergente.');
} else await writeFile(target, bytes);
console.log(
  JSON.stringify(
    {
      sequences: 120,
      simulations: runs.length,
      categoryConfigurations: categoryConfigurations.length * 63,
      repeatedQuestions: 0,
      protectedFinalQuestions: 50,
      report: 'data/publication-reports/t36-stock.json',
    },
    null,
    2,
  ),
);

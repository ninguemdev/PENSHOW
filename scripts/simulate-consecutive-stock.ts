import { readFile, writeFile } from 'node:fs/promises';
import {
  publishedCatalogSchema,
  stableJson,
} from '../apps/server/src/modules/questions/catalog-format.js';
import { classicPlanMatrix } from './lib/classic-plan-matrix.js';
import { simulateConsecutiveStock } from './lib/consecutive-stock.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1)
  throw new Error('Use questions:capacity [--check].');
const root = new URL('../', import.meta.url);
const catalog = publishedCatalogSchema.parse(
  JSON.parse(await readFile(new URL('data/questions/published/catalog.json', root), 'utf8')),
);
const categories = Object.keys(catalog.manifest.availability).sort();
const plans = [
  ...new Map(
    classicPlanMatrix().map((plan) => {
      const modes = plan.rounds.map((round) => round.mode);
      return [modes.toSorted().join(','), modes] as const;
    }),
  ).values(),
];
const selections = [...categories.map((c) => [c]), categories];
const runs = [2, 4, 8, 12].flatMap((playerCount) =>
  [33, 20261022].flatMap((seed) =>
    selections.flatMap((enabled) =>
      plans.map((modes) =>
        simulateConsecutiveStock(catalog.questions, {
          playerCount,
          seed,
          categories: enabled,
          modes,
        }),
      ),
    ),
  ),
);
const report = {
  schemaVersion: 1,
  task: 'T33',
  catalogSha256: catalog.manifest.contentSha256,
  scope:
    'Seleção oficial com quatro modalidades e exatamente 50 perguntas na final simulada. Cada percurso exclui o que já consumiu entre partidas; não mede duração, vidas nem pontuação e não garante a duração de uma final real. Revanche do produto continua com garantia de ineditismo somente por partida.',
  availability: catalog.manifest.availability,
  runs,
};
const file = new URL('data/publication-reports/t33-consecutive-stock.json', root);
if (args.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== stableJson(report))
    throw new Error('Capacidade divergente; execute questions:capacity.');
} else await writeFile(file, stableJson(report));
console.log(
  JSON.stringify(
    {
      simulations: runs.length,
      approved: catalog.questions.length,
      report: 'data/publication-reports/t33-consecutive-stock.json',
    },
    null,
    2,
  ),
);

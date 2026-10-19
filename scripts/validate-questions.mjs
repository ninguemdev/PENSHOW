import { basename, dirname, join } from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  PROJECT_ROOT,
  jsonFiles,
  questionKey,
  readJson,
  validateQuestion,
} from './lib/questions.mjs';
import { compileQuestionCatalog } from './lib/question-publication.mjs';

const root = fileURLToPath(PROJECT_ROOT);
const seenIds = new Set();
const seenPrompts = new Set();
const totals = {};
const categoryTotals = {};
const sourceLicenses = new Map();
const failures = [];
let count = 0;
for (const file of await jsonFiles(join(root, 'data/questions/candidates'))) {
  const records = await readJson(file, null);
  if (!Array.isArray(records)) {
    failures.push(`${file}: lista inválida`);
    continue;
  }
  for (const question of records) {
    const errors = validateQuestion(question);
    if (errors.length) {
      failures.push(`${file}: ${question?.id}: ${errors.join('; ')}`);
      continue;
    }
    if (seenIds.has(question.id)) failures.push(`ID repetido: ${question.id}`);
    seenIds.add(question.id);
    const key = questionKey(question);
    if (seenPrompts.has(key)) failures.push(`Enunciado repetido: ${question.id}`);
    seenPrompts.add(key);
    const group = `${question.source.id}/${question.locale}/${question.status}`;
    const licenses = sourceLicenses.get(question.source.id) ?? new Set();
    licenses.add(question.source.license);
    sourceLicenses.set(question.source.id, licenses);
    totals[group] = (totals[group] ?? 0) + 1;
    const categoryGroup = `${question.source.id}/${question.category}`;
    categoryTotals[categoryGroup] = (categoryTotals[categoryGroup] ?? 0) + 1;
    if (
      basename(file, '.json') !== question.category ||
      basename(dirname(file)) !== question.source.id
    ) {
      failures.push(`Categoria ou fonte não corresponde ao arquivo: ${question.id}`);
    }
    count++;
  }
}
const manifest = await readJson(join(root, 'data/sources.json'), { sources: [] });
const sourceIds = new Set(manifest.sources.map((source) => source.id));
for (const group of Object.keys(totals)) {
  if (!sourceIds.has(group.split('/')[0])) failures.push(`Fonte ausente no manifesto: ${group}`);
}
for (const source of manifest.sources) {
  for (const license of sourceLicenses.get(source.id) ?? []) {
    if (license !== source.license) failures.push(`Licença divergente do manifesto: ${source.id}`);
  }
  const actual = Object.entries(totals)
    .filter(([key]) => key.startsWith(`${source.id}/`))
    .reduce((sum, [, value]) => sum + value, 0);
  if (actual !== source.importedCount)
    failures.push(`Manifesto divergente para ${source.id}: ${source.importedCount} / ${actual}`);
  const actualCategories = Object.fromEntries(
    Object.entries(categoryTotals)
      .filter(([key]) => key.startsWith(`${source.id}/`))
      .map(([key, value]) => [key.slice(source.id.length + 1), value]),
  );
  const declaredCategories = source.categories ?? {};
  for (const category of new Set([
    ...Object.keys(actualCategories),
    ...Object.keys(declaredCategories),
  ])) {
    if (actualCategories[category] !== declaredCategories[category])
      failures.push(`Total por categoria divergente: ${source.id}/${category}`);
  }
  try {
    if (typeof source.licenseFile !== 'string') throw new Error('Licença não declarada');
    await access(join(root, source.licenseFile));
  } catch {
    failures.push(`Arquivo de licença ausente: ${source.id}`);
  }
}
if (count === 0) failures.push('Nenhuma pergunta encontrada.');
const publication = await compileQuestionCatalog(root);
failures.push(...publication.report.errors);
for (const invalid of publication.report.invalid)
  failures.push(`${invalid.file}#${invalid.index}: ${invalid.errors.join('; ')}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        count,
        totals,
        reviewedCount: publication.report.reviewedCount,
        approvedCount: publication.report.approvedCount,
        availability: publication.report.availability,
        result: 'Estrutura válida; revisão factual continua necessária.',
      },
      null,
      2,
    ),
  );
}

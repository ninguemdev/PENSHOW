import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROJECT_ROOT, loadQuestions, normalizedPrompt, parseQuestionados,
  questionId, questionKey, updateSource, validateQuestion, writeJson,
} from './lib/questions.mjs';

const root = fileURLToPath(PROJECT_ROOT);
const sourceId = 'questionados';
const commit = 'dc99d66a70f7e9f8039c0833b9aa9211907ee719';
const base = `https://raw.githubusercontent.com/AdaiasMagdiel/questionados/${commit}`;
const categories = {
  art: 'arts-literature', geography: 'geography', history: 'history',
  pop: 'pop-culture', science: 'science-nature', sports: 'sports',
};
const existing = await loadQuestions(join(root, 'data/questions/candidates'));
const seen = new Set(existing.filter((q) => q.source.id !== sourceId).map(questionKey));
const report = { sourceId, commit, rawCount: 0, duplicates: [], invalid: [] };
const counts = {};

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

// Download and parse every source before replacing any local category.
const downloaded = [];
for (const [filename, category] of Object.entries(categories)) {
  const url = `${base}/assets/data/${filename}.js`;
  downloaded.push({ category, url, records: parseQuestionados(await download(url)) });
}
const license = await download(`${base}/LICENSE`);
const outputs = [];
for (const { category, url, records } of downloaded) {
  const output = [];
  for (const [recordIndex, raw] of records.entries()) {
    report.rawCount++;
    const options = Array.isArray(raw?.choices)
      ? raw.choices.map((text, index) => ({ id: `option-${index}`, text })) : [];
    const question = {
      id: questionId(sourceId, category, typeof raw?.question === 'string' ? raw.question : ''),
      category, locale: 'pt-BR', type: 'multiple', prompt: raw?.question,
      options, correctOptionId: Number.isInteger(raw?.answer) ? options[raw.answer]?.id : null,
      difficulty: 'unrated', status: 'needs-review',
      source: { id: sourceId, url, recordIndex, license: 'MIT' },
    };
    const errors = validateQuestion(question);
    if (errors.length) { report.invalid.push({ category, recordIndex, errors, record: raw }); continue; }
    const key = questionKey(question);
    if (seen.has(key)) { report.duplicates.push({ category, recordIndex, prompt: raw.question }); continue; }
    if (!normalizedPrompt(question.prompt)) throw new Error('Enunciado sem texto pesquisável.');
    seen.add(key);
    output.push(question);
  }
  counts[category] = output.length;
  outputs.push({ category, output });
}

for (const { category, output } of outputs) {
  await writeJson(join(root, 'data/questions/candidates', sourceId, `${category}.json`), output);
}
await mkdir(join(root, 'data/licenses'), { recursive: true });
await writeFile(join(root, 'data/licenses/questionados.txt'), license, 'utf8');
await writeJson(join(root, 'data/import-reports/questionados.json'), report);
await updateSource(root, {
  id: sourceId, title: 'Questionados', url: 'https://github.com/AdaiasMagdiel/questionados',
  revision: commit, license: 'MIT', licenseFile: 'data/licenses/questionados.txt',
  locale: 'pt-BR', status: 'needs-review', rawCount: report.rawCount,
  importedCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
  invalidCount: report.invalid.length, duplicateCount: report.duplicates.length,
  categories: counts,
});
console.log(JSON.stringify({ sourceId, raw: report.rawCount, imported: counts,
  invalid: report.invalid.length, duplicates: report.duplicates.length }));

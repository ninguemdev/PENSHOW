import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROJECT_ROOT,
  loadQuestions,
  questionId,
  questionKey,
  readJson,
  updateSource,
  validateQuestion,
  writeJson,
} from './lib/questions.mjs';

const root = fileURLToPath(PROJECT_ROOT);
const amountArgument = process.argv.slice(2).find((argument) => argument.startsWith('--amount='));
const target = amountArgument ? Number(amountArgument.slice('--amount='.length)) : 1000;
if (!Number.isInteger(target) || target < 1 || target > 10_000)
  throw new Error('Use --amount=1 até --amount=10000.');
const sourceId = 'opentdb';
const directory = join(root, 'data/questions/candidates', sourceId);
const existing = await loadQuestions(join(root, 'data/questions/candidates'));
const seen = new Set(existing.map(questionKey));
const imported = existing.filter((q) => q.source.id === sourceId);
const groups = new Map();
for (const question of imported) {
  if (!groups.has(question.category)) groups.set(question.category, []);
  groups.get(question.category).push(question);
}
const reportPath = join(root, 'data/import-reports/opentdb.json');
const report = await readJson(reportPath, {
  sourceId,
  receivedCount: 0,
  duplicateCount: 0,
  invalid: [],
});
const categoryMap = {
  'General Knowledge': 'general-knowledge',
  'Entertainment: Books': 'arts-literature',
  'Entertainment: Film': 'film',
  'Entertainment: Music': 'music',
  'Entertainment: Musicals & Theatres': 'theatre',
  'Entertainment: Television': 'television',
  'Entertainment: Video Games': 'video-games',
  'Entertainment: Board Games': 'board-games',
  'Science & Nature': 'science-nature',
  'Science: Computers': 'technology',
  'Science: Mathematics': 'mathematics',
  Mythology: 'mythology',
  Sports: 'sports',
  Geography: 'geography',
  History: 'history',
  Politics: 'politics',
  Art: 'arts-literature',
  Celebrities: 'pop-culture',
  Animals: 'animals',
  Vehicles: 'vehicles',
  'Entertainment: Comics': 'comics',
  'Science: Gadgets': 'technology',
  'Entertainment: Japanese Anime & Manga': 'anime-manga',
  'Entertainment: Cartoon & Animations': 'animation',
};
let lastRequest = 0;
async function request(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await delay(Math.max(0, 5500 - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    const response = await fetch(`https://opentdb.com/${path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Open Trivia DB: HTTP ${response.status}`);
    const body = await response.json();
    if (body.response_code !== 5) return body;
    await delay(5500 * (attempt + 1));
  }
  throw new Error('A fonte continua limitando as requisições; tente novamente mais tarde.');
}
const tokenResponse = await request('api_token.php?command=request');
if (tokenResponse.response_code !== 0 || typeof tokenResponse.token !== 'string')
  throw new Error('Falha ao criar token de coleta.');
const token = tokenResponse.token;
let emptyProgress = 0;

while (imported.length < target) {
  const amount = Math.min(50, target - imported.length);
  const response = await request(
    `api.php?amount=${amount}&encode=url3986&token=${encodeURIComponent(token)}`,
  );
  if (response.response_code === 1 || response.response_code === 4) {
    console.log('A fonte não tem mais perguntas para esta coleta.');
    break;
  }
  if (response.response_code !== 0 || !Array.isArray(response.results))
    throw new Error(`Resposta inesperada da fonte: ${response.response_code}`);
  const before = imported.length;
  for (const raw of response.results) {
    const recordIndex = report.receivedCount++;
    const originalCategory = decodeURIComponent(raw.category);
    const category = categoryMap[originalCategory];
    if (!category) throw new Error(`Categoria não mapeada: ${originalCategory}`);
    const prompt = decodeURIComponent(raw.question);
    const texts = [raw.correct_answer, ...raw.incorrect_answers].map(decodeURIComponent);
    const question = {
      id: questionId(sourceId, category, prompt),
      category,
      locale: 'en',
      type: raw.type,
      prompt,
      options: texts.map((text, index) => ({ id: `option-${index}`, text })),
      correctOptionId: 'option-0',
      difficulty: raw.difficulty,
      status: 'needs-translation',
      source: {
        id: sourceId,
        url: 'https://opentdb.com/',
        recordIndex,
        category: originalCategory,
        license: 'CC-BY-SA-4.0',
      },
    };
    const errors = validateQuestion(question);
    if (errors.length) {
      report.invalid.push({ recordIndex, errors, record: raw });
      continue;
    }
    const key = questionKey(question);
    if (seen.has(key)) {
      report.duplicateCount++;
      continue;
    }
    seen.add(key);
    imported.push(question);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(question);
  }
  for (const [category, records] of groups)
    await writeJson(join(directory, `${category}.json`), records);
  await writeJson(reportPath, report);
  const categories = Object.fromEntries(
    [...groups.entries()].sort().map(([category, records]) => [category, records.length]),
  );
  await updateSource(root, {
    id: sourceId,
    title: 'Open Trivia DB',
    url: 'https://opentdb.com/',
    documentationUrl: 'https://opentdb.com/api_config.php',
    collectedAt: new Date().toISOString(),
    license: 'CC-BY-SA-4.0',
    licenseFile: 'data/licenses/opentdb.txt',
    locale: 'en',
    status: 'needs-translation',
    receivedCount: report.receivedCount,
    importedCount: imported.length,
    invalidCount: report.invalid.length,
    duplicateCount: report.duplicateCount,
    categories,
  });
  console.log(`${imported.length}/${target} perguntas coletadas em inglês.`);
  emptyProgress = imported.length === before ? emptyProgress + 1 : 0;
  if (emptyProgress >= 10) throw new Error('Coleta interrompida por lotes sem perguntas novas.');
}

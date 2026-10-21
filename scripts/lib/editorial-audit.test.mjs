import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
test('o conteúdo aprovado preserva acentos sem caracteres de substituição', async () => {
  const catalog = await read('data/questions/published/catalog.json');
  const report = await read('data/publication-reports/t27-editorial.json');
  const intact = (text) => assert.doesNotMatch(text, /\ufffd|\?(?!$)/u);
  for (const question of catalog.questions) {
    intact(question.prompt);
    for (const option of question.options) intact(option.text);
  }
  intact(report.semanticReview);
  for (const record of report.records) intact(record.note);
});

test('T27 mantém evidência individual consistente com as 228 novas aprovações e preserva os insumos da T11', async () => {
  const report = await read('data/publication-reports/t27-editorial.json');
  const catalog = await read('data/questions/published/catalog.json');
  const t11 = await read('data/publication-reports/t11-editorial.json');
  assert.equal(report.records.length, 228);
  const oldIds = new Set(t11.records.map((r) => r.id));
  const newRecords = new Map(report.records.map((r) => [r.id, r]));
  assert.equal(newRecords.size, 228);
  for (const q of catalog.questions) {
    if (oldIds.has(q.id)) continue;
    const decision = newRecords.get(q.id);
    assert.ok(decision, `Sem evidência T27: ${q.id}`);
    assert.deepEqual(decision.revised, {
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.correctOptionId,
    });
    assert.equal(decision.referenceUrl, q.review.referenceUrl);
    assert.equal(decision.reviewedAt, q.review.reviewedAt);
    assert.equal(decision.difficulty, q.difficulty);
    assert.equal(decision.sourceRecordIndex, q.source.recordIndex);
    const originals = await read(`data/questions/candidates/${q.source.id}/${q.category}.json`);
    const original = originals.find((r) => r.id === q.id);
    assert.ok(original);
    assert.deepEqual(q.source, original.source);
    assert.deepEqual(decision.original, {
      prompt: original.prompt,
      options: original.options,
      correctOptionId: original.correctOptionId,
    });
  }
  for (const [file, expected] of Object.entries(report.unchangedInputsSha256)) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(file, root)))
        .digest('hex'),
      expected,
      file,
    );
  }
  for (const old of t11.records) {
    const q = catalog.questions.find((q) => q.id === old.id);
    assert.ok(q);
    assert.deepEqual(old.revised, {
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.correctOptionId,
    });
    assert.equal(q.review.reviewedAt, t11.reviewedAt);
  }
});

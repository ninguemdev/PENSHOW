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
  const t11 = await read('data/publication-reports/t11-editorial.json');
  assert.equal(report.records.length, 228);
  const oldIds = new Set(t11.records.map((r) => r.id));
  const newRecords = new Map(report.records.map((r) => [r.id, r]));
  assert.equal(newRecords.size, 228);
  const baseline = await read('data/editorial-baselines/t27-catalog.json');
  assert.equal(baseline.questions.length, 300);
  assert.deepEqual(
    baseline.questions.map((q) => q.id).toSorted(),
    [...oldIds, ...newRecords.keys()].toSorted(),
  );
  for (const q of baseline.questions) {
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
  const historicalSources = await read('data/editorial-baselines/t27-sources.json');
  const currentSources = await read('data/sources.json');
  for (const source of historicalSources.sources) {
    const current = currentSources.sources.find((s) => s.id === source.id);
    assert.ok(current, `Fonte histórica ausente: ${source.id}`);
    // Later imports may update collection statistics, never historical attribution.
    for (const field of [
      'id',
      'title',
      'url',
      'documentationUrl',
      'revision',
      'license',
      'licenseFile',
      'locale',
    ])
      assert.equal(current[field], source[field], `${source.id}.${field}`);
  }
  for (const [file, expected] of Object.entries(report.unchangedInputsSha256)) {
    let bytes = await readFile(new URL(file, root));
    if (file.startsWith('data/questions/candidates/opentdb/')) {
      // T27 froze the first collection, not the size of every subsequent import.
      // Reconstruct its exact bytes and keep the original recorded hash as oracle.
      const source = historicalSources.sources.find((s) => s.id === 'opentdb');
      const original = JSON.parse(bytes).filter((q) => q.source.recordIndex < source.receivedCount);
      bytes = Buffer.from(`${JSON.stringify(original, null, 2)}\n`);
    } else if (file === 'data/sources.json') {
      bytes = await readFile(new URL('data/editorial-baselines/t27-sources.json', root));
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
  }
  for (const old of t11.records) {
    const q = baseline.questions.find((q) => q.id === old.id);
    assert.ok(q);
    assert.deepEqual(old.revised, {
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.correctOptionId,
    });
    assert.equal(q.review.reviewedAt, t11.reviewedAt);
  }
});

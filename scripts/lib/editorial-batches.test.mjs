import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditEditorialBatches } from './editorial-batches.mjs';
import { loadQuestions } from './questions.mjs';
import { fileURLToPath } from 'node:url';
import { catalogManifest } from '../../apps/server/src/modules/questions/catalog-format.ts';

const root = new URL('../../', import.meta.url);
const read = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
// Freeze the first-batch scenario so later batches do not redefine these test inputs.
const baseline = await read('data/editorial-baselines/t27-catalog.json');
const firstBatch = await read('data/editorial-batches/t33-001.json');
const reviewed = [...baseline.questions, ...firstBatch.records.map((r) => r.revised)];
const questions = reviewed
  .filter((q) => q.status === 'approved')
  .toSorted((a, b) => (a.id < b.id ? -1 : 1));
const usedSources = new Set(questions.map((q) => q.source.id));
const sources = (await read('data/questions/published/catalog.json')).sources.filter((s) =>
  usedSources.has(s.id),
);
const input = {
  baseline: structuredClone(baseline),
  catalog: structuredClone({
    schemaVersion: 1,
    questions,
    sources,
    manifest: catalogManifest(questions, sources),
  }),
  candidates: await loadQuestions(fileURLToPath(new URL('data/questions/candidates', root))),
  reviewed: structuredClone(reviewed),
  batches: [structuredClone(firstBatch)],
  sourceRegistry: structuredClone(sources),
};

test('conta apenas publicáveis com histórico, separa traduções, rejeições e o limite de candidatos', () => {
  const report = auditEditorialBatches(input);
  assert.equal(report.approved, 336);
  assert.equal(report.countTargetMet, false);
  assert.equal(report.remaining, 4664);
  assert.deepEqual(report.batches, [
    { id: 't33-001', sequence: 1, approved: 36, rejected: 2, translated: 36 },
  ]);
  assert.equal(report.candidateBacklog.count, input.candidates.length - reviewed.length);
  assert.equal(
    report.candidateBacklog.minimumAdditionalCandidates,
    Math.max(0, 5000 - 336 - report.candidateBacklog.count),
  );
  assert.deepEqual(
    report.sources.map((s) => [s.id, s.license, s.approved]),
    [
      ['opentdb', 'CC-BY-SA-4.0', 36],
      ['questionados', 'MIT', 300],
    ],
  );
});

test('aprovar somente candidatos não aumenta a contagem publicada', () => {
  const changed = structuredClone(input);
  const candidate = changed.candidates.find((q) => !changed.reviewed.some((r) => q.id === r.id));
  candidate.status = 'approved';
  assert.equal(auditEditorialBatches(changed).approved, 336);
});

test('recusa promoção manual sem lote e edição posterior sem histórico', () => {
  const missing = structuredClone(input);
  missing.batches[0].records.shift();
  assert.throws(() => auditEditorialBatches(missing), /fora do histórico/u);
  const edited = structuredClone(input);
  edited.reviewed.find((q) => q.id === edited.batches[0].records[0].revised.id).prompt =
    'Alteração sem evidência?';
  assert.throws(() => auditEditorialBatches(edited), /Revisão divergente/u);
});

test('recusa referências ausentes, procedência adulterada e catálogo de comparação divergente', () => {
  const reference = structuredClone(input);
  delete reference.batches[0].records[0].revised.review.referenceUrl;
  assert.throws(() => auditEditorialBatches(reference), /Revisão inválida/u);
  const source = structuredClone(input);
  source.batches[0].records[0].revised.source.license = 'MIT';
  assert.throws(() => auditEditorialBatches(source), /Procedência alterada/u);
  const comparison = structuredClone(input);
  comparison.batches[0].comparisonCatalogSha256 = '0'.repeat(64);
  assert.throws(() => auditEditorialBatches(comparison), /Catálogo de comparação divergente/u);
});

test('recusa mesma chave factual aprovada e duplicata declarada com representante inexistente', () => {
  const repeated = structuredClone(input);
  repeated.batches[0].records[1].factKey = repeated.batches[0].records[0].factKey;
  assert.throws(() => auditEditorialBatches(repeated), /Fato aprovado repetido/u);
  const duplicate = structuredClone(input);
  duplicate.batches[0].records.at(-1).duplicateOf = 'missing:record';
  assert.throws(() => auditEditorialBatches(duplicate), /Representante ausente/u);
});

test('recusa lote duplicado e repetição de ID dentro do mesmo lote', () => {
  const batches = structuredClone(input);
  batches.batches.push(structuredClone(batches.batches[0]));
  assert.throws(() => auditEditorialBatches(batches), /ID de lote repetido/u);
  const records = structuredClone(input);
  records.batches[0].records.push(structuredClone(records.batches[0].records[0]));
  assert.throws(() => auditEditorialBatches(records), /Registro repetido/u);
});

test('encadeia retirada editorial sem perder o antes/depois e sem contar duas versões', () => {
  const changed = structuredClone(input);
  const original = structuredClone(changed.batches[0].records[0].revised);
  const revised = { ...original, status: 'rejected' };
  changed.batches.push({
    schemaVersion: 1,
    id: 't33-002',
    sequence: 2,
    reviewedAt: '2026-10-23',
    comparisonCatalogSha256: changed.catalog.manifest.contentSha256,
    method: 'Cenário sintético de retirada editorial para testar o histórico.',
    records: [
      {
        original,
        revised,
        factKey: changed.batches[0].records[0].factKey,
        note: 'Cenário sintético de retirada, sem mudar a decisão real.',
        semanticReview: 'Retirada de um registro mantendo as versões anteriores.',
      },
    ],
  });
  changed.reviewed = changed.reviewed.map((q) => (q.id === revised.id ? revised : q));
  changed.catalog.questions = changed.catalog.questions.filter((q) => q.id !== revised.id);
  changed.catalog.manifest = catalogManifest(changed.catalog.questions, changed.catalog.sources);
  const report = auditEditorialBatches(changed);
  assert.equal(report.approved, 335);
  assert.equal(report.rejected, 3);
  changed.batches[1].records[0].original.prompt = 'Histórico inventado?';
  assert.throws(() => auditEditorialBatches(changed), /Histórico anterior divergente/u);
});

test('preserva a comparação histórica quando a última pergunta de uma fonte é retirada', () => {
  const changed = structuredClone(input);
  const withdrawn = changed.batches[0].records.filter((r) => r.revised.status === 'approved');
  const ids = new Set(withdrawn.map((r) => r.revised.id));
  changed.batches.push({
    schemaVersion: 1,
    id: 't33-002',
    sequence: 2,
    reviewedAt: '2026-10-23',
    comparisonCatalogSha256: changed.catalog.manifest.contentSha256,
    method: 'Cenário sintético de retirada de uma fonte da publicação atual.',
    records: withdrawn.map((r) => ({
      ...r,
      original: structuredClone(r.revised),
      revised: { ...r.revised, status: 'rejected' },
      note: 'Retirada sintética para testar a atribuição do catálogo anterior.',
    })),
  });
  changed.reviewed = changed.reviewed.map((q) =>
    ids.has(q.id) ? { ...q, status: 'rejected' } : q,
  );
  changed.catalog.questions = changed.catalog.questions.filter((q) => !ids.has(q.id));
  changed.catalog.sources = changed.catalog.sources.filter((s) => s.id !== 'opentdb');
  changed.catalog.manifest = catalogManifest(changed.catalog.questions, changed.catalog.sources);
  const result = auditEditorialBatches(changed);
  assert.equal(result.approved, 300);
  assert.equal(result.rejected, 38);
  assert.deepEqual(
    result.sources.map((s) => s.id),
    ['questionados'],
  );
});

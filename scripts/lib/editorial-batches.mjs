import assert from 'node:assert/strict';
import {
  editorialSlugSchema,
  reviewDateSchema,
} from '../../apps/server/src/modules/questions/editorial-question.schema.ts';
import {
  catalogManifest,
  publishedCatalogSchema,
  stableJson,
} from '../../apps/server/src/modules/questions/catalog-format.ts';
import { validateQuestion } from './questions.mjs';

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (questions) => questions.toSorted((a, b) => compare(a.id, b.id));
function index(records) {
  const result = new Map(records.map((q) => [q.id, q]));
  assert.equal(result.size, records.length, 'ID editorial repetido.');
  return result;
}
const text = (value) => typeof value === 'string' && value.trim().length >= 20;
function distribution(questions, field) {
  const counts = new Map();
  for (const q of questions) counts.set(q[field], (counts.get(q[field]) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => compare(a, b)));
}

/** Evidence is checked against snapshots; these checks cannot establish factual truth. */
export function auditEditorialBatches({
  baseline,
  candidates,
  reviewed,
  batches,
  catalog,
  sourceRegistry,
}) {
  publishedCatalogSchema.parse(baseline);
  publishedCatalogSchema.parse(catalog);
  const originals = index(candidates);
  const current = index(reviewed);
  const versions = index(baseline.questions);
  const facts = new Map();
  const summaries = [];
  const batchIds = new Set();
  const ordered = batches.toSorted((a, b) => a.sequence - b.sequence);
  for (const [position, batch] of ordered.entries()) {
    assert.equal(batch.schemaVersion, 1, 'Versão de lote inválida.');
    assert(editorialSlugSchema.safeParse(batch.id).success, 'ID de lote inválido.');
    assert(!batchIds.has(batch.id), 'ID de lote repetido.');
    batchIds.add(batch.id);
    assert.equal(batch.sequence, position + 1, 'Sequência de lotes inválida.');
    assert(reviewDateSchema.safeParse(batch.reviewedAt).success, 'Data de lote inválida.');
    assert(text(batch.method), 'Método editorial ausente.');
    assert(Array.isArray(batch.records) && batch.records.length > 0, 'Lote vazio.');
    const previous = sorted([...versions.values()].filter((q) => q.status === 'approved'));
    const usedSources = new Set(previous.map((q) => q.source.id));
    assert.equal(
      batch.comparisonCatalogSha256,
      catalogManifest(
        previous,
        sourceRegistry.filter((s) => usedSources.has(s.id)).toSorted((a, b) => compare(a.id, b.id)),
      ).contentSha256,
      `Catálogo de comparação divergente: ${batch.id}`,
    );
    const ids = new Set();
    let approved = 0;
    let rejected = 0;
    let translated = 0;
    for (const record of batch.records) {
      const { original, revised, factKey, note, semanticReview } = record;
      assert.deepEqual(validateQuestion(original), [], 'Original inválido.');
      assert.deepEqual(validateQuestion(revised), [], 'Revisão inválida.');
      assert(!ids.has(revised.id), 'Registro repetido no mesmo lote.');
      ids.add(revised.id);
      assert(['approved', 'rejected'].includes(revised.status), 'Decisão editorial pendente.');
      assert.equal(original.id, revised.id, 'ID alterado na revisão.');
      const candidate = originals.get(revised.id);
      assert(candidate, `Candidato ausente: ${revised.id}`);
      assert.equal(
        stableJson(revised.source),
        stableJson(candidate.source),
        'Procedência alterada.',
      );
      assert.equal(
        stableJson(original),
        stableJson(versions.get(original.id) ?? candidate),
        `Histórico anterior divergente: ${original.id}`,
      );
      assert(editorialSlugSchema.safeParse(factKey).success, 'Chave factual inválida.');
      assert(text(note) && text(semanticReview), 'Justificativa/revisão semântica ausente.');
      if (revised.status === 'approved') {
        assert.equal(revised.review.reviewedAt, batch.reviewedAt, 'Data da aprovação divergente.');
        assert.equal(record.duplicateOf, undefined, 'Duplicata declarada não pode ser aprovada.');
        approved++;
        if (original.locale !== revised.locale) translated++;
      } else {
        rejected++;
        if (record.duplicateOf !== undefined) {
          assert.notEqual(record.duplicateOf, revised.id, 'Duplicata aponta para si mesma.');
          assert.equal(
            versions.get(record.duplicateOf)?.status,
            'approved',
            'Representante ausente.',
          );
        }
      }
      versions.set(revised.id, revised);
      facts.set(revised.id, factKey);
    }
    summaries.push({ id: batch.id, sequence: batch.sequence, approved, rejected, translated });
  }
  // This also rejects manual promotions, missing rejections and edits outside the history.
  assert.equal(current.size, versions.size, 'Revisões fora do histórico editorial.');
  for (const [id, version] of versions)
    assert.equal(stableJson(current.get(id)), stableJson(version), `Revisão divergente: ${id}`);
  const approved = sorted([...versions.values()].filter((q) => q.status === 'approved'));
  assert.equal(
    stableJson(approved),
    stableJson(catalog.questions),
    'Publicação fora do histórico.',
  );
  const activeFacts = new Map();
  for (const q of approved) {
    const fact = facts.get(q.id);
    if (!fact) continue; // Legacy semantic review is documented in T11/T27.
    assert(!activeFacts.has(fact), `Fato aprovado repetido: ${fact}`);
    activeFacts.set(fact, q.id);
  }
  const baselineThemes = new Set(baseline.questions.map((q) => q.category));
  const undecided = candidates.filter((q) => !versions.has(q.id));
  const sources = catalog.sources.map((source) => ({
    id: source.id,
    license: source.license,
    approved: approved.filter((q) => q.source.id === source.id).length,
    licenseSha256: source.licenseSha256,
  }));
  return {
    schemaVersion: 1,
    task: 'T33',
    target: 5000,
    approved: approved.length,
    remaining: Math.max(0, 5000 - approved.length),
    // Reaching a number does not attest editorial quality or human review.
    countTargetMet: approved.length >= 5000,
    catalogSha256: catalog.manifest.contentSha256,
    baseline: { count: baseline.questions.length, catalogSha256: baseline.manifest.contentSha256 },
    batches: summaries,
    rejected: [...versions.values()].filter((q) => q.status === 'rejected').length,
    availability: catalog.manifest.availability,
    newThemes: Object.keys(catalog.manifest.availability).filter((c) => !baselineThemes.has(c)),
    sources,
    candidateBacklog: {
      count: undecided.length,
      byLocale: distribution(undecided, 'locale'),
      bySource: distribution(
        undecided.map((q) => ({ source: q.source.id })),
        'source',
      ),
      // An upper bound only: assumes every undecided candidate can eventually be approved.
      minimumAdditionalCandidates: Math.max(0, 5000 - approved.length - undecided.length),
    },
    scope:
      'Auditoria estrutural e de rastreabilidade. Referências, idioma, equivalência por sentido e dificuldade exigem conferência editorial; a ferramenta não os certifica.',
  };
}

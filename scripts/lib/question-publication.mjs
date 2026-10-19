import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { jsonFiles, questionKey, readJson, validateQuestion } from './questions.mjs';
import { approvedQuestionSchema } from '../../apps/server/src/modules/questions/editorial-question.schema.ts';
import {
  catalogManifest,
  catalogSourceSchema,
  publishedCatalogSchema,
  sha256,
  stableJson,
} from '../../apps/server/src/modules/questions/catalog-format.ts';

export const CATALOG_PATH = 'data/questions/published/catalog.json';
export const PUBLICATION_REPORT_PATH = 'data/publication-reports/questions.json';
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const within = (root, target) => {
  const path = relative(root, target);
  return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
};
const label = (root, file) => relative(root, file).split(sep).join('/');

export async function loadSourceRegistry(root) {
  const manifest = await readJson(join(root, 'data/sources.json'), null);
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.sources))
    throw new Error('Manifesto de fontes inválido.');
  const sources = new Map();
  for (const entry of manifest.sources) {
    if (!entry || typeof entry.licenseFile !== 'string')
      throw new Error('Arquivo de licença não declarado.');
    const licenses = await realpath(join(root, 'data/licenses'));
    const licenseFile = await realpath(resolve(root, entry.licenseFile));
    if (!within(licenses, licenseFile))
      throw new Error('Arquivo de licença fora de data/licenses.');
    const licenseText = (await readFile(licenseFile, 'utf8')).replace(/\r\n?/gu, '\n');
    const source = catalogSourceSchema.safeParse({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      license: entry.license,
      licenseText,
      licenseSha256: sha256(licenseText),
    });
    if (!source.success || sources.has(source.data.id))
      throw new Error('Fonte inválida ou repetida no manifesto.');
    sources.set(source.data.id, source.data);
  }
  return sources;
}

async function entries(root, directory) {
  const result = [];
  for (const file of (await jsonFiles(join(root, directory))).sort(compare)) {
    let records;
    try {
      records = await readJson(file, null);
    } catch {
      throw new Error(`JSON inválido: ${label(root, file)}`);
    }
    if (!Array.isArray(records)) throw new Error(`Lista inválida: ${label(root, file)}`);
    records.forEach((record, index) =>
      result.push({
        record,
        at: {
          file: label(root, file),
          index,
          id: typeof record?.id === 'string' ? record.id : null,
        },
      }),
    );
  }
  return result;
}
function duplicateGroups(items, key, kind) {
  const groups = new Map();
  for (const item of items) {
    const value = key(item.record);
    if (value === null || value === undefined) continue;
    const group = groups.get(value) ?? [];
    group.push(item.at);
    groups.set(value, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((records) => ({ kind, records }));
}

export async function compileQuestionCatalog(root) {
  const report = {
    schemaVersion: 1,
    candidates: { count: 0, statuses: {} },
    reviewedCount: 0,
    approvedCount: 0,
    excluded: [],
    invalid: [],
    duplicates: [],
    availability: {},
    errors: [],
    publishable: false,
  };
  const errors = report.errors;
  let catalog = null;
  try {
    const sources = await loadSourceRegistry(root);
    const candidates = await entries(root, 'data/questions/candidates');
    const reviewed = await entries(root, 'data/questions/reviewed');
    report.candidates.count = candidates.length;
    const statuses = new Map();
    for (const { record } of candidates) {
      const status = typeof record?.status === 'string' ? record.status : 'invalid';
      statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }
    report.candidates.statuses = Object.fromEntries(
      [...statuses].sort(([a], [b]) => compare(a, b)),
    );
    report.reviewedCount = reviewed.length;
    const candidateIds = new Map();
    for (const item of candidates) {
      const list = candidateIds.get(item.record?.id) ?? [];
      list.push(item.record);
      candidateIds.set(item.record?.id, list);
    }
    report.duplicates.push(
      ...duplicateGroups(
        reviewed,
        (record) => (typeof record?.id === 'string' ? record.id : null),
        'editorial-id',
      ),
    );
    if (report.duplicates.length)
      errors.push('Há IDs editoriais repetidos nos registros revisados.');
    const approved = [];
    for (const item of reviewed) {
      const reasons = validateQuestion(item.record);
      if (item.record?.status !== 'approved') {
        report.excluded.push({ ...item.at, reason: item.record?.status ?? 'invalid' });
        if (reasons.length) report.invalid.push({ ...item.at, errors: reasons });
        continue;
      }
      const parsed = approvedQuestionSchema.safeParse(item.record);
      if (!parsed.success) {
        report.invalid.push({ ...item.at, errors: reasons });
        errors.push(`Registro aprovado inválido: ${item.at.file}#${item.at.index}`);
        continue;
      }
      const question = parsed.data;
      const original = candidateIds.get(question.id);
      if (
        original?.length !== 1 ||
        stableJson(original[0].source) !== stableJson(question.source) ||
        sources.get(question.source.id)?.license !== question.source.license
      ) {
        report.invalid.push({
          ...item.at,
          errors: ['Procedência não corresponde a um candidato único e à licença do manifesto.'],
        });
        errors.push(`Procedência inválida: ${item.at.file}#${item.at.index}`);
        continue;
      }
      approved.push({ record: question, at: item.at });
    }
    // Normalize just as the existing importer does, across every category/source in pt-BR.
    const duplicates = duplicateGroups(approved, questionKey, 'normalized-prompt');
    report.duplicates.push(...duplicates);
    if (duplicates.length)
      errors.push('Há enunciados aprovados equivalentes; resolva a duplicata editorialmente.');
    const questions = approved.map((item) => item.record).sort((a, b) => compare(a.id, b.id));
    const usedIds = new Set(questions.map((question) => question.source.id));
    const attributions = [...sources.values()]
      .filter((source) => usedIds.has(source.id))
      .sort((a, b) => compare(a.id, b.id));
    const manifest = catalogManifest(questions, attributions);
    report.approvedCount = questions.length;
    report.availability = manifest.availability;
    if (!errors.length) {
      catalog = publishedCatalogSchema.parse({
        schemaVersion: 1,
        manifest,
        sources: attributions,
        questions,
      });
      report.publishable = true;
    }
  } catch (error) {
    errors.push(
      error instanceof Error && !('issues' in error)
        ? error.message
        : 'Falha ao validar o catálogo privado.',
    );
  }
  return { catalog, report };
}

async function atomicJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = join(dirname(file), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, stableJson(value), { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
export async function publishQuestionCatalog(root, { check = false } = {}) {
  const result = await compileQuestionCatalog(root);
  const catalogFile = join(root, CATALOG_PATH);
  const reportFile = join(root, PUBLICATION_REPORT_PATH);
  if (check) {
    if (!result.catalog) return { ...result, ok: false };
    try {
      const [catalogBytes, reportBytes] = await Promise.all([
        readFile(catalogFile, 'utf8'),
        readFile(reportFile, 'utf8'),
      ]);
      if (catalogBytes !== stableJson(result.catalog) || reportBytes !== stableJson(result.report))
        throw new Error();
    } catch {
      result.report.errors.push(
        'Catálogo/relatório desatualizado ou ausente. Execute questions:publish.',
      );
      return { ...result, ok: false };
    }
    return { ...result, ok: true };
  }
  // On a failed approval attempt, update diagnostics but keep the last valid catalog intact.
  await atomicJson(reportFile, result.report);
  if (!result.catalog) return { ...result, ok: false };
  await mkdir(dirname(catalogFile), { recursive: true });
  const realRoot = await realpath(root);
  const outputDirectory = await realpath(dirname(catalogFile));
  if (outputDirectory !== join(realRoot, 'data/questions/published'))
    throw new Error('Catálogo deve ficar no diretório privado data/questions/published.');
  await atomicJson(catalogFile, result.catalog);
  return { ...result, ok: true };
}

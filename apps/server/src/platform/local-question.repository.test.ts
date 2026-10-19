import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalQuestionRepository } from './local-question.repository.js';
import { approvedQuestionSchema } from '../modules/questions/editorial-question.schema.js';
import {
  catalogManifest,
  sha256,
  stableJson,
  type PublishedCatalog,
} from '../modules/questions/catalog-format.js';
import { buildApp } from '../app.js';
import { loadConfig } from './config.js';
import { createTestRuntime } from '../test-support/runtime.js';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    expect(dirname(resolve(directory))).toBe(resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
function sample() {
  return approvedQuestionSchema.parse({
    id: 'sample:geography:1',
    category: 'geography',
    locale: 'pt-BR',
    type: 'multiple',
    prompt: 'Sentinela privada de teste?',
    options: ['Alfa', 'Beta', 'Gama', 'Delta'].map((text, index) => ({
      id: `option-${index}`,
      text,
    })),
    correctOptionId: 'option-0',
    difficulty: 'easy',
    status: 'approved',
    source: { id: 'sample', url: 'https://example.test/source', recordIndex: 0, license: 'MIT' },
    review: {
      referenceUrl: 'https://example.test/fact',
      reviewedAt: '2026-10-17',
      checks: { factual: true, language: true, uniqueAnswer: true },
    },
  });
}
function catalog(empty = false): PublishedCatalog {
  const questions = empty ? [] : [sample()];
  const sources = empty
    ? []
    : [
        {
          id: 'sample',
          title: 'Fixture',
          url: 'https://example.test',
          license: 'MIT',
          licenseText: 'Synthetic fixture license.\n',
          licenseSha256: sha256('Synthetic fixture license.\n'),
        },
      ];
  return { schemaVersion: 1, manifest: catalogManifest(questions, sources), questions, sources };
}
async function fixture(value: unknown = catalog()) {
  const root = await mkdtemp(join(tmpdir(), 'penshow-catalog-test-'));
  directories.push(root);
  const file = join(root, 'catalog.json');
  await writeFile(file, stableJson(value));
  return { root, file, repository: new LocalQuestionRepository(file) };
}

describe('catálogo local privado', () => {
  it('carrega uma vez e consulta por tema/dificuldade sem alterar o registro interno', async () => {
    const f = await fixture();
    expect(() => f.repository.list()).toThrow('ainda não carregado');
    await f.repository.load();
    expect(f.repository.list()).toEqual([sample()]);
    expect(f.repository.list({ category: 'missing' })).toEqual([]);
    expect(f.repository.list({ difficulty: 'hard' })).toEqual([]);
    expect(f.repository.list({ category: 'geography', difficulty: 'easy' })).toHaveLength(1);
    const copy = f.repository.list();
    copy[0]!.options[0]!.text = 'Alteração externa';
    const available = f.repository.availability();
    available.geography!.easy = 99;
    expect(f.repository.list()[0]!.options[0]!.text).toBe('Alfa');
    expect(f.repository.availability().geography!.easy).toBe(1);
    await rm(f.file);
    expect(f.repository.list()).toHaveLength(1);
  });
  it('aceita catálogo vazio explícito sem habilitar conteúdo fictício', async () => {
    const f = await fixture(catalog(true));
    await f.repository.load();
    expect(f.repository.list()).toEqual([]);
    expect(f.repository.availability()).toEqual({});
  });
  it.each(['missing', 'directory', 'json', 'oversize'] as const)(
    'recusa arquivo %s com erro fixo, sem detalhes privados',
    async (kind) => {
      const f = await fixture();
      if (kind === 'missing') await rm(f.file);
      else if (kind === 'directory') {
        await rm(f.file);
        await mkdir(f.file);
      } else if (kind === 'json') await writeFile(f.file, '{Sentinela privada de teste?');
      else await writeFile(f.file, 'x'.repeat(32 * 1024 * 1024 + 1));
      await expect(f.repository.load()).rejects.toThrow(
        'Não foi possível carregar o catálogo privado',
      );
      await f.repository.load().catch((error) => {
        expect(String(error)).not.toContain(f.file);
        expect(String(error)).not.toContain('Sentinela');
      });
      expect(() => f.repository.availability()).toThrow('ainda não carregado');
    },
  );
  it.each([
    'answer',
    'provenance',
    'review',
    'hash',
    'count',
    'availability',
    'license',
    'duplicate',
    'extra',
  ] as const)('recusa catálogo com %s inválido', async (kind) => {
    const value = catalog();
    if (kind === 'answer') value.questions[0]!.correctOptionId = 'missing';
    if (kind === 'provenance') value.questions[0]!.source.license = 'Different';
    if (kind === 'review') value.questions[0]!.review.reviewedAt = '2026-02-30';
    if (kind === 'hash') value.manifest.contentSha256 = 'a'.repeat(64);
    if (kind === 'count') value.manifest.questionCount++;
    if (kind === 'availability') value.manifest.availability.geography!.easy++;
    if (kind === 'license') value.sources[0]!.licenseText = 'Altered';
    if (kind === 'duplicate') value.questions.push(structuredClone(value.questions[0]!));
    if (kind === 'extra') Object.assign(value.questions[0]!, { unexpected: 'secret' });
    const f = await fixture(value);
    await expect(f.repository.load()).rejects.toThrow(
      'Não foi possível carregar o catálogo privado',
    );
  });
  it('uma recarga inválida não deixa servir o estado anterior silenciosamente', async () => {
    const f = await fixture();
    await f.repository.load();
    await writeFile(f.file, '{}');
    await expect(f.repository.load()).rejects.toThrow();
    expect(() => f.repository.list()).toThrow('ainda não carregado');
  });
  it('composição carrega antes de aceitar requisições e não expõe catálogo por HTTP', async () => {
    const f = await fixture();
    const app = buildApp({ config: loadConfig({ NODE_ENV: 'test' }), questionCatalogFile: f.file });
    try {
      expect(() => app.questions.list()).toThrow('ainda não carregado');
      expect((await app.inject('/health')).statusCode).toBe(200);
      expect(app.questions.list()).toHaveLength(1);
      for (const path of [
        '/questions',
        '/data/questions/published/catalog.json',
        '/catalog.json',
      ]) {
        const response = await app.inject(path);
        expect(response.statusCode).toBe(404);
        expect(response.body).not.toContain('Sentinela');
        expect(response.body).not.toContain('option-0');
      }
    } finally {
      await app.close();
    }
  });
  it('erro de catálogo impede o startup sem iniciar varreduras ou imprimir conteúdo', async () => {
    const f = await fixture({ secret: 'Sentinela privada' });
    const runtime = createTestRuntime();
    const app = buildApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      runtime: runtime.runtime,
      questionCatalogFile: f.file,
    });
    try {
      await expect(app.ready()).rejects.toThrow('Não foi possível carregar o catálogo privado');
    } finally {
      await app.close();
    }
    expect(runtime.time.pendingCount).toBe(0);
  });
  it('permite injetar uma porta de leitura sem depender de disco nos testes de serviço', async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      questions: { list: () => [], availability: () => ({}) },
    });
    try {
      await app.ready();
      expect(app.questions.list()).toEqual([]);
    } finally {
      await app.close();
    }
  });
});

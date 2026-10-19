import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import {
  compileQuestionCatalog,
  publishQuestionCatalog,
  CATALOG_PATH,
  PUBLICATION_REPORT_PATH,
} from './question-publication.mjs';
import { writeJson, validateQuestion } from './questions.mjs';

// These are synthetic infrastructure fixtures; no factual approval of real imported content.
function question(id = 'sample:geography:1') {
  return {
    id,
    category: 'geography',
    locale: 'pt-BR',
    type: 'multiple',
    prompt: `Pergunta fictícia ${id}?`,
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
  };
}
async function fixture(t, { reviewed = [question()], candidates = reviewed } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'penshow-publication-test-'));
  // Verify the absolute cleanup target is exactly this newly-created test directory.
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeJson(join(root, 'data/sources.json'), {
    schemaVersion: 1,
    sources: [
      {
        id: 'sample',
        title: 'Fixture',
        url: 'https://example.test/',
        license: 'MIT',
        licenseFile: 'data/licenses/sample.txt',
      },
    ],
  });
  await mkdir(join(root, 'data/licenses'), { recursive: true });
  await writeFile(join(root, 'data/licenses/sample.txt'), 'Synthetic fixture license.\n');
  await writeJson(join(root, 'data/questions/candidates/sample/geography.json'), candidates);
  await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), reviewed);
  return root;
}

test('promove só revisão aprovada e conserva procedência, licença, referência e disponibilidade', async (t) => {
  const approved = question();
  const root = await fixture(t);
  const result = await publishQuestionCatalog(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.catalog.questions, [approved]);
  assert.equal(result.catalog.sources[0].licenseText, 'Synthetic fixture license.\n');
  assert.deepEqual(result.catalog.manifest.availability, {
    geography: { easy: 1, medium: 0, hard: 0, total: 1 },
  });
  assert.equal(result.report.candidates.count, 1);
  assert.equal((await publishQuestionCatalog(root, { check: true })).ok, true);
});
test('candidata até com status approved e registros pendentes/rejeitados nunca são publicados', async (t) => {
  const reviewed = ['needs-review', 'needs-translation', 'rejected'].map((status, index) => ({
    ...question(`sample:geography:${index}`),
    status,
    locale: index === 1 ? 'en' : 'pt-BR',
  }));
  const root = await fixture(t, {
    candidates: [...reviewed, question('sample:geography:candidate')],
    reviewed,
  });
  const result = await publishQuestionCatalog(root);
  assert.equal(result.ok, true);
  assert.equal(result.catalog.manifest.questionCount, 0);
  assert.equal(result.catalog.sources.length, 0);
  assert.equal(result.report.excluded.length, 3);
  assert.equal(result.report.candidates.count, 4);
});
for (const [name, change] of [
  [
    'sem revisão',
    (value) => {
      delete value.review;
    },
  ],
  [
    'dificuldade ausente',
    (value) => {
      value.difficulty = 'unrated';
    },
  ],
  [
    'tradução incompleta',
    (value) => {
      value.review.checks.language = false;
    },
  ],
  [
    'resposta única não conferida',
    (value) => {
      value.review.checks.uniqueAnswer = false;
    },
  ],
  [
    'fatos não conferidos',
    (value) => {
      value.review.checks.factual = false;
    },
  ],
  [
    'idioma original',
    (value) => {
      value.locale = 'en';
    },
  ],
  [
    'data impossível',
    (value) => {
      value.review.reviewedAt = '2026-02-30';
    },
  ],
  [
    'referência inválida',
    (value) => {
      value.review.referenceUrl = 'javascript:alert(1)';
    },
  ],
  [
    'categoria inválida',
    (value) => {
      value.category = 'Tema inválido';
    },
  ],
  [
    'gabarito ausente',
    (value) => {
      value.correctOptionId = 'absent';
    },
  ],
  [
    'alternativas equivalentes',
    (value) => {
      value.options[1].text = 'ALFÁ!';
    },
  ],
  [
    'alternativas sem sentido',
    (value) => {
      value.options[1].text = '???';
    },
  ],
  [
    'HTML pendente',
    (value) => {
      value.prompt = '<b>Questão</b>';
    },
  ],
  [
    'licença divergente',
    (value) => {
      value.source.license = 'Unknown';
    },
  ],
  [
    'URL de origem inválida',
    (value) => {
      value.source.url = 'file:///private';
    },
  ],
  [
    'índice de origem trocado',
    (value) => {
      value.source.recordIndex = 8;
    },
  ],
])
  test(`recusa aprovação: ${name}, preservando catálogo anterior e registrando erro`, async (t) => {
    const root = await fixture(t);
    assert.equal((await publishQuestionCatalog(root)).ok, true);
    const previous = await readFile(join(root, CATALOG_PATH), 'utf8');
    const bad = question();
    change(bad);
    await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), [bad]);
    const result = await publishQuestionCatalog(root);
    assert.equal(result.ok, false);
    assert.ok(result.report.invalid.length > 0);
    assert.ok(result.report.errors.length > 0);
    assert.equal(await readFile(join(root, CATALOG_PATH), 'utf8'), previous);
    assert.equal(
      JSON.parse(await readFile(join(root, PUBLICATION_REPORT_PATH), 'utf8')).publishable,
      false,
    );
    assert.equal((await publishQuestionCatalog(root, { check: true })).ok, false);
  });
test('não aprova registros sem original único e resolve duplicatas apenas por decisão editorial', async (t) => {
  const first = question(),
    second = question('sample:geography:2');
  second.prompt = first.prompt.toUpperCase().replace('?', '!');
  const root = await fixture(t, { reviewed: [second, first] });
  let result = await compileQuestionCatalog(root);
  assert.equal(result.catalog, null);
  assert.equal(result.report.duplicates[0].kind, 'normalized-prompt');
  await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), [first, first]);
  result = await compileQuestionCatalog(root);
  assert.equal(result.catalog, null);
  assert.ok(result.report.duplicates.some((entry) => entry.kind === 'editorial-id'));
  await writeJson(join(root, 'data/questions/candidates/sample/geography.json'), []);
  await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), [first]);
  assert.equal((await compileQuestionCatalog(root)).catalog, null);
});
test('compila repetidamente com bytes estáveis, sem depender de ordem de arquivos ou propriedades', async (t) => {
  const first = question(),
    second = { ...question('sample:history:2'), category: 'history', difficulty: 'hard' };
  const root = await fixture(t, { reviewed: [second, first] });
  assert.equal((await publishQuestionCatalog(root)).ok, true);
  const bytes = await readFile(join(root, CATALOG_PATH), 'utf8');
  const report = await readFile(join(root, PUBLICATION_REPORT_PATH), 'utf8');
  await writeFile(join(root, 'data/licenses/sample.txt'), 'Synthetic fixture license.\r\n');
  assert.equal((await publishQuestionCatalog(root)).ok, true);
  assert.equal(await readFile(join(root, CATALOG_PATH), 'utf8'), bytes);
  assert.equal(await readFile(join(root, PUBLICATION_REPORT_PATH), 'utf8'), report);
  const reversed = Object.fromEntries(Object.entries(first).reverse());
  await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), [reversed, second]);
  assert.equal((await publishQuestionCatalog(root)).ok, true);
  assert.equal(await readFile(join(root, CATALOG_PATH), 'utf8'), bytes);
  assert.deepEqual(await readdir(join(root, 'data/questions/published')), ['catalog.json']);
});
test('check detecta arquivo publicado adulterado ou ausente sem reescrevê-lo', async (t) => {
  const root = await fixture(t);
  assert.equal((await publishQuestionCatalog(root, { check: true })).ok, false);
  await publishQuestionCatalog(root);
  await writeFile(join(root, CATALOG_PATH), '{}');
  assert.equal((await publishQuestionCatalog(root, { check: true })).ok, false);
  assert.equal(await readFile(join(root, CATALOG_PATH), 'utf8'), '{}');
});
test('falha com JSON inválido, licença ausente ou arquivo de licença fora do diretório permitido', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'data/questions/reviewed/sample/geography.json'), '{');
  assert.equal((await publishQuestionCatalog(root)).ok, false);
  await writeJson(join(root, 'data/questions/reviewed/sample/geography.json'), []);
  await rm(join(root, 'data/licenses/sample.txt'));
  assert.equal((await publishQuestionCatalog(root)).ok, false);
  await writeJson(join(root, 'data/sources.json'), {
    schemaVersion: 1,
    sources: [
      {
        id: 'sample',
        title: 'Fixture',
        url: 'https://example.test',
        license: 'MIT',
        licenseFile: 'data/sources.json',
      },
    ],
  });
  assert.equal((await publishQuestionCatalog(root)).ok, false);
});
test('recusa redirecionar a publicação para o diretório público da web', async (t) => {
  const root = await fixture(t);
  const target = join(root, 'apps/web/public');
  await mkdir(target, { recursive: true });
  await symlink(
    target,
    join(root, 'data/questions/published'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(publishQuestionCatalog(root), /diretório privado/u);
  assert.deepEqual(await readdir(target), []);
});
test('datas válidas e alternativas booleanas preservam o contrato privado', () => {
  const value = { ...question(), type: 'boolean', options: question().options.slice(0, 2) };
  value.review.reviewedAt = '2024-02-29';
  assert.deepEqual(validateQuestion(value), []);
  value.review.reviewedAt = '2025-02-29';
  assert.notDeepEqual(validateQuestion(value), []);
});

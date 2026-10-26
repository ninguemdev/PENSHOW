import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { avatarCatalog } from '../../packages/shared/dist/index.js';
import { checkAvatars, readAvatarFiles } from './check.mjs';
import { inspectPng } from './png.mjs';

function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4);
  result.set(data, 8);
  result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4);
  return result;
}
function png({ size = 1024, alpha = 'mixed', filter = 0, extra = [] } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) {
    rows[row * (size * 4 + 1)] = filter;
    if (alpha === 'opaque')
      for (let pixel = 0; pixel < size; pixel++) rows[row * (size * 4 + 1) + pixel * 4 + 4] = 255;
  }
  if (alpha === 'mixed') rows[4] = 255;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    ...extra,
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const smallCatalog = structuredClone(avatarCatalog);
for (const category of Object.values(smallCatalog.categories))
  category.options = category.required ? category.options.slice(0, 1) : [];
const fixtureFiles = () =>
  Object.values(smallCatalog.categories).flatMap((category) =>
    category.options.map((option) => ({ path: option.file, bytes: png() })),
  );

test('verifica as artes atuais e preserva a integridade das 50 artes do Comicle', async () => {
  const files = await readAvatarFiles(
    fileURLToPath(new URL('../../apps/web/public/avatars/', import.meta.url)),
  );
  assert.deepEqual(checkAvatars(avatarCatalog, files), { total: 51, errors: [] });
  for (const category of Object.values(avatarCatalog.categories))
    for (const option of category.options) {
      const { bounds } = inspectPng(files.find((file) => file.path === option.file).bytes);
      assert.deepEqual(option.pivot, {
        x: (bounds.left + bounds.right) / 2048,
        y: (bounds.top + bounds.bottom) / 2048,
      });
    }
  const manifest = JSON.parse(
    await readFile(new URL('../../licenses/comicle-avatars.json', import.meta.url), 'utf8'),
  );
  for (const entry of manifest.files) {
    const file = files.find((file) => file.path === entry.file);
    assert.equal(createHash('sha256').update(file.bytes).digest('hex'), entry.sha256);
  }
  assert.equal(
    await readFile(new URL('../../licenses/comicle-LICENSE.txt', import.meta.url), 'utf8'),
    await readFile(
      new URL('../../apps/web/public/licenses/comicle-LICENSE.txt', import.meta.url),
      'utf8',
    ),
  );
});
test('aceita PNG RGBA válido e recusa artes ausentes, órfãs, duplicadas e links', () => {
  const files = fixtureFiles();
  assert.deepEqual(checkAvatars(smallCatalog, files).errors, []);
  assert.match(checkAvatars(smallCatalog, files.slice(1)).errors.join(), /ausente/);
  assert.match(
    checkAvatars(smallCatalog, [...files, { ...files[0], path: 'extra.png' }]).errors.join(),
    /órfão/,
  );
  assert.match(checkAvatars(smallCatalog, [...files, files[0]]).errors.join(), /duplicado/);
  assert.match(
    checkAvatars(smallCatalog, [{ ...files[0], unsafe: true }, ...files.slice(1)]).errors.join(),
    /link/,
  );
});
test('recusa SVG, scripts disfarçados e caminhos que escapam do diretório', () => {
  const files = fixtureFiles();
  files[0].bytes = Buffer.from('<svg viewBox="0 0 512 512"><script>alert(1)</script></svg>');
  assert.match(checkAvatars(smallCatalog, files).errors.join(), /não é PNG/);
  const catalog = structuredClone(smallCatalog);
  catalog.categories.head.options[0].file = '../outside.png';
  assert.match(checkAvatars(catalog, files).errors.join(), /Catálogo/);
});
test('recusa tamanho excessivo, dimensões diferentes, fundo opaco e arte vazia', () => {
  assert.throws(() => inspectPng(Buffer.alloc(102401)), /100 KB/);
  assert.throws(() => inspectPng(png({ size: 32 })), /dimensões/);
  assert.throws(() => inspectPng(png({ alpha: 'opaque' })), /sem pixels transparentes/);
  assert.throws(() => inspectPng(png({ alpha: 'empty' })), /completamente transparente/);
});
test('recusa truncamento, CRC inválido, filtro inválido, animação e dados após o fim', () => {
  const valid = png();
  const corrupt = Buffer.from(valid);
  corrupt[29] ^= 1;
  assert.throws(() => inspectPng(valid.subarray(0, valid.length - 2)), /truncado/);
  assert.throws(() => inspectPng(corrupt), /CRC/);
  assert.throws(() => inspectPng(png({ filter: 5 })), /filtro/);
  assert.throws(
    () => inspectPng(png({ extra: [chunk('acTL', Buffer.alloc(8))] })),
    /chunk não permitido/,
  );
  assert.throws(() => inspectPng(Buffer.concat([valid, Buffer.from('<script>')])), /após o fim/);
});

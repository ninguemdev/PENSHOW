import { readFile, writeFile } from 'node:fs/promises';
import { inspectPng, ART_SIZE } from './png.mjs';

const catalogUrl = new URL('../../packages/shared/src/avatar/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
for (const category of Object.values(catalog.categories)) {
  for (const option of category.options) {
    const { bounds } = inspectPng(
      await readFile(new URL(`../../apps/web/public/avatars/${option.file}`, import.meta.url)),
    );
    option.pivot = {
      x: (bounds.left + bounds.right) / (2 * ART_SIZE),
      y: (bounds.top + bounds.bottom) / (2 * ART_SIZE),
    };
  }
}
const output = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (output !== (await readFile(catalogUrl, 'utf8')))
    throw new Error('Pivôs desatualizados; execute node scripts/avatars/update-pivots.mjs.');
} else await writeFile(catalogUrl, output);
console.log('Pivôs conferidos a partir dos limites dos pixels visíveis.');

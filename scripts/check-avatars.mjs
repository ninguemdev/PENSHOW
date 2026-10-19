import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkAvatars, readAvatarFiles } from './avatars/check.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../packages/shared/src/avatar/catalog.json', import.meta.url), 'utf8'),
);
const files = await readAvatarFiles(
  fileURLToPath(new URL('../apps/web/public/avatars/', import.meta.url)),
);
const report = checkAvatars(catalog, files);
if (report.errors.length) {
  for (const error of report.errors) console.error(error);
  process.exitCode = 1;
} else
  console.log(
    `${report.total} artes verificadas: catálogo, caminhos, PNG, dimensões, CRC e transparência.`,
  );

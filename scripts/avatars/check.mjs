// Adapted from Comicle's avatar verifier, MIT. See THIRD_PARTY_NOTICES.md.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { avatarCatalogSchema } from '../../packages/shared/dist/index.js';
import { inspectPng } from './png.mjs';

export function checkAvatars(rawCatalog, files) {
  const parsed = avatarCatalogSchema.safeParse(rawCatalog);
  if (!parsed.success)
    return {
      total: 0,
      errors: parsed.error.issues.map(
        (issue) => `Catálogo (${issue.path.join('.')}): ${issue.message}`,
      ),
    };
  const expected = new Set(
    Object.values(parsed.data.categories).flatMap((category) =>
      category.options.map((option) => option.file),
    ),
  );
  const errors = [];
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.path)) errors.push(`${file.path}: arquivo duplicado`);
    seen.add(file.path);
    if (!expected.has(file.path)) errors.push(`${file.path}: arquivo órfão ou não permitido`);
    if (file.unsafe) {
      errors.push(`${file.path}: link ou tipo de arquivo não permitido`);
      continue;
    }
    try {
      inspectPng(file.bytes);
    } catch (error) {
      errors.push(`${file.path}: ${error.message}`);
    }
  }
  for (const path of expected) if (!seen.has(path)) errors.push(`${path}: arquivo ausente`);
  return { total: expected.size, errors };
}

export async function readAvatarFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) files.push({ path, unsafe: true });
    else if (entry.isDirectory()) files.push(...(await readAvatarFiles(root, path)));
    else if (entry.isFile()) files.push({ path, bytes: await readFile(join(root, path)) });
    else files.push({ path, unsafe: true });
  }
  return files;
}

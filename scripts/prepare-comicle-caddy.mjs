import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { addPenshowRoute } from './lib/comicle-caddy.mjs';

const [source, target, ...extra] = process.argv.slice(2);
if (
  !source ||
  !target ||
  extra.length ||
  !isAbsolute(source) ||
  !isAbsolute(target) ||
  resolve(source) === resolve(target)
)
  throw new Error('Use prepare-comicle-caddy <original-absoluto> <candidato-absoluto-distinto>.');
const original = await readFile(source, 'utf8');
await writeFile(target, addPenshowRoute(original), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
console.log('Candidato Caddy preparado; o original não foi alterado.');

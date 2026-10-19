import {
  normalizeQuestionText as normalizedPrompt,
  validateEditorialQuestion as validateQuestion,
} from '../../apps/server/src/modules/questions/editorial-question.schema.ts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const PROJECT_ROOT = new URL('../../', import.meta.url);

export { normalizedPrompt, validateQuestion };

export function questionKey(question) {
  return `${question.locale}:${normalizedPrompt(question.prompt)}`;
}

export function questionId(sourceId, category, prompt) {
  const hash = createHash('sha256').update(normalizedPrompt(prompt)).digest('hex').slice(0, 16);
  return `${sourceId}:${category}:${hash}`;
}

function decodeSingleQuoted(token) {
  let result = '';
  const escapes = {
    "'": "'",
    '"': '"',
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
  };
  for (let index = 1; index < token.length - 1; index++) {
    const character = token[index];
    if (character !== '\\') {
      result += character;
      continue;
    }
    const escaped = token[++index];
    if (Object.hasOwn(escapes, escaped)) result += escapes[escaped];
    else if (escaped === 'u' || escaped === 'x') {
      const size = escaped === 'u' ? 4 : 2;
      const digits = token.slice(index + 1, index + 1 + size);
      if (!new RegExp(`^[0-9a-fA-F]{${size}}$`, 'u').test(digits))
        throw new Error('Escape inválido.');
      result += String.fromCharCode(Number.parseInt(digits, 16));
      index += size;
    } else throw new Error('Escape não suportado na fonte.');
  }
  return result;
}

export function parseQuestionados(source) {
  const assignment = source.match(/^\s*const\s+[A-Z_]+\s*=\s*([\s\S]*?)\s*;?\s*$/u);
  if (!assignment) throw new Error('Formato de arquivo não reconhecido.');
  // Match complete strings first so text inside a question is never rewritten as a key.
  const json = assignment[1].replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_$][\w$]*(?=\s*:)|,\s*(?=[}\]])/gu,
    (token) => {
      if (token.startsWith('"')) return token;
      if (token.startsWith("'")) return JSON.stringify(decodeSingleQuoted(token));
      if (token.startsWith(',')) return '';
      return JSON.stringify(token);
    },
  );
  const result = JSON.parse(json);
  if (!Array.isArray(result)) throw new Error('A fonte precisa conter uma lista.');
  return result;
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function jsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const paths = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await jsonFiles(path)));
    else if (entry.name.endsWith('.json')) paths.push(path);
  }
  return paths;
}

export async function loadQuestions(directory) {
  const questions = [];
  for (const path of await jsonFiles(directory)) {
    const records = await readJson(path, []);
    if (!Array.isArray(records)) throw new Error(`Lista esperada: ${path}`);
    questions.push(...records);
  }
  return questions;
}

export async function updateSource(root, source) {
  const path = join(root, 'data/sources.json');
  const manifest = await readJson(path, { schemaVersion: 1, sources: [] });
  manifest.sources = manifest.sources.filter((entry) => entry.id !== source.id);
  manifest.sources.push(source);
  manifest.sources.sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(path, manifest);
}

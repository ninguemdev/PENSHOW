import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const PROJECT_ROOT = new URL('../../', import.meta.url);

export function normalizedPrompt(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function questionKey(question) {
  return `${question.locale}:${normalizedPrompt(question.prompt)}`;
}

export function questionId(sourceId, category, prompt) {
  const hash = createHash('sha256').update(normalizedPrompt(prompt)).digest('hex').slice(0, 16);
  return `${sourceId}:${category}:${hash}`;
}

function decodeSingleQuoted(token) {
  let result = '';
  const escapes = { "'": "'", '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
  for (let index = 1; index < token.length - 1; index++) {
    const character = token[index];
    if (character !== '\\') { result += character; continue; }
    const escaped = token[++index];
    if (Object.hasOwn(escapes, escaped)) result += escapes[escaped];
    else if (escaped === 'u' || escaped === 'x') {
      const size = escaped === 'u' ? 4 : 2;
      const digits = token.slice(index + 1, index + 1 + size);
      if (!new RegExp(`^[0-9a-fA-F]{${size}}$`, 'u').test(digits)) throw new Error('Escape inválido.');
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

export function validateQuestion(question) {
  const errors = [];
  if (!question || typeof question !== 'object' || Array.isArray(question)) return ['Registro inválido'];
  for (const field of ['id', 'category', 'locale', 'prompt']) {
    if (typeof question[field] !== 'string' || !question[field].trim()) errors.push(`Campo inválido: ${field}`);
  }
  if (!['multiple', 'boolean'].includes(question.type)) errors.push('Tipo inválido');
  if (!['needs-review', 'needs-translation', 'approved', 'rejected'].includes(question.status)) errors.push('Status inválido');
  if (!['easy', 'medium', 'hard', 'unrated'].includes(question.difficulty)) errors.push('Dificuldade inválida');
  if (question.status === 'approved' && question.locale !== 'pt-BR') errors.push('Conteúdo aprovado precisa estar em pt-BR');
  if (question.status === 'approved' && (!question.review?.referenceUrl || !question.review?.reviewedAt)) {
    errors.push('Conteúdo aprovado precisa de referência e data da revisão');
  }
  const expectedOptions = question.type === 'boolean' ? 2 : 4;
  if (!Array.isArray(question.options) || question.options.length !== expectedOptions) {
    errors.push(`Esperadas ${expectedOptions} alternativas`);
  }
  const options = Array.isArray(question.options) ? question.options : [];
  const ids = new Set();
  const texts = new Set();
  for (const option of options) {
    if (!option || typeof option.id !== 'string' || !option.id || typeof option.text !== 'string' || !option.text.trim()) {
      errors.push('Alternativa inválida');
      continue;
    }
    if (ids.has(option.id)) errors.push('ID de alternativa repetido');
    ids.add(option.id);
    const text = normalizedPrompt(option.text);
    if (texts.has(text)) errors.push('Texto de alternativa repetido');
    texts.add(text);
  }
  if (typeof question.correctOptionId !== 'string' || !ids.has(question.correctOptionId)) errors.push('Gabarito inválido');
  if (!question.source || typeof question.source.id !== 'string' || typeof question.source.url !== 'string'
      || typeof question.source.license !== 'string' || !Number.isInteger(question.source.recordIndex)
      || question.source.recordIndex < 0) errors.push('Procedência incompleta');
  return errors;
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function jsonFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const paths = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await jsonFiles(path));
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

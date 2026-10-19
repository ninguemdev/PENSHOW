import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  approvedQuestionSchema,
  editorialSlugSchema,
  normalizeQuestionText,
  sourceUrlSchema,
} from './editorial-question.schema.ts';

export const CATALOG_SCHEMA_VERSION = 1;
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const countSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const catalogSourceSchema = z.strictObject({
  id: editorialSlugSchema,
  title: z.string().trim().min(1).max(256),
  url: sourceUrlSchema,
  license: z.string().trim().min(1).max(128),
  licenseText: z
    .string()
    .min(1)
    .max(262144)
    .refine((value) => value.trim().length > 0),
  licenseSha256: sha256Schema,
});
const availabilitySchema = z.record(
  editorialSlugSchema,
  z.strictObject({ easy: countSchema, medium: countSchema, hard: countSchema, total: countSchema }),
);
export type QuestionAvailability = z.infer<typeof availabilitySchema>;
export type CatalogSource = z.infer<typeof catalogSourceSchema>;
type CatalogQuestion = z.infer<typeof approvedQuestionSchema>;

// Keys and input lists have an explicit order, independent of locale, wall clock and absolute paths.
export function stableJson(value: unknown): string {
  return `${JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (item && typeof item === 'object' && !Array.isArray(item))
        return Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        );
      return item;
    },
    2,
  )}\n`;
}
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function catalogAvailability(questions: readonly CatalogQuestion[]): QuestionAvailability {
  const groups = new Map<string, { easy: number; medium: number; hard: number; total: number }>();
  for (const question of questions) {
    const counts = groups.get(question.category) ?? { easy: 0, medium: 0, hard: 0, total: 0 };
    counts[question.difficulty]++;
    counts.total++;
    groups.set(question.category, counts);
  }
  return Object.fromEntries([...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
export function catalogManifest(
  questions: readonly CatalogQuestion[],
  sources: readonly CatalogSource[],
) {
  return {
    questionCount: questions.length,
    availability: catalogAvailability(questions),
    contentSha256: sha256(stableJson({ questions, sources })),
  };
}
export const publishedCatalogSchema = z
  .strictObject({
    schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
    manifest: z.strictObject({
      questionCount: countSchema,
      availability: availabilitySchema,
      contentSha256: sha256Schema,
    }),
    sources: z.array(catalogSourceSchema).max(100),
    questions: z.array(approvedQuestionSchema).max(100000),
  })
  .superRefine((catalog, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });
    const ids = catalog.questions.map((question) => question.id);
    const prompts = catalog.questions.map((question) => normalizeQuestionText(question.prompt));
    const sourceIds = catalog.sources.map((source) => source.id);
    if (new Set(ids).size !== ids.length || new Set(prompts).size !== prompts.length)
      fail('Perguntas duplicadas no catálogo.');
    if (
      stableJson([...ids].sort()) !== stableJson(ids) ||
      stableJson([...sourceIds].sort()) !== stableJson(sourceIds)
    )
      fail('Ordem não canônica no catálogo.');
    if (new Set(sourceIds).size !== sourceIds.length) fail('Fontes duplicadas no catálogo.');
    const sources = new Map(catalog.sources.map((source) => [source.id, source]));
    for (const question of catalog.questions) {
      if (sources.get(question.source.id)?.license !== question.source.license)
        fail('Procedência ou licença divergente no catálogo.');
    }
    for (const source of catalog.sources) {
      if (
        !catalog.questions.some((question) => question.source.id === source.id) ||
        sha256(source.licenseText) !== source.licenseSha256
      )
        fail('Atribuição ou texto da licença inválido.');
    }
    if (
      stableJson(catalog.manifest) !==
      stableJson(catalogManifest(catalog.questions, catalog.sources))
    )
      fail('Manifesto ou integridade do catálogo divergente.');
  });
export type PublishedCatalog = z.infer<typeof publishedCatalogSchema>;

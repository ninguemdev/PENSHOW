import { z } from 'zod';

export function normalizeQuestionText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export const editorialSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
export const sourceUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !/[\p{Cc}\p{Cf}\s]/u.test(value)
      );
    } catch {
      return false;
    }
  }, 'Referência precisa ser uma URL HTTP(S) sem credenciais.');
export const reviewDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Data de revisão inválida; use AAAA-MM-DD.');

export const questionSourceSchema = z.strictObject({
  id: editorialSlugSchema,
  url: sourceUrlSchema,
  recordIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  license: z.string().trim().min(1).max(128),
  category: z.string().trim().min(1).max(128).optional(),
});
export const editorialReviewSchema = z.strictObject({
  referenceUrl: sourceUrlSchema,
  reviewedAt: reviewDateSchema,
  checks: z.strictObject({
    factual: z.literal(true),
    language: z.literal(true),
    uniqueAnswer: z.literal(true),
  }),
});
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        !/[\p{Cc}\p{Cf}]|<[^>]+>|&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/iu.test(value) &&
        normalizeQuestionText(value).length > 0,
      'Texto deve estar legível, sem HTML ou caracteres de controle.',
    );
const fields = {
  id: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-z0-9][a-z0-9:._-]*$/u),
  category: editorialSlugSchema,
  type: z.enum(['multiple', 'boolean']),
  prompt: text(2000),
  options: z
    .array(
      z.strictObject({
        id: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/u),
        text: text(500),
      }),
    )
    .max(4),
  correctOptionId: z.string().min(1).max(128),
  source: questionSourceSchema,
  explanation: text(2000).optional(),
};
export const approvedQuestionFieldsSchema = z.strictObject({
  ...fields,
  status: z.literal('approved'),
  locale: z.literal('pt-BR'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  review: editorialReviewSchema,
});
function validateOptions(
  question: { type: string; options: { id: string; text: string }[]; correctOptionId: string },
  context: z.RefinementCtx,
) {
  const expected = question.type === 'boolean' ? 2 : 4;
  if (question.options.length !== expected)
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: `Esperadas ${expected} alternativas`,
    });
  if (new Set(question.options.map((option) => option.id)).size !== question.options.length)
    context.addIssue({ code: 'custom', path: ['options'], message: 'ID de alternativa repetido' });
  if (
    new Set(question.options.map((option) => normalizeQuestionText(option.text))).size !==
    question.options.length
  )
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Texto de alternativa repetido',
    });
  if (!question.options.some((option) => option.id === question.correctOptionId))
    context.addIssue({ code: 'custom', path: ['correctOptionId'], message: 'Gabarito inválido' });
}
export const approvedQuestionSchema = approvedQuestionFieldsSchema.superRefine(validateOptions);
export const editorialQuestionSchema = z
  .discriminatedUnion('status', [
    approvedQuestionFieldsSchema,
    z.strictObject({
      ...fields,
      status: z.enum(['needs-review', 'needs-translation', 'rejected']),
      locale: z.enum(['pt-BR', 'en']),
      difficulty: z.enum(['easy', 'medium', 'hard', 'unrated']),
      review: editorialReviewSchema.optional(),
    }),
  ])
  .superRefine(validateOptions);

export function validateEditorialQuestion(value: unknown): string[] {
  const result = editorialQuestionSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((issue) =>
        issue.code === 'custom'
          ? issue.message
          : `Campo inválido: ${issue.path.join('.') || 'registro'}`,
      );
}

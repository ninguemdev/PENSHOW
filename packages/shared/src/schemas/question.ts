import { z } from 'zod';
import { categoryIdSchema, optionIdSchema, questionIdSchema } from './identifiers.js';

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
const questionFields = {
  questionId: questionIdSchema,
  category: categoryIdSchema,
  locale: z.literal('pt-BR'),
  prompt: z.string().trim().min(1).max(2000),
  difficulty: difficultySchema,
};

export const publicOptionSchema = z.strictObject({
  optionId: optionIdSchema,
  text: z.string().trim().min(1).max(500),
});

export const questionStemSchema = z.strictObject({
  ...questionFields,
  type: z.enum(['multiple', 'boolean']),
});

export const publicQuestionSchema = z
  .discriminatedUnion('type', [
    z.strictObject({
      ...questionFields,
      type: z.literal('multiple'),
      options: z.array(publicOptionSchema).length(4),
    }),
    z.strictObject({
      ...questionFields,
      type: z.literal('boolean'),
      options: z.array(publicOptionSchema).length(2),
    }),
  ])
  .superRefine((question, context) => {
    const ids = question.options.map((option) => option.optionId);
    const texts = question.options.map((option) =>
      option.text
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim(),
    );
    if (
      new Set(ids).size !== ids.length ||
      new Set(texts).size !== texts.length ||
      texts.some((text) => text.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'As alternativas precisam ter IDs e textos distintos.',
      });
    }
  });

export const revealedQuestionSchema = z
  .strictObject({
    question: publicQuestionSchema,
    correctOptionId: optionIdSchema,
    explanation: z.string().trim().min(1).max(2000).nullable(),
  })
  .refine(
    (reveal) =>
      reveal.question.options.some((option) => option.optionId === reveal.correctOptionId),
    'O gabarito precisa corresponder a uma alternativa pública.',
  );

export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
export type PublicOption = z.infer<typeof publicOptionSchema>;
export type QuestionStem = z.infer<typeof questionStemSchema>;
export type RevealedQuestion = z.infer<typeof revealedQuestionSchema>;

import {
  CONFIRMED_FINAL_RULES,
  PENDING_DECISIONS,
  matchIdSchema,
  type MatchId,
} from '@penshow/shared';
import { z } from 'zod';

const points = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const duration = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const demand = z
  .strictObject({
    easy: z.number().int().min(0).max(100_000),
    medium: z.number().int().min(0).max(100_000),
    hard: z.number().int().min(0).max(100_000),
  })
  .refine((counts) => counts.easy + counts.medium + counts.hard > 0);
const questionRules = {
  questions: demand,
  correctPoints: points,
  responseMs: duration,
  revealMs: duration,
};

export const prototypeParametersSchema = z.strictObject({
  version: z.literal('prototype-v1'),
  status: z.literal('experimental'),
  timings: z.strictObject({
    instructionsMs: duration,
    categoryChoiceMs: duration,
    readingMs: duration,
    transitionMs: duration,
    roundResultsMs: duration,
  }),
  selection: z.strictObject({ maximumCategoryOptions: z.number().int().min(1).max(4) }),
  classic: z.strictObject(questionRules),
  speed: z
    .strictObject({
      ...questionRules,
      bonusBands: z
        .array(z.strictObject({ beforeMs: duration, points }))
        .min(1)
        .max(16),
    })
    .superRefine((speed, context) => {
      const bands = speed.bonusBands;
      if (
        bands.at(-1)?.beforeMs !== speed.responseMs ||
        bands.some(
          (band, index) =>
            index > 0 &&
            (band.beforeMs <= bands[index - 1]!.beforeMs || band.points > bands[index - 1]!.points),
        )
      )
        context.addIssue({
          code: 'custom',
          message:
            'Faixas devem ser crescentes no tempo, não crescentes em bônus e cobrir o prazo de resposta.',
        });
    }),
  wager: z.strictObject({
    ...questionRules,
    selectionMs: duration,
    allowedAmounts: z
      .array(points)
      .min(1)
      .max(16)
      .refine(
        (amounts) =>
          amounts[0] === 0 &&
          amounts.every((amount, index) => index === 0 || amount > amounts[index - 1]!),
      ),
  }),
  theft: z.strictObject({
    ...questionRules,
    maximumTransfer: points,
    targetSelectionMs: duration,
    policy: z.strictObject({
      status: z.enum(['prototype', 'confirmed']),
      decisionId: z.literal('D05'),
      eligible: z.literal('first-correct-only'),
    }),
  }),
  pressure: z.strictObject({
    turnDifficulties: z
      .array(z.enum(['easy', 'medium', 'hard']))
      .min(1)
      .max(16),
    correctPoints: points,
    wrongPenalty: points,
    responseMs: duration,
    revealMs: duration,
    policy: z.strictObject({
      status: z.enum(['prototype', 'confirmed']),
      decisionId: z.literal('D04'),
      mode: z.literal('dynamite'),
    }),
  }),
  final: z.strictObject({
    reserveQuestions: z
      .number()
      .int()
      .min(2)
      .max(100_000)
      .refine((count) => count % 2 === 0),
    responseMs: duration,
    targetSelectionMs: duration,
    revealMs: duration,
  }),
});
export type PrototypeParameters = z.infer<typeof prototypeParametersSchema>;
export type DeepReadonly<T> = T extends
  string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
function freezeDeep<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Server-owned configuration, including confirmed D04/D05 gameplay policies. */
export const PROTOTYPE_PARAMETERS = freezeDeep(
  prototypeParametersSchema.parse({
    version: 'prototype-v1',
    status: 'experimental',
    timings: {
      instructionsMs: 15_000,
      categoryChoiceMs: 10_000,
      readingMs: 3_000,
      transitionMs: 1_000,
      roundResultsMs: 8_000,
    },
    selection: { maximumCategoryOptions: 4 },
    classic: {
      questions: { easy: 3, medium: 3, hard: 0 },
      correctPoints: 100,
      responseMs: 15_000,
      revealMs: 4_000,
    },
    speed: {
      questions: { easy: 2, medium: 3, hard: 1 },
      correctPoints: 100,
      responseMs: 15_000,
      revealMs: 4_000,
      bonusBands: [
        { beforeMs: 5_000, points: 50 },
        { beforeMs: 10_000, points: 25 },
        { beforeMs: 15_000, points: 0 },
      ],
    },
    wager: {
      questions: { easy: 2, medium: 2, hard: 2 },
      correctPoints: 100,
      responseMs: 15_000,
      revealMs: 4_000,
      selectionMs: 6_000,
      allowedAmounts: [0, 25, 50],
    },
    theft: {
      questions: { easy: 2, medium: 2, hard: 2 },
      correctPoints: 100,
      responseMs: 15_000,
      revealMs: 4_000,
      maximumTransfer: 100,
      targetSelectionMs: 6_000,
      policy: { status: 'confirmed', decisionId: 'D05', eligible: 'first-correct-only' },
    },
    pressure: {
      turnDifficulties: ['medium', 'hard'],
      correctPoints: 300,
      wrongPenalty: 150,
      responseMs: 10_000,
      revealMs: 3_000,
      policy: { status: 'confirmed', decisionId: 'D04', mode: 'dynamite' },
    },
    final: { reserveQuestions: 50, responseMs: 15_000, targetSelectionMs: 6_000, revealMs: 4_000 },
  }),
);

export interface FrozenMatchRules {
  readonly matchId: MatchId;
  readonly parameters: DeepReadonly<PrototypeParameters>;
  readonly confirmedFinal: typeof CONFIRMED_FINAL_RULES;
  readonly pendingDecisions: typeof PENDING_DECISIONS;
}
export class RulesConfigurationError extends Error {
  constructor() {
    super('Configuração experimental de regras inválida.');
    this.name = 'RulesConfigurationError';
  }
}
export function freezeMatchRules(
  matchId: MatchId,
  rawParameters: unknown = PROTOTYPE_PARAMETERS,
): FrozenMatchRules {
  const identity = matchIdSchema.safeParse(matchId);
  const parsed = prototypeParametersSchema.safeParse(rawParameters);
  if (!identity.success || !parsed.success) throw new RulesConfigurationError();
  return freezeDeep({
    matchId: identity.data,
    parameters: parsed.data,
    confirmedFinal: CONFIRMED_FINAL_RULES,
    pendingDecisions: PENDING_DECISIONS,
  });
}

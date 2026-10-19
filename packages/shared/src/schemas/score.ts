import { z } from 'zod';
import { CONFIRMED_FINAL_RULES } from '../domain/rules.js';
import { nonnegativeIntegerSchema, playerIdSchema } from './identifiers.js';

export const scoreEntrySchema = z.strictObject({
  playerId: playerIdSchema,
  points: nonnegativeIntegerSchema,
  correctAnswers: nonnegativeIntegerSchema,
});

export const scoreboardSchema = z
  .array(scoreEntrySchema)
  .min(2)
  .max(12)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.playerId)).size === entries.length,
    'O placar não pode repetir participantes.',
  );

export const rankingSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('pending-tiebreak'),
    decisionId: z.literal('D06'),
    scores: scoreboardSchema,
  }),
  z.strictObject({
    status: z.literal('resolved'),
    entries: z
      .array(scoreEntrySchema.extend({ rank: z.number().int().min(1).max(12) }))
      .min(2)
      .max(12)
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.playerId)).size === entries.length &&
          entries.every(
            (entry, index) =>
              entry.rank === index + 1 &&
              (index === 0 || (entries[index - 1]?.points ?? 0) >= entry.points),
          ),
        'A classificação precisa ter participantes únicos, posições consecutivas e pontos decrescentes.',
      ),
  }),
]);

const finalistFields = {
  playerId: playerIdSchema,
  rank: z.number().int().min(1).max(12),
  initialLives: z.union([z.literal(5), z.literal(4), z.literal(3), z.literal(2)]),
};
export const finalistSchema = z
  .discriminatedUnion('status', [
    z.strictObject({
      ...finalistFields,
      status: z.literal('active'),
      lives: z.number().int().min(1).max(5),
    }),
    z.strictObject({
      ...finalistFields,
      status: z.literal('eliminated'),
      lives: z.literal(0),
      eliminationOrder: z.number().int().min(1).max(11),
    }),
  ])
  .refine(
    (player) =>
      player.initialLives ===
        CONFIRMED_FINAL_RULES.initialLivesByRank[Math.min(player.rank, 4) - 1] &&
      player.lives <= player.initialLives,
    'As vidas iniciais seguem 5/4/3/2 e as vidas restantes não podem superá-las.',
  );

export const finalistsSchema = z
  .array(finalistSchema)
  .min(2)
  .max(12)
  .superRefine((players, context) => {
    const ranks = players.map((player) => player.rank).sort((left, right) => left - right);
    const eliminated = players
      .filter((player) => player.status === 'eliminated')
      .map((player) => player.eliminationOrder)
      .sort((left, right) => left - right);
    if (
      new Set(players.map((player) => player.playerId)).size !== players.length ||
      !ranks.every((rank, index) => rank === index + 1) ||
      !eliminated.every((order, index) => order === index + 1) ||
      !players.some((player) => player.status === 'active')
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A final precisa de jogadores e posições únicos, eliminações consecutivas e ao menos um sobrevivente.',
      });
    }
  });

export const scoreEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('credit'),
    playerId: playerIdSchema,
    amount: nonnegativeIntegerSchema,
    reason: z.enum(['correct-answer', 'speed-bonus', 'wager', 'theft']),
  }),
  z.strictObject({
    kind: z.literal('debit'),
    playerId: playerIdSchema,
    amount: nonnegativeIntegerSchema,
    reason: z.enum(['wager', 'theft', 'pressure']),
  }),
]);

export type ScoreEntry = z.infer<typeof scoreEntrySchema>;
export type Scoreboard = z.infer<typeof scoreboardSchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type Finalist = z.infer<typeof finalistSchema>;
export type ScoreEffect = z.infer<typeof scoreEffectSchema>;

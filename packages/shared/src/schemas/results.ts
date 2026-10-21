import { z } from 'zod';
import { nonnegativeIntegerSchema, playerIdSchema } from './identifiers.js';
import { scoringRoundSchema } from './settings.js';

export const roundSummarySchema = z
  .strictObject({
    round: scoringRoundSchema,
    status: z.enum(['completed', 'interrupted']),
    questionsPlayed: nonnegativeIntegerSchema,
    players: z
      .array(
        z.strictObject({
          playerId: playerIdSchema,
          pointsBefore: nonnegativeIntegerSchema,
          pointsAfter: nonnegativeIntegerSchema,
          pointsDelta: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
          correctAnswers: nonnegativeIntegerSchema,
        }),
      )
      .min(2)
      .max(12),
  })
  .superRefine((summary, context) => {
    if (
      new Set(summary.players.map((player) => player.playerId)).size !== summary.players.length ||
      summary.players.some(
        (player) =>
          player.pointsAfter - player.pointsBefore !== player.pointsDelta ||
          player.correctAnswers > summary.questionsPlayed,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'O resumo precisa conservar os participantes e os resultados da fase.',
      });
  });
export type RoundSummary = z.infer<typeof roundSummarySchema>;

import { z } from 'zod';
import { categoryIdSchema, roundIdSchema } from './identifiers.js';
import { ROOM_LIMITS } from '../domain/rooms.js';

export const roomSettingsSchema = z.strictObject({
  format: z.literal('prototype-v1'),
  maxPlayers: z.number().int().min(ROOM_LIMITS.minPlayers).max(ROOM_LIMITS.maxPlayers),
  enabledCategories: z
    .array(categoryIdSchema)
    .min(1)
    .max(32)
    .refine((ids) => new Set(ids).size === ids.length, 'Os temas não podem se repetir.'),
});

export const pressureVariantSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending'), decisionId: z.literal('D04') }),
  z.strictObject({
    status: z.literal('prototype'),
    decisionId: z.literal('D04'),
    mode: z.literal('dynamite'),
  }),
]);

export const classicRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(1),
  mode: z.literal('classic'),
});
export const speedRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(2),
  mode: z.literal('speed'),
});
export const wagerRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(3),
  mode: z.literal('wager'),
});
export const theftRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(4),
  mode: z.literal('theft'),
});
export const pressureRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(5),
  mode: z.literal('pressure'),
  variant: pressureVariantSchema,
});
export const finalRoundSchema = z.strictObject({
  roundId: roundIdSchema,
  index: z.literal(6),
  mode: z.literal('final'),
});

export const scoringRoundSchema = z.discriminatedUnion('mode', [
  classicRoundSchema,
  speedRoundSchema,
  wagerRoundSchema,
  theftRoundSchema,
  pressureRoundSchema,
]);
export const roundSchema = z.discriminatedUnion('mode', [
  ...scoringRoundSchema.options,
  finalRoundSchema,
]);

export type RoomSettings = z.infer<typeof roomSettingsSchema>;
export type Round = z.infer<typeof roundSchema>;
export type ScoringRound = z.infer<typeof scoringRoundSchema>;
export type ScoringMode = ScoringRound['mode'];

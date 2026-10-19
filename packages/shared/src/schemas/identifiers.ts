import { z } from 'zod';
import { ROOM_LIMITS } from '../domain/rooms.js';

export const playerIdSchema = z.uuidv4().brand<'PlayerId'>();
export const roomIdSchema = z.uuidv4().brand<'RoomId'>();
export const matchIdSchema = z.uuidv4().brand<'MatchId'>();
export const roundIdSchema = z.uuidv4().brand<'RoundId'>();
export const questionIdSchema = z.uuidv4().brand<'QuestionId'>();
export const optionIdSchema = z.uuidv4().brand<'OptionId'>();
export const actionIdSchema = z.uuidv4().brand<'ActionId'>();

export const roomCodeSchema = z
  .string()
  .regex(new RegExp(`^[${ROOM_LIMITS.codeAlphabet}]{${ROOM_LIMITS.codeLength}}$`, 'u'));
export const categoryIdSchema = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
export const timestampSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const stateVersionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const nonnegativeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const playerIdsSchema = z
  .array(playerIdSchema)
  .max(ROOM_LIMITS.maxPlayers)
  .refine((ids) => new Set(ids).size === ids.length, 'Os participantes não podem se repetir.');

export type PlayerId = z.infer<typeof playerIdSchema>;
export type RoomId = z.infer<typeof roomIdSchema>;
export type MatchId = z.infer<typeof matchIdSchema>;
export type RoundId = z.infer<typeof roundIdSchema>;
export type QuestionId = z.infer<typeof questionIdSchema>;
export type OptionId = z.infer<typeof optionIdSchema>;
export type ActionId = z.infer<typeof actionIdSchema>;

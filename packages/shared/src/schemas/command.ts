import { z } from 'zod';
import {
  actionIdSchema,
  categoryIdSchema,
  matchIdSchema,
  nonnegativeIntegerSchema,
  optionIdSchema,
  playerIdSchema,
  questionIdSchema,
  roomCodeSchema,
  roomIdSchema,
  roundIdSchema,
  timestampSchema,
} from './identifiers.js';
import { playerProfileSchema } from './profile.js';
import { roomSettingsSchema } from './settings.js';
import { tiebreakInputSchema, tiebreakContextSchema } from './tiebreak.js';

const envelope = { protocolVersion: z.literal(1), actionId: actionIdSchema };
const roomContext = { roomId: roomIdSchema };
const matchContext = { ...roomContext, matchId: matchIdSchema };
const roundContext = { ...matchContext, roundId: roundIdSchema };
const questionContext = { ...roundContext, questionId: questionIdSchema };

export const clientCommandSchema = z.discriminatedUnion('event', [
  z.strictObject({
    ...envelope,
    event: z.literal('tiebreak:input'),
    payload: tiebreakInputSchema.extend(roundContext),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('tiebreak:answer'),
    payload: tiebreakContextSchema.extend({ ...questionContext, optionId: optionIdSchema }),
  }),
  z.strictObject({ ...envelope, event: z.literal('room:sync'), payload: z.strictObject({}) }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:create'),
    payload: z.strictObject({ profile: playerProfileSchema, settings: roomSettingsSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:join'),
    payload: z.strictObject({ code: roomCodeSchema, profile: playerProfileSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:leave'),
    payload: z.strictObject(roomContext),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:updateProfile'),
    payload: z.strictObject({ ...roomContext, profile: playerProfileSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:updateSettings'),
    payload: z.strictObject({ ...roomContext, settings: roomSettingsSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('room:kick'),
    payload: z.strictObject({ ...roomContext, targetPlayerId: playerIdSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('match:start'),
    payload: z.strictObject({
      ...roomContext,
      mode: z.enum(['classic', 'speed', 'wager', 'theft', 'pressure']).optional(),
    }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('round:ready'),
    payload: z.strictObject(roundContext),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('final:start'),
    payload: z.strictObject(matchContext),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('category:choose'),
    payload: z.strictObject({ ...roundContext, category: categoryIdSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('answer:submit'),
    payload: z.strictObject({ ...questionContext, optionId: optionIdSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('wager:submit'),
    payload: z.strictObject({ ...questionContext, amount: nonnegativeIntegerSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('target:choose'),
    payload: z.strictObject({ ...questionContext, targetPlayerId: playerIdSchema }),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('match:returnToLobby'),
    payload: z.strictObject(matchContext),
  }),
  z.strictObject({
    ...envelope,
    event: z.literal('time:sync'),
    payload: z.strictObject({ clientSentAt: timestampSchema }),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ClientEvent = ClientCommand['event'];
export type CommandOf<Event extends ClientEvent> = Extract<ClientCommand, { event: Event }>;

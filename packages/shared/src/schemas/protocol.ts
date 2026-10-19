import { z } from 'zod';
import { domainErrorSchema } from './error.js';
import {
  actionIdSchema,
  matchIdSchema,
  playerIdSchema,
  roomCodeSchema,
  roomIdSchema,
  stateVersionSchema,
  timestampSchema,
} from './identifiers.js';
import { roomViewSchema } from './view.js';
import { sessionEndedSchema } from './session.js';
import { roomRemovedSchema } from './room-removed.js';

export const PROTOCOL_VERSION = 1;
const successful = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  actionId: actionIdSchema,
  status: z.literal('ok'),
};
const roomEntry = z.strictObject({
  roomId: roomIdSchema,
  code: roomCodeSchema,
  playerId: playerIdSchema,
  stateVersion: stateVersionSchema,
});
const mutation = z.strictObject({ stateVersion: stateVersionSchema });

export const commandSuccessSchema = z.discriminatedUnion('event', [
  z.strictObject({ ...successful, event: z.literal('room:create'), result: roomEntry }),
  z.strictObject({ ...successful, event: z.literal('room:join'), result: roomEntry }),
  z.strictObject({ ...successful, event: z.literal('room:leave'), result: z.strictObject({}) }),
  z.strictObject({ ...successful, event: z.literal('room:updateProfile'), result: mutation }),
  z.strictObject({ ...successful, event: z.literal('room:updateSettings'), result: mutation }),
  z.strictObject({ ...successful, event: z.literal('room:kick'), result: mutation }),
  z.strictObject({
    ...successful,
    event: z.literal('match:start'),
    result: z.strictObject({ matchId: matchIdSchema, stateVersion: stateVersionSchema }),
  }),
  z.strictObject({ ...successful, event: z.literal('round:ready'), result: mutation }),
  z.strictObject({ ...successful, event: z.literal('category:choose'), result: mutation }),
  z.strictObject({
    ...successful,
    event: z.literal('answer:submit'),
    result: z.strictObject({
      stateVersion: stateVersionSchema,
      acceptance: z.enum(['recorded', 'first-valid']),
    }),
  }),
  z.strictObject({ ...successful, event: z.literal('wager:submit'), result: mutation }),
  z.strictObject({ ...successful, event: z.literal('target:choose'), result: mutation }),
  z.strictObject({ ...successful, event: z.literal('match:returnToLobby'), result: mutation }),
  z.strictObject({
    ...successful,
    event: z.literal('time:sync'),
    result: z
      .strictObject({
        clientSentAt: timestampSchema,
        serverReceivedAt: timestampSchema,
        serverSentAt: timestampSchema,
      })
      .refine(
        (result) => result.serverSentAt >= result.serverReceivedAt,
        'A resposta não pode preceder a recepção no servidor.',
      ),
  }),
]);

export const acknowledgementSchema = z.union([
  commandSuccessSchema,
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    actionId: actionIdSchema.nullable(),
    status: z.literal('error'),
    error: domainErrorSchema,
  }),
]);

export const serverEventSchema = z.discriminatedUnion('event', [
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    event: z.literal('room:removed'),
    payload: roomRemovedSchema,
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    event: z.literal('room:view'),
    payload: roomViewSchema,
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    event: z.literal('session:ended'),
    payload: sessionEndedSchema,
  }),
]);

export type Acknowledgement = z.infer<typeof acknowledgementSchema>;
export type CommandSuccess = z.infer<typeof commandSuccessSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;

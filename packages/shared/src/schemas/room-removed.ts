import { z } from 'zod';
import { roomIdSchema, stateVersionSchema } from './identifiers.js';

export const roomRemovedSchema = z.strictObject({
  roomId: roomIdSchema,
  stateVersion: stateVersionSchema,
  reason: z.enum(['left', 'kicked', 'closed']),
});
export type RoomRemoved = z.infer<typeof roomRemovedSchema>;

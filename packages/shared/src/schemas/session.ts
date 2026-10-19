import { z } from 'zod';
import { playerIdSchema, timestampSchema } from './identifiers.js';

export const GUEST_SESSION_STORAGE_KEY = 'penshow.session';
export const guestSessionTokenSchema = z
  .string()
  .regex(/^penshow_v1_[A-Za-z0-9_-]{43}$/u)
  .brand<'GuestSessionToken'>();
export const createGuestSessionRequestSchema = z.strictObject({});
export const guestSessionParamsSchema = z.strictObject({ playerId: playerIdSchema });
export const guestSessionSchema = z.strictObject({
  scope: z.literal('penshow'),
  playerId: playerIdSchema,
  expiresAt: timestampSchema,
});
export const issuedGuestSessionSchema = guestSessionSchema.extend({
  token: guestSessionTokenSchema,
});
export const socketCredentialsSchema = z.union([
  z.strictObject({}),
  z.strictObject({ token: guestSessionTokenSchema }),
]);
export const sessionEndedSchema = z.strictObject({ reason: z.enum(['replaced', 'expired']) });

export type GuestSessionToken = z.infer<typeof guestSessionTokenSchema>;
export type GuestSession = z.infer<typeof guestSessionSchema>;
export type IssuedGuestSession = z.infer<typeof issuedGuestSessionSchema>;
export type SocketCredentials = z.infer<typeof socketCredentialsSchema>;

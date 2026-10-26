import { z } from 'zod';
import { playerIdSchema, timestampSchema } from './identifiers.js';
import { isValidAvatar } from '../avatar/catalog.js';
import { avatarLayoutSchema } from '../avatar/layout.js';

export const nicknameSchema = z
  .string()
  .max(256)
  .refine((text) => !/[\p{Cc}\p{Cf}]/u.test(text), 'O apelido contém caracteres de controle.')
  .transform((text) => text.normalize('NFC').trim().replace(/\s+/gu, ' '))
  .refine(
    (text) => [...text].length >= 1 && [...text].length <= 20,
    'O apelido precisa ter de 1 a 20 caracteres.',
  );

const avatarPartIdSchema = z
  .string()
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u);
export const avatarSchema = z
  .strictObject({
    head: avatarPartIdSchema,
    eyes: avatarPartIdSchema,
    mouth: avatarPartIdSchema,
    cheeks: avatarPartIdSchema.nullable(),
    faceAccessory: avatarPartIdSchema.nullable(),
    hat: avatarPartIdSchema.nullable(),
    hair: avatarPartIdSchema.nullable().optional(),
    layout: avatarLayoutSchema.optional(),
  })
  .refine(isValidAvatar, 'O personagem contém peças que não pertencem ao catálogo.');

export const playerProfileSchema = z.strictObject({
  nickname: nicknameSchema,
  avatar: avatarSchema,
});
export const connectionSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('connected') }),
  z.strictObject({ status: z.literal('disconnected'), since: timestampSchema }),
]);

const memberFields = {
  playerId: playerIdSchema,
  profile: playerProfileSchema,
  connection: connectionSchema,
};
export const roomMemberSchema = z.discriminatedUnion('role', [
  z.strictObject({ ...memberFields, role: z.literal('player'), isHost: z.boolean() }),
  z.strictObject({ ...memberFields, role: z.literal('spectator'), isHost: z.literal(false) }),
]);

export type Avatar = z.infer<typeof avatarSchema>;
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
export type RoomMember = z.infer<typeof roomMemberSchema>;

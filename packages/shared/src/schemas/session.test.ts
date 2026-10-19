import { describe, expect, it } from 'vitest';
import { serverEventSchema } from './protocol.js';
import {
  createGuestSessionRequestSchema,
  guestSessionSchema,
  guestSessionTokenSchema,
  issuedGuestSessionSchema,
  socketCredentialsSchema,
} from './session.js';

const token = `penshow_v1_${'a'.repeat(43)}`;
const session = {
  scope: 'penshow',
  playerId: '00000000-0000-4000-8000-000000000001',
  expiresAt: 86401000,
};

describe('contratos de sessão de convidado', () => {
  it('aceita token próprio apenas na emissão e nas credenciais do socket', () => {
    expect(issuedGuestSessionSchema.safeParse({ ...session, token }).success).toBe(true);
    expect(guestSessionSchema.safeParse(session).success).toBe(true);
    expect(guestSessionSchema.safeParse({ ...session, token }).success).toBe(false);
    expect(socketCredentialsSchema.safeParse({ token }).success).toBe(true);
    expect(socketCredentialsSchema.safeParse({}).success).toBe(true);
  });
  it.each([
    '',
    'x'.repeat(54),
    'comicle_v1_' + 'a'.repeat(43),
    'penshow_v1_' + 'a'.repeat(42),
    'penshow_v1_' + 'a'.repeat(44),
    'penshow_v1_' + '/'.repeat(43),
  ])('recusa token fora do namespace ou formato: %j', (value) => {
    expect(guestSessionTokenSchema.safeParse(value).success).toBe(false);
  });
  it('não recebe nome ou identidade escolhida pelo cliente', () => {
    expect(createGuestSessionRequestSchema.safeParse({}).success).toBe(true);
    expect(createGuestSessionRequestSchema.safeParse({ nickname: 'Ana' }).success).toBe(false);
    expect(createGuestSessionRequestSchema.safeParse({ playerId: session.playerId }).success).toBe(
      false,
    );
    expect(socketCredentialsSchema.safeParse({ token, playerId: session.playerId }).success).toBe(
      false,
    );
    expect(socketCredentialsSchema.safeParse({ nickname: 'Ana' }).success).toBe(false);
    expect(guestSessionSchema.safeParse({ ...session, scope: 'comicle' }).success).toBe(false);
    expect(guestSessionSchema.safeParse({ ...session, tokenHash: 'privado' }).success).toBe(false);
  });
  it.each(['replaced', 'expired'])(
    'informa encerramento por %s sem expor credenciais',
    (reason) => {
      const event = { protocolVersion: 1, event: 'session:ended', payload: { reason } };
      expect(serverEventSchema.safeParse(event).success).toBe(true);
      expect(serverEventSchema.safeParse({ ...event, payload: { reason, token } }).success).toBe(
        false,
      );
    },
  );
});

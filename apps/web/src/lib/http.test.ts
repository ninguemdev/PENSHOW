import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http';
import { issuedSession } from '../test/fixtures';

describe('cliente HTTP', () => {
  it.each([
    () => Promise.reject(new Error('secret')),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.resolve(Response.json({ service: 'comicle', status: 'ok' })),
  ])('usa mensagens públicas para falhas de rede/contrato', async (request) => {
    await expect(createHttpClient(vi.fn(request)).health()).rejects.toThrow(/servidor|inesperada/);
  });
  it('envia credenciais somente no header e mantém status de falhas sem JSON', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    await expect(createHttpClient(request).verifySession(issuedSession)).rejects.toMatchObject({
      status: 401,
    });
    expect(request).toHaveBeenCalledWith(
      `/api/guest-sessions/${issuedSession.playerId}`,
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: `Bearer ${issuedSession.token}` },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});

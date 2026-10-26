import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http';
import { issuedSession } from '../test/fixtures';

describe('cliente HTTP', () => {
  it('mantém sessões e narração na API do PENSHOW quando a origem é compartilhada', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json(issuedSession))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([82, 73, 70, 70]), {
          headers: { 'Content-Type': 'audio/wav' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([82, 73, 70, 70]), {
          headers: { 'Content-Type': 'audio/wav' },
        }),
      );
    const client = createHttpClient(request, '/penshow/');
    await client.createSession();
    const signal = new AbortController().signal;
    await client.narrationPreview(signal);
    await client.narration(issuedSession, 'room-id', 'question-id', signal);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/penshow/api/guest-sessions',
      '/penshow/api/narration/preview',
      '/penshow/api/rooms/room-id/narration/question-id',
    ]);
    expect(request.mock.calls[2]?.[1]).toMatchObject({
      headers: { Authorization: `Bearer ${issuedSession.token}` },
    });
  });
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

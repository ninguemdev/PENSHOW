import {
  domainErrorSchema,
  guestSessionSchema,
  healthResponseSchema,
  issuedGuestSessionSchema,
  type IssuedGuestSession,
} from '@penshow/shared';
import type { z } from 'zod';
import { strings } from '../strings/pt-BR';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createHttpClient(request: typeof fetch = (...args) => fetch(...args)) {
  async function send<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
    try {
      const response = await request(`/api${path}`, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const parsed = domainErrorSchema.safeParse(
          typeof body === 'object' && body !== null && 'error' in body ? body.error : null,
        );
        throw new ApiError(
          response.status,
          parsed.success ? parsed.data.message : strings.errors.network,
        );
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new ApiError(0, strings.errors.protocol);
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, strings.errors.network);
    }
  }
  const auth = (session: IssuedGuestSession) => ({ Authorization: `Bearer ${session.token}` });
  async function audio(path: string, signal: AbortSignal, session?: IssuedGuestSession) {
    const response = await request(`/api${path}`, {
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      ...(session ? { headers: auth(session) } : {}),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/wav'))
      throw new ApiError(response.status, strings.narrator.unavailable);
    return response.arrayBuffer();
  }
  return {
    narration: (
      session: IssuedGuestSession,
      roomId: string,
      questionId: string,
      signal: AbortSignal,
    ) => audio(`/rooms/${roomId}/narration/${questionId}`, signal, session),
    narrationPreview: (signal: AbortSignal) => audio('/narration/preview', signal),
    health: () => send('/health', healthResponseSchema),
    createSession: () => send('/guest-sessions', issuedGuestSessionSchema, { method: 'POST' }),
    verifySession: (session: IssuedGuestSession) =>
      send(`/guest-sessions/${session.playerId}`, guestSessionSchema, { headers: auth(session) }),
    renewSession: (session: IssuedGuestSession) =>
      send(`/guest-sessions/${session.playerId}/renew`, guestSessionSchema, {
        method: 'POST',
        headers: auth(session),
      }),
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;

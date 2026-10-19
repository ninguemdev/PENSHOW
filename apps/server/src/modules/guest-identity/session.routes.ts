import {
  createDomainError,
  createGuestSessionRequestSchema,
  guestSessionParamsSchema,
  guestSessionSchema,
  guestSessionTokenSchema,
  issuedGuestSessionSchema,
} from '@penshow/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GuestSessionStore } from './session-store.js';

export function bearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer ([^\s]+)$/iu);
  const token = guestSessionTokenSchema.safeParse(match?.[1]);
  return token.success ? token.data : null;
}

export function registerSessionRoutes(app: FastifyInstance, sessions: GuestSessionStore) {
  app.register(async (routes) => {
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
    });
    routes.post('/guest-sessions', async (request, reply) => {
      if (
        !createGuestSessionRequestSchema.safeParse(request.body === undefined ? {} : request.body)
          .success ||
        !createGuestSessionRequestSchema.safeParse(request.query).success
      )
        return reply.code(400).send({ error: createDomainError('INVALID_PAYLOAD') });
      return reply.code(201).send(issuedGuestSessionSchema.parse(sessions.create()));
    });

    const authenticate = (request: FastifyRequest) => {
      const token = bearerToken(request.headers.authorization);
      return token ? sessions.authenticate(token) : null;
    };
    for (const method of ['GET', 'POST'] as const) {
      routes.route({
        method,
        url: method === 'GET' ? '/guest-sessions/:playerId' : '/guest-sessions/:playerId/renew',
        handler: async (request, reply) => {
          const session = authenticate(request);
          if (!session)
            return reply
              .header('WWW-Authenticate', 'Bearer realm="PENSHOW"')
              .code(401)
              .send({ error: createDomainError('UNAUTHENTICATED') });
          const params = guestSessionParamsSchema.safeParse(request.params);
          if (
            !params.success ||
            !createGuestSessionRequestSchema.safeParse(request.query).success ||
            (method === 'POST' &&
              !createGuestSessionRequestSchema.safeParse(
                request.body === undefined ? {} : request.body,
              ).success)
          )
            return reply.code(400).send({ error: createDomainError('INVALID_PAYLOAD') });
          if (params.data.playerId !== session.playerId)
            return reply.code(403).send({ error: createDomainError('FORBIDDEN') });
          const status =
            method === 'POST'
              ? sessions.renew(session)
              : { scope: 'penshow', playerId: session.playerId, expiresAt: session.expiresAt };
          if (!status)
            return reply
              .header('WWW-Authenticate', 'Bearer realm="PENSHOW"')
              .code(401)
              .send({ error: createDomainError('UNAUTHENTICATED') });
          return reply.send(guestSessionSchema.parse(status));
        },
      });
    }
  });
}

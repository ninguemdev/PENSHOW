import { createDomainError, roomIdSchema, questionIdSchema } from '@penshow/shared';
import type { FastifyInstance } from 'fastify';
import type { GuestSessionStore } from '../guest-identity/session-store.js';
import { bearerToken } from '../guest-identity/session.routes.js';
import type { RoomService } from '../rooms/room.service.js';
import type { LocalNarrationRepository } from '../../platform/local-narration.repository.js';
import type { TrafficLimiter } from '../../platform/traffic-policy.js';

export function registerNarrationRoutes(
  app: FastifyInstance,
  rooms: RoomService,
  sessions: GuestSessionStore,
  narration: LocalNarrationRepository,
  limits: { requests: TrafficLimiter; windowMs: number },
) {
  app.register(async (routes) => {
    routes.addHook('onRequest', async (request, reply) => {
      if (!limits.requests.take(request.ip))
        return reply
          .header('Retry-After', Math.ceil(limits.windowMs / 1000))
          .code(429)
          .send({ error: createDomainError('RATE_LIMITED') });
    });
    routes.get('/narration/preview', async (_request, reply) =>
      reply.type('audio/wav').send(await narration.preview()),
    );
    routes.get<{ Params: { roomId: string; questionId: string } }>(
      '/rooms/:roomId/narration/:questionId',
      async (request, reply) => {
        const token = bearerToken(request.headers.authorization);
        const session = token ? sessions.authenticate(token) : null;
        if (!session) return reply.code(401).send({ error: createDomainError('UNAUTHENTICATED') });
        const roomId = roomIdSchema.safeParse(request.params.roomId),
          questionId = questionIdSchema.safeParse(request.params.questionId);
        if (!roomId.success || !questionId.success)
          return reply.code(404).send({ error: createDomainError('NOT_FOUND') });
        const room = rooms.registry.byId(roomId.data);
        if (!room || rooms.registry.roomOf(session.playerId) !== roomId.data)
          return reply.code(404).send({ error: createDomainError('NOT_FOUND') });
        const state = room.snapshot();
        const game = state.phase.status === 'match' ? state.phase.game?.state : undefined;
        const stage = game?.final?.stage ?? game?.stage;
        if (
          !stage ||
          ![
            'question-reading',
            'question-open',
            'final-question-reading',
            'final-question-open',
          ].includes(stage.phase) ||
          !('question' in stage) ||
          stage.question.publicQuestion.questionId !== questionId.data ||
          !stage.question.narration
        )
          return reply.code(404).send({ error: createDomainError('NOT_FOUND') });
        const audio = await narration.audio(stage.question.editorialQuestionId);
        if (!audio) return reply.code(404).send({ error: createDomainError('NOT_FOUND') });
        return reply.type('audio/wav').send(audio);
      },
    );
  });
}

import { z } from 'zod';
import {
  playerIdSchema,
  playerIdsSchema,
  questionIdSchema,
  optionIdSchema,
  timestampSchema,
} from './identifiers.js';
import { publicQuestionSchema, questionStemSchema, revealedQuestionSchema } from './question.js';

export const TIEBREAK_RULES = Object.freeze({
  width: 1200,
  height: 800,
  radius: 16,
  speed: 200,
  projectileSpeed: 600,
  projectileRadius: 4,
  projectileLifetimeMs: 1500,
  shotIntervalMs: 300,
  tickMs: 50,
  frameMs: 100,
  inputExpiryMs: 250,
  protectionMs: 1000,
  instructionsMs: 15000,
  countdownMs: 3000,
  responseMs: 15000,
  revealMs: 3000,
});
export const TIEBREAK_OBSTACLES = Object.freeze([
  { x: 340, y: 230, width: 100, height: 80 },
  { x: 760, y: 230, width: 100, height: 80 },
  { x: 340, y: 490, width: 100, height: 80 },
  { x: 760, y: 490, width: 100, height: 80 },
]);
const finite = z.number().finite();
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const tiebreakContextSchema = z.strictObject({
  tiebreakId: z.uuid(),
  bout: counter.min(1),
  generation: counter,
});
export const tiebreakInputSchema = tiebreakContextSchema.extend({
  sequence: counter,
  moveX: finite.min(-1).max(1),
  moveY: finite.min(-1).max(1),
  aimX: finite.min(-1).max(1),
  aimY: finite.min(-1).max(1),
  shooting: z.boolean(),
});
export const tiebreakFrameSchema = tiebreakContextSchema
  .extend({
    tick: counter,
    serverNow: timestampSchema,
    fighters: z
      .array(
        z.strictObject({
          playerId: playerIdSchema,
          x: finite.min(16).max(1184),
          y: finite.min(16).max(784),
          aimX: finite.min(-1).max(1),
          aimY: finite.min(-1).max(1),
          lives: z.number().int().min(0).max(3),
          status: z.enum(['fighting', 'question', 'eliminated']),
          protected: z.boolean(),
        }),
      )
      .min(2)
      .max(12),
    projectiles: z
      .array(z.strictObject({ id: counter, ownerId: playerIdSchema, x: finite, y: finite }))
      .max(120),
  })
  .superRefine((frame, context) => {
    const ids = frame.fighters.map((f) => f.playerId);
    if (
      new Set(ids).size !== ids.length ||
      frame.fighters.some((f) => (f.status === 'fighting') !== f.lives > 0) ||
      new Set(frame.projectiles.map((p) => p.id)).size !== frame.projectiles.length ||
      frame.projectiles.some((p) => !ids.includes(p.ownerId))
    )
      context.addIssue({ code: 'custom', message: 'Quadro de combate inconsistente.' });
  });
export const survivalQuestionSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unavailable') }),
  z.strictObject({
    status: z.literal('reading'),
    question: questionStemSchema,
    opensAt: timestampSchema,
    narration: z
      .strictObject({ durationMs: counter.min(1), voice: z.literal('robot-pt-br-v1') })
      .optional(),
  }),
  z.strictObject({
    status: z.literal('open'),
    question: publicQuestionSchema,
    opensAt: timestampSchema,
    deadlineAt: timestampSchema,
    submitted: z.boolean(),
  }),
  z.strictObject({
    status: z.literal('resolved'),
    reveal: revealedQuestionSchema,
    outcome: z.enum(['correct', 'wrong', 'absent']),
    optionId: optionIdSchema.nullable(),
  }),
]);
export const tiebreakViewSchema = z
  .strictObject({
    phase: z.enum(['instructions', 'countdown', 'combat', 'questions', 'reveal', 'result']),
    frame: tiebreakFrameSchema,
    participants: playerIdsSchema.min(2),
    deadlineAt: timestampSchema,
    readyPlayerIds: playerIdsSchema,
    pendingPlayerIds: playerIdsSchema,
    ownQuestion: survivalQuestionSchema,
    standings: playerIdsSchema,
    batchId: questionIdSchema,
  })
  .superRefine((view, context) => {
    const ids = view.frame.fighters.map((f) => f.playerId);
    if (
      ids.some((id) => !view.participants.includes(id)) ||
      view.readyPlayerIds.some((id) => !ids.includes(id)) ||
      view.pendingPlayerIds.some((id) => !ids.includes(id)) ||
      (view.phase === 'result' &&
        (view.standings.length !== view.participants.length ||
          view.standings.some((id) => !view.participants.includes(id))))
    )
      context.addIssue({
        code: 'custom',
        message: 'O desempate conserva os participantes e seu resultado.',
      });
  });
export type TiebreakInput = z.infer<typeof tiebreakInputSchema>;
export type TiebreakFrame = z.infer<typeof tiebreakFrameSchema>;
export type TiebreakView = z.infer<typeof tiebreakViewSchema>;

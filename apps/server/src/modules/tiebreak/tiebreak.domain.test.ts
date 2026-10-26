import { describe, expect, it } from 'vitest';
import {
  TIEBREAK_RULES as rules,
  tiebreakViewSchema,
  playerIdSchema,
  questionIdSchema,
} from '@penshow/shared';
import { prepared, uuid } from '../../test-support/match.js';
import { createCombat, stepCombat } from './combat.domain.js';
import {
  answerSurvival,
  buildTiebreakView,
  createTiebreak,
  expireTiebreak,
  prepareSurvivalQuestions,
  readyTiebreak,
} from './tiebreak.domain.js';

const ids = Array.from({ length: 12 }, (_, i) => playerIdSchema.parse(uuid(i + 1)));
const connected = new Set(ids);
function combat(count = 2) {
  const state = createTiebreak(
    uuid(900),
    questionIdSchema.parse(uuid(800)),
    ids.slice(0, count),
    1000,
  );
  expireTiebreak(state, state.deadlineAt, connected);
  expireTiebreak(state, state.deadlineAt, connected);
  return state;
}
function questions(count = 1) {
  const state = combat(Math.max(2, count));
  state.phase = 'questions';
  state.pendingPlayerIds = ids.slice(0, count);
  for (const f of state.combat.fighters.slice(0, count)) {
    f.lives = 0;
    f.status = 'question';
  }
  prepareSurvivalQuestions(
    state,
    ids.slice(0, count).map((_, i) => prepared(300 + i * 10)),
    2000,
    3000,
  );
  return state;
}
describe('combate autoritativo e sobrevivência', () => {
  it.each([2, 4, 12])(
    'cria %i participantes espaçados com três vidas e visão pública validada',
    (count) => {
      const state = combat(count);
      expect(state.combat.fighters.every((f) => f.lives === 3)).toBe(true);
      for (const a of state.combat.fighters)
        for (const b of state.combat.fighters)
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(32);
      expect(tiebreakViewSchema.safeParse(buildTiebreakView(state, ids[0]!, 1000)).success).toBe(
        true,
      );
    },
  );
  it('normaliza diagonal, limita velocidade e neutraliza input ausente ou desconectado', () => {
    const arena = createCombat(ids.slice(0, 2)),
      f = arena.fighters[0]!;
    const input = {
      tiebreakId: uuid(900),
      bout: 1,
      generation: 0,
      sequence: 1,
      moveX: -1,
      moveY: 1,
      aimX: -1,
      aimY: 0,
      shooting: false,
      receivedAt: 1000,
    };
    f.input = input;
    const before = { x: f.x, y: f.y };
    stepCombat(arena, 1000, connected);
    expect(Math.hypot(f.x - before.x, f.y - before.y)).toBeCloseTo(rules.speed * 0.05);
    const after = { x: f.x, y: f.y };
    stepCombat(arena, 1250, connected);
    expect({ x: f.x, y: f.y }).toEqual(after);
    f.input = { ...input, receivedAt: 1250 };
    stepCombat(arena, 1250, new Set());
    expect({ x: f.x, y: f.y }).toEqual(after);
  });
  it('impactos de tiros simultâneos zeram ambos antes de escolher qualquer vencedor', () => {
    const arena = createCombat(ids.slice(0, 2));
    arena.fighters[0]!.x = 500;
    arena.fighters[0]!.y = 400;
    arena.fighters[1]!.x = 600;
    arena.fighters[1]!.y = 400;
    arena.fighters.forEach((f) => {
      f.lives = 1;
    });
    arena.projectiles = [
      { id: 0, ownerId: ids[0]!, x: 570, y: 400, vx: 600, vy: 0, expiresAt: 1000 },
      { id: 1, ownerId: ids[1]!, x: 530, y: 400, vx: -600, vy: 0, expiresAt: 1000 },
    ];
    expect(stepCombat(arena, 1000, connected)).toEqual(ids.slice(0, 2));
    expect(arena.fighters.every((f) => f.lives === 0 && f.status === 'question')).toBe(true);
  });
  it('projétil não atravessa obstáculo nem aplica mais de um dano por passo', () => {
    const arena = createCombat(ids.slice(0, 2));
    arena.fighters[1]!.x = 450;
    arena.fighters[1]!.y = 270;
    arena.projectiles = [
      { id: 0, ownerId: ids[0]!, x: 330, y: 270, vx: 4000, vy: 0, expiresAt: 1000 },
    ];
    stepCombat(arena, 1000, connected);
    expect(arena.fighters[1]!.lives).toBe(3);
    arena.fighters[1]!.x = 600;
    arena.fighters[1]!.y = 400;
    arena.projectiles = [0, 1].map((id) => ({
      id,
      ownerId: ids[0]!,
      x: 570,
      y: 400,
      vx: 600,
      vy: 0,
      expiresAt: 1000,
    }));
    stepCombat(arena, 1050, connected);
    expect(arena.fighters[1]!.lives).toBe(2);
  });
  it('cadência e proteção são decididas pelo servidor', () => {
    const arena = createCombat(ids.slice(0, 2)),
      f = arena.fighters[0]!;
    f.input = {
      tiebreakId: uuid(900),
      bout: 1,
      generation: 0,
      sequence: 1,
      moveX: 0,
      moveY: 0,
      aimX: -1,
      aimY: 0,
      shooting: true,
      receivedAt: 1000,
    };
    for (let i = 0; i < 5; i++) stepCombat(arena, 1000 + i * 40, connected);
    expect(arena.nextProjectileId).toBe(1);
    f.input.receivedAt = 1200;
    f.protectedUntil = 2000;
    for (let i = 0; i < 10; i++) stepCombat(arena, 1200, connected);
    expect(arena.nextProjectileId).toBe(1);
  });
  it('leitura oculta alternativas, perguntas são privadas e acerto restaura uma vida repetidamente', () => {
    const state = questions();
    const own = state.questions[0]!;
    expect(buildTiebreakView(state, ids[0]!, 2000).ownQuestion.status).toBe('reading');
    expect(JSON.stringify(buildTiebreakView(state, ids[1]!, 2000))).not.toContain('Pergunta 300');
    expect(JSON.stringify(buildTiebreakView(state, ids[0]!, 2000))).not.toContain(
      'correctOptionId',
    );
    expect(() =>
      answerSurvival(
        state,
        ids[0]!,
        own.question.publicQuestion.questionId,
        own.question.correctOptionId,
        4999,
      ),
    ).toThrow('DEADLINE_EXPIRED');
    answerSurvival(
      state,
      ids[0]!,
      own.question.publicQuestion.questionId,
      own.question.correctOptionId,
      5000,
    );
    expect(state.combat.fighters[0]!.lives).toBe(1);
    expect(state.phase).toBe('reveal');
    expireTiebreak(state, state.deadlineAt, connected);
    expect(state.phase).toBe('countdown');
    state.phase = 'questions';
    state.pendingPlayerIds = [ids[0]!];
    state.questions = [];
    state.combat.fighters[0]!.lives = 0;
    state.combat.fighters[0]!.status = 'question';
    prepareSurvivalQuestions(state, [prepared(400)], 10000, 3000);
    answerSurvival(
      state,
      ids[0]!,
      state.questions[0]!.question.publicQuestion.questionId,
      state.questions[0]!.question.correctOptionId,
      13000,
    );
    expect(state.combat.fighters[0]!.lives).toBe(1);
  });
  it('pergunta com narração longa preserva resposta completa e não consome tempo de combate', () => {
    const state = combat();
    state.phase = 'questions';
    state.pendingPlayerIds = [ids[0]!];
    prepareSurvivalQuestions(
      state,
      [{ ...prepared(), narration: { durationMs: 7000 } }],
      2000,
      3000,
    );
    expect(state.questions[0]!.opensAt).toBe(10500);
    expect(state.questions[0]!.deadlineAt).toBe(25500);
    const simulation = state.combat.simulationMs;
    expireTiebreak(state, 10500, connected);
    expect(state.combat.simulationMs).toBe(simulation);
  });
  it('aguarda o lote completo sem publicar correção antes da revelação', () => {
    const state = questions(2),
      [a, b] = state.questions;
    answerSurvival(
      state,
      ids[0]!,
      a!.question.publicQuestion.questionId,
      a!.question.correctOptionId,
      5000,
    );
    expect(state.phase).toBe('questions');
    expect(state.combat.fighters[0]!.lives).toBe(0);
    expect(JSON.stringify(buildTiebreakView(state, ids[0]!, 5000))).not.toContain(
      'correctOptionId',
    );
    expect(() =>
      answerSurvival(
        state,
        ids[0]!,
        a!.question.publicQuestion.questionId,
        a!.question.correctOptionId,
        5000,
      ),
    ).toThrow('ALREADY_ANSWERED');
    expect(() =>
      answerSurvival(
        state,
        ids[1]!,
        a!.question.publicQuestion.questionId,
        a!.question.correctOptionId,
        5000,
      ),
    ).toThrow('STALE_CONTEXT');
    answerSurvival(
      state,
      ids[1]!,
      b!.question.publicQuestion.questionId,
      b!.question.publicQuestion.options[1]!.optionId,
      5001,
    );
    expect(state.phase).toBe('reveal');
    expect(state.combat.fighters[0]!.lives).toBe(1);
    expect(state.combat.fighters[1]!.status).toBe('eliminated');
    expireTiebreak(state, state.deadlineAt, connected);
    expect(state.standings).toEqual(ids.slice(0, 2));
  });
  it('prazo exato elimina por ausência, mas eliminação simultânea abre novo combate', () => {
    const state = questions(2);
    const q = state.questions[0]!;
    expect(() =>
      answerSurvival(
        state,
        ids[0]!,
        q.question.publicQuestion.questionId,
        q.question.correctOptionId,
        q.deadlineAt,
      ),
    ).toThrow('DEADLINE_EXPIRED');
    expireTiebreak(state, q.deadlineAt, connected);
    expect(state.questions.every((q) => q.outcome === 'absent')).toBe(true);
    expireTiebreak(state, state.deadlineAt, connected);
    expect(state.phase).toBe('countdown');
    expect(state.bout).toBe(2);
    expect(state.standings).toEqual([]);
    expect(state.combat.fighters.every((f) => f.lives === 3)).toBe(true);
  });
  it('só jogadores do combate podem confirmar prontidão', () => {
    const state = createTiebreak(
      uuid(900),
      questionIdSchema.parse(uuid(800)),
      ids.slice(0, 2),
      1000,
    );
    expect(() => readyTiebreak(state, ids[3]!, 1000)).toThrow('FORBIDDEN');
    readyTiebreak(state, ids[0]!, 1000);
    readyTiebreak(state, ids[0]!, 1000);
    expect(state.readyPlayerIds).toHaveLength(1);
    readyTiebreak(state, ids[1]!, 1000);
    expect(state.phase).toBe('countdown');
  });
  it('subcombate desempata só os eliminados juntos sem retirar o primeiro lugar já conquistado', () => {
    const state = combat(3);
    state.phase = 'questions';
    state.pendingPlayerIds = ids.slice(0, 2);
    for (const f of state.combat.fighters.slice(0, 2)) {
      f.lives = 0;
      f.status = 'question';
    }
    prepareSurvivalQuestions(state, [prepared(500), prepared(510)], 1000, 3000);
    for (const q of state.questions)
      answerSurvival(
        state,
        q.playerId,
        q.question.publicQuestion.questionId,
        q.question.publicQuestion.options[1]!.optionId,
        4000,
      );
    expireTiebreak(state, state.deadlineAt, connected);
    expect(state.slots).toEqual([[ids[2]], ids.slice(0, 2)]);
    expect(state.bout).toBe(2);
    expect(state.combat.fighters.map((f) => f.playerId)).toEqual(ids.slice(0, 2));
    expect(tiebreakViewSchema.safeParse(buildTiebreakView(state, ids[2]!, 5000)).success).toBe(
      true,
    );
    state.phase = 'questions';
    state.pendingPlayerIds = ids.slice(0, 2);
    state.questions = [];
    for (const f of state.combat.fighters) {
      f.lives = 0;
      f.status = 'question';
    }
    prepareSurvivalQuestions(state, [prepared(520), prepared(530)], 10000, 3000);
    for (const q of state.questions)
      answerSurvival(
        state,
        q.playerId,
        q.question.publicQuestion.questionId,
        q.question.publicQuestion.options[q.playerId === ids[0] ? 1 : 0]!.optionId,
        13000,
      );
    expireTiebreak(state, state.deadlineAt, connected);
    expect(state.standings).toEqual([ids[2], ids[1], ids[0]]);
  });
});

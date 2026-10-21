import { describe, expect, it } from 'vitest';
import { playerIdSchema, roundIdSchema } from '@penshow/shared';
import { createFinal, finalDeadline, transitionFinal, type FinalState } from './final.domain.js';
import { freezeMatchRules } from '../scoring/match-rules.js';
import { prepareFinalEntry } from '../scoring/final-entry.domain.js';
import { prepared, roster, uuid } from '../../test-support/match.js';

const ids = Array.from({ length: 12 }, (_, i) => playerIdSchema.parse(uuid(i + 1))),
  rules = freezeMatchRules(roster.matchId);
function initial(count = 2) {
  const entry = prepareFinalEntry({
    matchId: roster.matchId,
    scope: 'isolated-prototype',
    scores: ids
      .slice(0, count)
      .map((playerId, i) => ({ playerId, points: (count - i) * 100, correctAnswers: 0 })),
  });
  return createFinal(entry, rules, roundIdSchema.parse(uuid(500)), 1000);
}
const context = (state: FinalState) => ({ matchId: state.matchId, roundId: state.round.roundId });
function expire(state: FinalState, late = 0) {
  return transitionFinal(state, { kind: 'expire' }, finalDeadline(state)! + late, rules);
}
function nextOpen(state = initial(), n = 300, now = 1000) {
  state.stage = { phase: 'awaiting-final-question', previousQuestionId: null };
  state = transitionFinal(
    state,
    { kind: 'final-question-prepared', question: prepared(n) },
    now,
    rules,
  ).state;
  return expire(state).state;
}
function answer(state: FinalState, correct: boolean, playerId = ids[0]!, at?: number) {
  if (!('question' in state.stage)) throw new Error();
  return transitionFinal(
    state,
    {
      kind: 'answer',
      ...context(state),
      playerId,
      questionId: state.stage.question.publicQuestion.questionId,
      optionId: state.stage.question.publicQuestion.options[correct ? 0 : 1]!.optionId,
    },
    at ?? ('opensAt' in state.stage ? state.stage.opensAt : 4000),
    rules,
  );
}
function target(state: FinalState, playerId = ids[0]!, targetPlayerId = ids[1]!, at?: number) {
  if (!('question' in state.stage)) throw new Error();
  return transitionFinal(
    state,
    {
      kind: 'target',
      ...context(state),
      playerId,
      targetPlayerId,
      questionId: state.stage.question.publicQuestion.questionId,
    },
    at ?? (state.stage.phase === 'final-target-selection' ? state.stage.deadlineAt - 1 : 4000),
    rules,
  );
}
describe('final de primeira resposta exclusiva', () => {
  it('primeiro errado perde uma vida; segundo acerto não é avaliado', () => {
    const open = nextOpen(),
      result = answer(open, false).state;
    expect(result.finalists.map((player) => player.lives)).toEqual([4, 4]);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]!.resolution.outcome).toBe('wrong-answer');
    expect(() => answer(result, true, ids[1]!)).toThrowError(
      expect.objectContaining({ code: 'QUESTION_CLOSED' }),
    );
    expect(open.finalists.map((player) => player.lives)).toEqual([5, 4]);
  });
  it('dois acertos só concedem um ataque; autor e alvo inválidos não consomem o direito', () => {
    const chosen = answer(nextOpen(), true).state;
    expect(chosen.stage.phase).toBe('final-target-selection');
    expect(chosen.history).toHaveLength(0);
    expect(() => answer(chosen, true, ids[1]!)).toThrowError(
      expect.objectContaining({ code: 'QUESTION_CLOSED' }),
    );
    expect(() => target(chosen, ids[1]!, ids[0]!)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => target(chosen, ids[0]!, ids[0]!)).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
    expect(() => target(chosen, ids[0]!, ids[5]!)).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
    const result = target(chosen).state;
    expect(result.finalists.map((player) => player.lives)).toEqual([5, 3]);
    expect(result.history[0]!.resolution).toMatchObject({
      outcome: 'attack',
      damage: 1,
      targetPlayerId: ids[1],
    });
    expect(() => target(result)).toThrowError(expect.objectContaining({ code: 'INVALID_PHASE' }));
  });
  it('líder sobrevive a quatro perdas e a quinta o elimina; somente um sobrevivente ganha', () => {
    let state = initial();
    for (let loss = 1; loss <= 5; loss++) {
      state = nextOpen(state, 300 + loss * 10, loss * 30_000);
      state = answer(state, false).state;
      expect(state.finalists[0]!.lives).toBe(5 - loss);
      expect(state.history).toHaveLength(loss);
      const step = expire(state);
      state = step.state;
      expect(state.stage.phase).toBe(loss < 5 ? 'awaiting-final-question' : 'podium');
    }
    expect(state.finalists[0]).toMatchObject({ status: 'eliminated', eliminationOrder: 1 });
    expect(state.finalists[1]).toMatchObject({ status: 'active', lives: 4 });
  });
  it.each([2, 3, 4, 12])(
    'com %i jogadores, eliminações são sequenciais e dano total nunca elimina todos',
    (count) => {
      let state = initial(count),
        number = 0;
      for (const victim of [...ids.slice(0, count - 1)].reverse()) {
        while (state.finalists.find((player) => player.playerId === victim)!.status === 'active') {
          state = nextOpen(state, 1000 + number++ * 10, number * 30_000);
          state = answer(state, false, victim).state;
          state = expire(state).state;
        }
      }
      expect(state.stage.phase).toBe('podium');
      expect(state.finalists.filter((player) => player.status === 'active')).toHaveLength(1);
      expect(
        state.finalists
          .filter((player) => player.status === 'eliminated')
          .map((player) => player.eliminationOrder)
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: count - 1 }, (_, i) => i + 1));
    },
  );
  it('eliminado não responde nem recebe ataque, sem bloquear o próximo jogador válido', () => {
    let state = initial(3),
      number = 0;
    for (let i = 0; i < 3; i++) {
      state = nextOpen(state, 2000 + number++ * 10, number * 30_000);
      state = answer(state, false, ids[2]!).state;
      state = expire(state).state;
    }
    state = nextOpen(state, 3000, 200_000);
    expect(() => answer(state, true, ids[2]!)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    state = answer(state, true).state;
    expect(() => target(state, ids[0]!, ids[2]!)).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
    expect(target(state).state.history).toHaveLength(4);
  });
  it('abertura inclusiva, prazo exclusivo, opção inválida não fecha a pergunta', () => {
    const state = nextOpen();
    if (state.stage.phase !== 'final-question-open') throw new Error();
    const { opensAt, deadlineAt } = state.stage;
    const payload = {
      kind: 'answer' as const,
      ...context(state),
      playerId: ids[0]!,
      questionId: state.stage.question.publicQuestion.questionId,
      optionId: prepared(900).correctOptionId,
    };
    expect(() => transitionFinal(state, payload, opensAt, rules)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
    );
    expect(() => answer(state, true, ids[0]!, opensAt - 1)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    expect(() => answer(state, true, ids[0]!, deadlineAt)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    expect(answer(state, true, ids[0]!, deadlineAt - 1).state.stage.phase).toBe(
      'final-target-selection',
    );
  });
  it('D02 e D03 pendentes não aplicam dano, fallback ou vitória; prazo tardio não reinicia janela', () => {
    const open = nextOpen(),
      absent = expire(open).state;
    expect(absent.stage.phase).toBe('final-no-answer-pending');
    expect(finalDeadline(absent)).toBeNull();
    expect(absent.finalists).toEqual(open.finalists);
    expect(absent.history).toHaveLength(0);
    expect(transitionFinal(absent, { kind: 'expire' }, 100_000, rules).changed).toBe(false);
    const chosen = answer(open, true).state,
      noTarget = expire(chosen).state;
    expect(noTarget.stage.phase).toBe('final-no-target-pending');
    expect(noTarget.finalists).toEqual(open.finalists);
    if (chosen.stage.phase !== 'final-target-selection') throw new Error();
    const targetDeadline = chosen.stage.deadlineAt;
    expect(() => target(chosen, ids[0]!, ids[1]!, targetDeadline)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    const reading = transitionFinal(
      { ...initial(), stage: { phase: 'awaiting-final-question', previousQuestionId: null } },
      { kind: 'final-question-prepared', question: prepared() },
      1000,
      rules,
    ).state;
    expect(expire(reading, 15_000).state.stage.phase).toBe('final-no-answer-pending');
  });
  it('repetição de pronto não avança duas vezes; conteúdo esgotado interrompe sem campeão por pontos', () => {
    const state = initial(),
      event = { kind: 'ready' as const, ...context(state), playerId: ids[0]! };
    const first = transitionFinal(state, event, 1001, rules).state;
    expect(transitionFinal(first, event, 1001, rules).changed).toBe(false);
    const next = transitionFinal(first, { ...event, playerId: ids[1]! }, 1001, rules);
    expect(next.nextQuestion).toBeNull();
    const stopped = transitionFinal(
      next.state,
      { kind: 'final-question-prepared', question: null },
      1001,
      rules,
    ).state;
    expect(stopped.stage).toEqual({ phase: 'interrupted', reason: 'insufficient-questions' });
    expect(stopped.finalists).toEqual(state.finalists);
  });
});

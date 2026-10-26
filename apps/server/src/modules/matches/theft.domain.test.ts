import { describe, expect, it, vi } from 'vitest';
import { playerIdSchema } from '@penshow/shared';
import {
  createMatch,
  currentRound,
  matchTimer,
  transitionMatch,
  type MatchState,
} from './match.domain.js';
import { theftStrategy, StrategyRegistry } from './match-strategy.js';
import { freezeMatchRules } from '../scoring/match-rules.js';
import { buildMatchView } from './build-match-view.js';
import { roster, round, players, profile, prepared, uuid } from '../../test-support/match.js';

const ids = [...players, playerIdSchema.parse(uuid(3))];
const registry = new StrategyRegistry([theftStrategy]);
const question = prepared();
const context = (state: MatchState) => ({
  matchId: state.roster.matchId,
  roundId: currentRound(state).roundId,
});
function open(balances = [0, 0, 0]) {
  let state = createMatch(
    { ...roster, players: ids.map((playerId) => ({ playerId, profile })) },
    freezeMatchRules(roster.matchId),
    [{ ...round, mode: 'theft', index: 4 }],
    registry,
  );
  state.scoreboard = state.scoreboard.map((entry, i) => ({ ...entry, points: balances[i]! }));
  for (const playerId of ids)
    state = transitionMatch(
      state,
      { kind: 'ready', ...context(state), playerId },
      1000,
      registry,
    ).state;
  state = transitionMatch(
    state,
    {
      kind: 'category-offered',
      offer: {
        status: 'choosing',
        mode: 'theft',
        roundId: round.roundId,
        chooserPlayerId: ids[0]!,
        categories: ['history'],
        deadlineAt: 11000,
      },
    },
    1000,
    registry,
  ).state;
  state = transitionMatch(
    state,
    { kind: 'choose-category', ...context(state), playerId: ids[0]!, category: 'history' },
    1000,
    registry,
  ).state;
  state = transitionMatch(state, { kind: 'question-prepared', question }, 1000, registry).state;
  return expire(state);
}
function expire(state: MatchState) {
  const timer = matchTimer(state)!;
  return transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt, registry).state;
}
function answer(state: MatchState, index: number, correct: boolean, now = 4000) {
  return transitionMatch(
    state,
    {
      kind: 'answer',
      ...context(state),
      playerId: ids[index]!,
      questionId: question.publicQuestion.questionId,
      optionId: correct ? question.correctOptionId : question.publicQuestion.options[1]!.optionId,
    },
    now,
    registry,
  ).state;
}
function choose(state: MatchState, actor: number, target: number, now = 4000) {
  return transitionMatch(
    state,
    {
      kind: 'target',
      ...context(state),
      playerId: ids[actor]!,
      questionId: question.publicQuestion.questionId,
      targetPlayerId: ids[target]!,
    },
    now,
    registry,
  );
}

describe('roubo no motor autoritativo', () => {
  it('erro mais rápido não bloqueia acerto posterior e ninguém conhece o vencedor antes do fechamento', () => {
    let state = answer(open(), 0, false);
    state = answer(state, 1, true, 4001);
    const view = buildMatchView(state, ids[0]!);
    expect(view.stage.phase).toBe('question-open');
    expect(view.scoreboard.map((entry) => entry.points)).toEqual([0, 0, 0]);
    expect(JSON.stringify(view)).not.toMatch(/"attackerPlayerId"|"theftResult"|"correctOptionId"/);
    state = answer(state, 2, true, 4002);
    expect(state.stage).toMatchObject({
      phase: 'theft-target-selection',
      attackerPlayerId: ids[1],
      eligibleTargetIds: [ids[2]],
    });
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([0, 100, 100]);
    expect(state.history).toHaveLength(0);
    state = choose(state, 1, 2, 4003).state;
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([0, 200, 0]);
    expect(state.history).toHaveLength(1);
  });
  it.each([
    [0, 1],
    [1, 0],
  ])('acertos no mesmo milissegundo preservam ordem da fila %i, %i', (first, second) => {
    let state = answer(open(), first, true);
    state = answer(state, second, true);
    state = answer(state, 2, false);
    expect(state.stage).toMatchObject({
      phase: 'theft-target-selection',
      attackerPlayerId: ids[first],
    });
  });
  it('alvo com 30 transfere só 30 e o reenvio não reaplica os efeitos', () => {
    let state = answer(open([0, 30, 0]), 0, true);
    state = answer(answer(state, 1, false), 2, false);
    const before = structuredClone(state);
    state = choose(state, 0, 1).state;
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([130, 0, 0]);
    expect(before.scoreboard.map((entry) => entry.points)).toEqual([100, 30, 0]);
    expect(
      state.history[0]!.effects.filter((effect) => effect.reason === 'theft').map(
        (effect) => effect.amount,
      ),
    ).toEqual([30, 30]);
    expect(buildMatchView(state, ids[2]!).stage).toMatchObject({
      phase: 'reveal',
      theftResult: { amount: 30, attackerPlayerId: ids[0], targetPlayerId: ids[1] },
    });
    expect(() => choose(state, 0, 1)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PHASE' }),
    );
  });
  it('aplica acertos antes do roubo e valida ator, saldo, alvo e prazo', () => {
    let state = answer(open([0, 30, 0]), 0, true);
    state = answer(answer(state, 1, true), 2, false);
    expect(state.scoreboard[1]!.points).toBe(130);
    expect(() => choose(state, 1, 0)).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => choose(state, 0, 0)).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
    expect(() => choose(state, 0, 2)).toThrowError(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
    expect(() => choose(state, 0, 1, matchTimer(state)!.deadlineAt)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    const unknown = playerIdSchema.parse(uuid(999));
    expect(() =>
      transitionMatch(
        state,
        {
          kind: 'target',
          ...context(state),
          playerId: ids[0]!,
          questionId: question.publicQuestion.questionId,
          targetPlayerId: unknown,
        },
        4000,
        registry,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_TARGET' }));
    state = choose(state, 0, 1).state;
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([200, 30, 0]);
  });
  it('sem acerto ou sem adversário com saldo, pula o alvo e revela só os créditos', () => {
    expect(expire(open()).stage).toMatchObject({
      phase: 'reveal',
      theftResult: { attackerPlayerId: null, targetPlayerId: null, amount: 0 },
    });
    let state = answer(open(), 0, true);
    state = answer(answer(state, 1, false), 2, false);
    expect(state.stage).toMatchObject({
      phase: 'reveal',
      theftResult: { attackerPlayerId: ids[0], targetPlayerId: null, amount: 0 },
    });
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([100, 0, 0]);
  });
  it('prazo sem alvo encerra sem transferir nem recalcular os acertos', () => {
    const resolve = vi.fn(theftStrategy.resolve);
    const strategies = new StrategyRegistry([{ ...theftStrategy, resolve }]);
    let state = open([0, 30, 0]);
    for (let index = 0; index < 3; index++)
      state = transitionMatch(
        state,
        {
          kind: 'answer',
          ...context(state),
          playerId: ids[index]!,
          questionId: question.publicQuestion.questionId,
          optionId:
            index === 0 ? question.correctOptionId : question.publicQuestion.options[1]!.optionId,
        },
        4000,
        strategies,
      ).state;
    const timer = matchTimer(state)!;
    state = transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt, strategies).state;
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([100, 30, 0]);
    expect(state.history).toHaveLength(1);
    expect(
      transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt, strategies).changed,
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { playerIdSchema, questionIdSchema } from '@penshow/shared';
import {
  createMatch,
  currentRound,
  matchTimer,
  transitionMatch,
  type MatchState,
} from './match.domain.js';
import { wagerStrategy, StrategyRegistry } from './match-strategy.js';
import { freezeMatchRules } from '../scoring/match-rules.js';
import { buildMatchView } from './build-match-view.js';
import { roster, round, players, prepared, uuid } from '../../test-support/match.js';

const registry = new StrategyRegistry([wagerStrategy]);
const question = prepared();
function context(state: MatchState) {
  return { matchId: state.roster.matchId, roundId: currentRound(state).roundId };
}
function selection(balance = 500) {
  let state = createMatch(
    roster,
    freezeMatchRules(roster.matchId),
    [{ ...round, mode: 'wager', index: 3 }],
    registry,
  );
  state.scoreboard = state.scoreboard.map((entry) => ({ ...entry, points: balance }));
  for (const playerId of players)
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
        roundId: round.roundId,
        mode: 'wager',
        chooserPlayerId: players[0]!,
        categories: ['history'],
        deadlineAt: 11000,
      },
    },
    1000,
    registry,
  ).state;
  state = transitionMatch(
    state,
    { kind: 'choose-category', ...context(state), playerId: players[0]!, category: 'history' },
    1000,
    registry,
  ).state;
  return transitionMatch(state, { kind: 'question-prepared', question }, 1000, registry).state;
}
function wager(state: MatchState, amount: number, now = 1000, playerId = players[0]!) {
  return transitionMatch(
    state,
    {
      kind: 'wager',
      ...context(state),
      playerId,
      questionId: question.publicQuestion.questionId,
      amount,
    },
    now,
    registry,
  );
}
function expire(state: MatchState) {
  const timer = matchTimer(state)!;
  return transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt, registry).state;
}
function answer(state: MatchState, correct: boolean) {
  const optionId = correct
    ? question.correctOptionId
    : question.publicQuestion.options[1]!.optionId;
  return transitionMatch(
    state,
    {
      kind: 'answer',
      ...context(state),
      playerId: players[0]!,
      questionId: question.publicQuestion.questionId,
      optionId,
    },
    10000,
    registry,
  ).state;
}

describe('aposta no motor autoritativo', () => {
  it.each([
    [0, [0]],
    [25, [0, 25]],
    [50, [0, 25, 50]],
  ])('saldo %i oferece somente apostas cobertas', (balance, allowed) => {
    const state = selection(balance as number);
    const view = buildMatchView(state, players[0]!);
    expect(view.stage).toMatchObject({
      phase: 'wager-selection',
      allowedAmounts: allowed,
      ownWager: { status: 'pending' },
    });
    const selected = wager(state, balance as number).state;
    expect(selected.scoreboard).toEqual(state.scoreboard);
    expect(state.wagers).toEqual([]);
    expect(selected.wagers[0]).toMatchObject({ amount: balance, pointsAtSelection: balance });
  });
  it('recusa saldo insuficiente, valor não oferecido, espectador, contexto e prazo inválidos', () => {
    const state = selection(25);
    expect(() => wager(state, 50)).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_BALANCE' }),
    );
    for (const amount of [-1, 1, 75, NaN])
      expect(() => wager(state, amount)).toThrowError(
        expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
      );
    expect(() => wager(state, 0, 7000)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    expect(() => wager(state, 0, 1000, playerIdSchema.parse(uuid(99)))).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() =>
      transitionMatch(
        state,
        {
          kind: 'wager',
          ...context(state),
          playerId: players[0]!,
          questionId: questionIdSchema.parse(uuid(999)),
          amount: 0,
        },
        1000,
        registry,
      ),
    ).toThrowError(expect.objectContaining({ code: 'STALE_CONTEXT' }));
    expect(() => wager(expire(state), 0, 7000)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PHASE' }),
    );
    expect(state.wagers).toEqual([]);
  });
  it('aceita a mesma aposta como no-op, recusa alteração e guarda privacidade até a revelação', () => {
    const state = wager(selection(), 50).state;
    const timer = matchTimer(state)!;
    const repeat = wager(state, 50);
    expect(repeat.changed).toBe(false);
    expect(repeat.state).toBe(state);
    expect(() => wager(state, 25)).toThrowError(
      expect.objectContaining({ code: 'ACTION_CONFLICT' }),
    );
    expect(matchTimer(state)).toEqual(timer);
    const own = buildMatchView(state, players[0]!),
      other = buildMatchView(state, players[1]!);
    expect(own.stage).toMatchObject({ ownWager: { status: 'submitted', amount: 50 } });
    expect(other.stage).toMatchObject({ ownWager: { status: 'pending' } });
    expect(JSON.stringify(other)).not.toMatch(
      /"amount"|"prompt"|"options"|"correctOptionId"|"pointsAtSelection"/,
    );
    const reading = expire(state);
    expect(buildMatchView(reading, players[0]!).stage).toMatchObject({
      ownWager: { status: 'submitted', amount: 50 },
    });
    expect(buildMatchView(reading, players[1]!).stage).toMatchObject({
      ownWager: { status: 'submitted', amount: 0 },
    });
    expect(transitionMatch(reading, { kind: 'timer', timer }, 7000, registry).changed).toBe(false);
  });
  it.each([
    [true, 650],
    [false, 450],
    [null, 450],
  ])('500 com aposta 50 e resposta %s termina em %i uma única vez', (correct, expected) => {
    let state = expire(expire(wager(selection(), 50).state));
    if (correct !== null) state = answer(state, correct);
    const beforeTimer = matchTimer(state)!;
    state = expire(state);
    expect(state.scoreboard[0]!.points).toBe(expected);
    expect(state.history).toHaveLength(1);
    expect(buildMatchView(state, players[1]!).stage).toMatchObject({
      phase: 'reveal',
      wagerResults: [
        { playerId: players[0], amount: 50, balanceBefore: 500, balanceAfter: expected },
        { playerId: players[1], amount: 0, balanceBefore: 500, balanceAfter: 500 },
      ],
    });
    expect(
      transitionMatch(
        state,
        { kind: 'timer', timer: beforeTimer },
        beforeTimer.deadlineAt,
        registry,
      ).changed,
    ).toBe(false);
  });
  it('aposta ausente vira zero e não impede acertar, inclusive com saldo zero', () => {
    let state = expire(expire(selection(0)));
    state = expire(answer(state, true));
    expect(state.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
    expect(state.wagers).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { playerIdSchema } from '@penshow/shared';
import {
  createMatch,
  currentPressureTurn,
  currentRound,
  matchTimer,
  transitionMatch,
  type MatchState,
} from './match.domain.js';
import { pressureStrategy, StrategyRegistry } from './match-strategy.js';
import { freezeMatchRules } from '../scoring/match-rules.js';
import { buildMatchView } from './build-match-view.js';
import { roster, round, players, prepared, uuid } from '../../test-support/match.js';

const registry = new StrategyRegistry([pressureStrategy]);
const pressureRound = {
  ...round,
  mode: 'pressure' as const,
  index: 5 as const,
  variant: { status: 'confirmed' as const, decisionId: 'D04' as const, mode: 'dynamite' as const },
};
const context = (state: MatchState) => ({
  matchId: state.roster.matchId,
  roundId: currentRound(state).roundId,
});
function initial() {
  return createMatch(roster, freezeMatchRules(roster.matchId), [pressureRound], registry, players);
}
function reading(balance = 50) {
  const state = initial();
  state.scoreboard[0]!.points = balance;
  state.stage = { phase: 'awaiting-question', previousQuestionId: null };
  const question = prepared();
  question.publicQuestion.difficulty = 'medium';
  return transitionMatch(state, { kind: 'question-prepared', question }, 1000, registry).state;
}
function expire(state: MatchState, late = 0) {
  const timer = matchTimer(state)!;
  return transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt + late, registry).state;
}
function answer(state: MatchState, correct: boolean, playerId = players[0]!, now = 4000) {
  if (!('question' in state.stage)) throw new Error();
  return transitionMatch(
    state,
    {
      kind: 'answer',
      ...context(state),
      playerId,
      questionId: state.stage.question.publicQuestion.questionId,
      optionId: state.stage.question.publicQuestion.options[correct ? 0 : 1]!.optionId,
    },
    now,
    registry,
  ).state;
}
describe('dinamite por turnos', () => {
  it.each(['wrong', 'timeout'] as const)(
    '%s debita só o saldo 50, mantém o participante e não penaliza duas vezes',
    (outcome) => {
      const open = expire(reading());
      const timer = matchTimer(open)!;
      const state = outcome === 'wrong' ? answer(open, false) : expire(open);
      expect(state.scoreboard.map((score) => score.points)).toEqual([0, 0]);
      expect(state.history).toHaveLength(1);
      expect(state.history[0]!.effects).toEqual([
        { kind: 'debit', reason: 'pressure', playerId: players[0], amount: 50 },
      ]);
      expect(state.roster.players).toHaveLength(2);
      expect(
        transitionMatch(state, { kind: 'timer', timer }, timer.deadlineAt, registry).state,
      ).toBe(state);
      expect(() => answer(state, false)).toThrowError(
        expect.objectContaining({ code: 'INVALID_PHASE' }),
      );
      const next = expire(state);
      const question = prepared(400);
      question.publicQuestion.difficulty = 'medium';
      const nextReading = transitionMatch(
        next,
        { kind: 'question-prepared', question },
        20_000,
        registry,
      ).state;
      const nextOpen = expire(nextReading);
      expect(nextOpen.stage).toMatchObject({
        phase: 'question-open',
        opensAt: 23_000,
        deadlineAt: 33_000,
      });
      expect(currentPressureTurn(nextOpen)?.playerId).toBe(players[1]);
    },
  );
  it('acerto credita 300 uma vez; leitura, terceiro e anfitrião fora do turno não consomem resposta', () => {
    const state = reading();
    expect(() => answer(state, true)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PHASE' }),
    );
    const open = expire(state);
    expect(() => answer(open, true, players[1]!)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => answer(open, true, playerIdSchema.parse(uuid(99)))).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    const result = answer(open, true);
    expect(result.scoreboard.map((score) => score.points)).toEqual([350, 0]);
    expect(buildMatchView(result, players[1]!).pressureTurn).toMatchObject({
      outcome: 'passed',
      nextPlayerId: players[1],
    });
    expect(open.history).toHaveLength(0);
  });
  it('prazo usa intervalo fechado na abertura e aberto no fim; callback atrasado não reinicia relógio', () => {
    const open = expire(reading());
    expect(() => answer(open, true, players[0]!, 3999)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    expect(() => answer(open, true, players[0]!, 14_000)).toThrowError(
      expect.objectContaining({ code: 'DEADLINE_EXPIRED' }),
    );
    expect(answer(open, true, players[0]!, 13_999).scoreboard[0]!.points).toBe(350);
    const late = expire(reading(), 10_000);
    expect(late.stage.phase).toBe('reveal');
    expect(late.scoreboard[0]!.points).toBe(0);
  });
  it('projeções restringem controles, ocultam gabarito e preservam ordem congelada', () => {
    const state = expire(reading());
    expect(buildMatchView(state, players[0]!).stage).toMatchObject({
      ownAnswer: { status: 'pending' },
    });
    for (const id of [players[1]!, playerIdSchema.parse(uuid(99))]) {
      const view = buildMatchView(state, id);
      expect(view.stage).toMatchObject({
        ownAnswer: { status: 'unavailable' },
        respondents: { kind: 'single-player', playerId: players[0] },
      });
      expect(JSON.stringify(view)).not.toMatch(
        /"correctOptionId"|"pressureOrder"|"receivedAt"|"outcome"|"lives"/,
      );
    }
    expect(() =>
      createMatch(roster, freezeMatchRules(roster.matchId), [pressureRound], registry, [
        players[0]!,
        players[0]!,
      ]),
    ).toThrow();
    expect(() =>
      createMatch(roster, freezeMatchRules(roster.matchId), [pressureRound], registry),
    ).toThrow();
  });
});

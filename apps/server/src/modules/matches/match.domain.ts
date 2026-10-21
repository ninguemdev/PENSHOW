import {
  scoringRoundSchema,
  type MatchId,
  type OptionId,
  type PlayerId,
  type QuestionId,
  type RoundId,
  type Scoreboard,
  type ScoringRound,
} from '@penshow/shared';
import type { QuizRoster } from '../rooms/room.js';
import type { PreparedQuestion } from '../questions/question.js';
import type { RoundSelectionView, SelectionCheckpoint } from '../questions/question-selection.js';
import { freezeMatchRules, type FrozenMatchRules } from '../scoring/match-rules.js';
import {
  createScoreboard,
  sealWager,
  type SealedWager,
  type QuestionScoreResolution,
} from '../scoring/scoring.domain.js';
import type { StrategyRegistry } from './match-strategy.js';
import { pressureTurn } from './pressure-turns.domain.js';
import { prepareFinalEntry, type FrozenFinalEntry } from '../scoring/final-entry.domain.js';
import {
  finalDeadline,
  transitionFinal,
  type FinalState,
  type FinalStage,
  type FinalEvent,
} from '../final/final.domain.js';

type Offer = Extract<RoundSelectionView, { status: 'choosing' }>;
export interface MatchAnswer {
  playerId: PlayerId;
  optionId: OptionId;
  receivedAt: number;
}
interface TheftResult {
  attackerPlayerId: PlayerId | null;
  targetPlayerId: PlayerId | null;
  amount: number;
}
export type MatchStage =
  | { phase: 'instructions'; deadlineAt: number; readyPlayerIds: PlayerId[] }
  | { phase: 'awaiting-category' }
  | { phase: 'category-selection'; offer: Offer }
  | { phase: 'awaiting-question'; previousQuestionId: QuestionId | null }
  | { phase: 'wager-selection'; question: PreparedQuestion; deadlineAt: number }
  | { phase: 'question-reading'; question: PreparedQuestion; opensAt: number }
  | {
      phase: 'question-open';
      question: PreparedQuestion;
      opensAt: number;
      deadlineAt: number;
      answers: MatchAnswer[];
    }
  | {
      phase: 'theft-target-selection';
      question: PreparedQuestion;
      resolution: QuestionScoreResolution;
      attackerPlayerId: PlayerId;
      eligibleTargetIds: PlayerId[];
      deadlineAt: number;
    }
  | {
      phase: 'reveal';
      question: PreparedQuestion;
      resolution: QuestionScoreResolution;
      theftResult?: TheftResult;
      deadlineAt: number;
    }
  | { phase: 'round-results'; deadlineAt: number }
  | { phase: 'prototype-complete' }
  | { phase: 'interrupted'; reason: 'insufficient-questions' | 'no-players' | 'room-closed' };
export interface MatchState {
  roster: QuizRoster;
  rules: FrozenMatchRules;
  rounds: ScoringRound[];
  roundIndex: number;
  revision: number;
  scoreboard: Scoreboard;
  history: QuestionScoreResolution[];
  wagers: SealedWager[];
  pressureOrder: PlayerId[];
  finalEntry: FrozenFinalEntry | null;
  final: FinalState | null;
  stage: MatchStage;
}
export interface MatchSession {
  state: MatchState;
  selection: SelectionCheckpoint;
  suspended?: true;
}
export interface MatchContext {
  matchId: MatchId;
  roundId: RoundId;
}
export interface MatchTimer extends MatchContext {
  questionId: QuestionId | null;
  revision: number;
  phase: MatchStage['phase'] | FinalStage['phase'];
  deadlineAt: number;
}
export type MatchCommand = MatchContext &
  (
    | { kind: 'ready'; playerId: PlayerId }
    | { kind: 'choose-category'; playerId: PlayerId; category: string }
    | { kind: 'answer'; playerId: PlayerId; questionId: QuestionId; optionId: OptionId }
    | { kind: 'wager'; playerId: PlayerId; questionId: QuestionId; amount: number }
    | { kind: 'target'; playerId: PlayerId; questionId: QuestionId; targetPlayerId: PlayerId }
  );
export type MatchEvent =
  | MatchCommand
  | { kind: 'timer'; timer: MatchTimer }
  | { kind: 'category-offered'; offer: Offer }
  | { kind: 'question-prepared'; question: PreparedQuestion | null }
  | { kind: 'final-question-prepared'; question: PreparedQuestion | null }
  | { kind: 'interrupt'; reason: Extract<MatchStage, { phase: 'interrupted' }>['reason'] };
export type MatchInput = {
  [Kind in MatchCommand['kind']]: Omit<Extract<MatchCommand, { kind: Kind }>, 'playerId'>;
}[MatchCommand['kind']];
export type MatchEffect =
  | { kind: 'offer-categories' }
  | { kind: 'select-category'; playerId: PlayerId; category: string }
  | { kind: 'expire-category' }
  | { kind: 'next-question'; previousQuestionId: QuestionId | null }
  | { kind: 'next-final-question'; previousQuestionId: QuestionId | null };
export class MatchError extends Error {
  constructor(
    readonly code:
      | 'INVALID_PHASE'
      | 'STALE_CONTEXT'
      | 'FORBIDDEN'
      | 'DEADLINE_EXPIRED'
      | 'ALREADY_ANSWERED'
      | 'INVALID_PAYLOAD'
      | 'INSUFFICIENT_BALANCE'
      | 'ACTION_CONFLICT'
      | 'INVALID_TARGET',
  ) {
    super(code);
  }
}
function time(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new MatchError('INVALID_PAYLOAD');
  return value;
}
function deadline(now: number, duration: number) {
  return time(now + duration);
}
export function currentRound(state: MatchState): ScoringRound {
  return state.rounds[state.roundIndex]!;
}
export function currentPressureTurn(state: MatchState) {
  const round = currentRound(state);
  if (round.mode !== 'pressure') return null;
  const completed = state.history.filter(
    (record) => record.context.roundId === round.roundId,
  ).length;
  return pressureTurn(
    state.pressureOrder,
    state.rules.parameters.pressure.turnDifficulties,
    completed - (state.stage.phase === 'reveal' ? 1 : 0),
  );
}
export function createMatch(
  roster: QuizRoster,
  rules: FrozenMatchRules,
  rounds: readonly ScoringRound[],
  strategies: StrategyRegistry,
  pressureOrder: readonly PlayerId[] = [],
): MatchState {
  time(roster.startedAt);
  if (
    rules.matchId !== roster.matchId ||
    !rounds.length ||
    new Set(rounds.map((round) => round.roundId)).size !== rounds.length
  )
    throw new MatchError('INVALID_PAYLOAD');
  for (const round of rounds) strategies.get(scoringRoundSchema.parse(round).mode);
  if (
    rounds.some((round) => round.mode === 'pressure') &&
    (pressureOrder.length !== roster.players.length ||
      new Set(pressureOrder).size !== pressureOrder.length ||
      pressureOrder.some((id) => !roster.players.some((player) => player.playerId === id)))
  )
    throw new MatchError('INVALID_PAYLOAD');
  return {
    roster: structuredClone(roster),
    rules: freezeMatchRules(roster.matchId, rules.parameters),
    rounds: structuredClone([...rounds]),
    roundIndex: 0,
    revision: 0,
    scoreboard: createScoreboard(roster.players.map((player) => player.playerId)),
    history: [],
    wagers: [],
    pressureOrder: [...pressureOrder],
    finalEntry: null,
    final: null,
    stage: {
      phase: 'instructions',
      readyPlayerIds: [],
      deadlineAt: deadline(roster.startedAt, rules.parameters.timings.instructionsMs),
    },
  };
}
export function matchTimer(state: MatchState): MatchTimer | null {
  if (state.final) {
    const stage = state.final.stage,
      deadlineAt = finalDeadline(state.final);
    return deadlineAt === null
      ? null
      : {
          matchId: state.roster.matchId,
          roundId: state.final.round.roundId,
          questionId: 'question' in stage ? stage.question.publicQuestion.questionId : null,
          revision: state.revision,
          phase: stage.phase,
          deadlineAt,
        };
  }
  const stage = state.stage;
  const deadlineAt =
    stage.phase === 'question-reading'
      ? stage.opensAt
      : stage.phase === 'category-selection'
        ? stage.offer.deadlineAt
        : 'deadlineAt' in stage
          ? stage.deadlineAt
          : null;
  return deadlineAt === null
    ? null
    : {
        matchId: state.roster.matchId,
        roundId: currentRound(state).roundId,
        questionId: 'question' in stage ? stage.question.publicQuestion.questionId : null,
        revision: state.revision,
        phase: stage.phase,
        deadlineAt,
      };
}
export function sameTimer(left: MatchTimer | null, right: MatchTimer | null): boolean {
  return (
    left !== null &&
    right !== null &&
    left.matchId === right.matchId &&
    left.roundId === right.roundId &&
    left.questionId === right.questionId &&
    left.revision === right.revision &&
    left.phase === right.phase &&
    left.deadlineAt === right.deadlineAt
  );
}

/** Pure reducer: trusted time and content arrive as data; no I/O, random draw or ID generation. */
export function transitionMatch(
  before: MatchState,
  event: MatchEvent,
  now: number,
  strategies: StrategyRegistry,
): { state: MatchState; effects: MatchEffect[]; changed: boolean } {
  time(now);
  const ignored = () => ({ state: before, effects: [], changed: false });
  const terminal = ['prototype-complete', 'interrupted'].includes(before.stage.phase);
  if (
    event.kind === 'timer' &&
    (!sameTimer(matchTimer(before), event.timer) || now < event.timer.deadlineAt)
  )
    return ignored();
  if (before.final) {
    let input: FinalEvent;
    if (event.kind === 'timer') input = { kind: 'expire' };
    else if (
      event.kind === 'ready' ||
      event.kind === 'answer' ||
      event.kind === 'target' ||
      event.kind === 'interrupt' ||
      event.kind === 'final-question-prepared'
    )
      input = event;
    else throw new MatchError('INVALID_PHASE');
    const result = transitionFinal(before.final, input, now, before.rules);
    if (!result.changed) return ignored();
    const state = structuredClone(before);
    state.final = result.state;
    state.revision++;
    return {
      state,
      changed: true,
      effects:
        'nextQuestion' in result
          ? [
              {
                kind: 'next-final-question' as const,
                previousQuestionId: result.nextQuestion ?? null,
              },
            ]
          : [],
    };
  }
  if (event.kind === 'interrupt' && terminal) return ignored();
  if (terminal) throw new MatchError('INVALID_PHASE');
  if ('matchId' in event) {
    if (event.matchId !== before.roster.matchId || event.roundId !== currentRound(before).roundId)
      throw new MatchError('STALE_CONTEXT');
    if (!before.roster.players.some((player) => player.playerId === event.playerId))
      throw new MatchError('FORBIDDEN');
  }
  const state = structuredClone(before);
  const effects: MatchEffect[] = [];
  const stage = state.stage;
  const round = currentRound(state);
  const parameters = state.rules.parameters;
  const offer = () => {
    state.stage = { phase: 'awaiting-category' };
    effects.push({ kind: 'offer-categories' });
  };
  const nextQuestion = (previousQuestionId: QuestionId | null) => {
    state.stage = { phase: 'awaiting-question', previousQuestionId };
    effects.push({ kind: 'next-question', previousQuestionId });
  };
  const commitReveal = (
    question: PreparedQuestion,
    resolution: QuestionScoreResolution,
    theftResult?: TheftResult,
  ) => {
    if (
      state.history.some(
        (record) => record.context.questionId === question.publicQuestion.questionId,
      )
    )
      throw new MatchError('STALE_CONTEXT');
    state.scoreboard = structuredClone(resolution.after);
    state.history.push(structuredClone(resolution));
    state.stage = {
      phase: 'reveal',
      question,
      resolution,
      ...(theftResult ? { theftResult } : {}),
      deadlineAt: deadline(now, parameters[round.mode].revealMs + parameters.timings.transitionMs),
    };
  };
  const reveal = (open: Extract<MatchStage, { phase: 'question-open' }>) => {
    if (
      state.history.some(
        (record) => record.context.questionId === open.question.publicQuestion.questionId,
      )
    )
      throw new MatchError('STALE_CONTEXT');
    const resolution = strategies.get(round.mode).resolve(
      state.rules,
      state.scoreboard,
      {
        matchId: state.roster.matchId,
        roundId: round.roundId,
        questionId: open.question.publicQuestion.questionId,
        opensAt: open.opensAt,
      },
      open.answers.map((answer) => ({
        playerId: answer.playerId,
        receivedAt: answer.receivedAt,
        correct: answer.optionId === open.question.correctOptionId,
      })),
      {
        wagers: state.wagers,
        ...(round.mode === 'pressure'
          ? { respondentId: currentPressureTurn(state)!.playerId }
          : {}),
      },
    );
    if (round.mode === 'theft') {
      const attackerPlayerId =
        open.answers.find((answer) => answer.optionId === open.question.correctOptionId)
          ?.playerId ?? null;
      const eligibleTargetIds = resolution.after
        .filter((score) => score.playerId !== attackerPlayerId && score.points > 0)
        .map((score) => score.playerId);
      if (attackerPlayerId && eligibleTargetIds.length > 0) {
        state.scoreboard = structuredClone(resolution.after);
        state.stage = {
          phase: 'theft-target-selection',
          question: open.question,
          resolution,
          attackerPlayerId,
          eligibleTargetIds,
          deadlineAt: deadline(now, parameters.theft.targetSelectionMs),
        };
        return;
      }
      commitReveal(open.question, resolution, {
        attackerPlayerId,
        targetPlayerId: null,
        amount: 0,
      });
    } else commitReveal(open.question, resolution);
  };
  switch (event.kind) {
    case 'target': {
      if (!('question' in stage) || stage.question.publicQuestion.questionId !== event.questionId)
        throw new MatchError('STALE_CONTEXT');
      if (stage.phase !== 'theft-target-selection' || round.mode !== 'theft')
        throw new MatchError('INVALID_PHASE');
      if (event.playerId !== stage.attackerPlayerId) throw new MatchError('FORBIDDEN');
      if (now >= stage.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      if (!stage.eligibleTargetIds.includes(event.targetPlayerId))
        throw new MatchError('INVALID_TARGET');
      const strategy = strategies.get(round.mode);
      if (!strategy.settleTarget) throw new Error('Resolução de alvo não instalada.');
      const resolution = strategy.settleTarget(
        state.rules,
        stage.resolution,
        stage.attackerPlayerId,
        event.targetPlayerId,
      );
      const amount =
        resolution.effects.find((effect) => effect.reason === 'theft' && effect.kind === 'credit')
          ?.amount ?? 0;
      commitReveal(stage.question, resolution, {
        attackerPlayerId: stage.attackerPlayerId,
        targetPlayerId: event.targetPlayerId,
        amount,
      });
      break;
    }
    case 'wager': {
      if (!('question' in stage) || stage.question.publicQuestion.questionId !== event.questionId)
        throw new MatchError('STALE_CONTEXT');
      if (stage.phase !== 'wager-selection' || round.mode !== 'wager')
        throw new MatchError('INVALID_PHASE');
      if (now >= stage.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      const previous = state.wagers.find((wager) => wager.playerId === event.playerId);
      if (previous) {
        if (previous.amount !== event.amount) throw new MatchError('ACTION_CONFLICT');
        return ignored();
      }
      if (!parameters.wager.allowedAmounts.includes(event.amount))
        throw new MatchError('INVALID_PAYLOAD');
      const score = state.scoreboard.find((entry) => entry.playerId === event.playerId)!;
      if (event.amount > score.points) throw new MatchError('INSUFFICIENT_BALANCE');
      state.wagers.push(sealWager(state.rules, score, event.amount));
      break;
    }
    case 'ready':
      if (stage.phase !== 'instructions') throw new MatchError('INVALID_PHASE');
      if (stage.readyPlayerIds.includes(event.playerId)) return ignored();
      if (now >= stage.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      stage.readyPlayerIds.push(event.playerId);
      if (stage.readyPlayerIds.length === state.roster.players.length) offer();
      break;
    case 'choose-category':
      if (stage.phase !== 'category-selection') throw new MatchError('INVALID_PHASE');
      if (stage.offer.chooserPlayerId !== event.playerId) throw new MatchError('FORBIDDEN');
      if (now >= stage.offer.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      if (!stage.offer.categories.includes(event.category as Offer['categories'][number]))
        throw new MatchError('INVALID_PAYLOAD');
      effects.push({ kind: 'select-category', playerId: event.playerId, category: event.category });
      nextQuestion(null);
      break;
    case 'answer': {
      if (!('question' in stage) || stage.question.publicQuestion.questionId !== event.questionId)
        throw new MatchError('STALE_CONTEXT');
      if (stage.phase !== 'question-open') throw new MatchError('INVALID_PHASE');
      if (round.mode === 'pressure' && currentPressureTurn(state)?.playerId !== event.playerId)
        throw new MatchError('FORBIDDEN');
      if (stage.answers.some((answer) => answer.playerId === event.playerId))
        throw new MatchError('ALREADY_ANSWERED');
      if (now < stage.opensAt || now >= stage.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      if (
        !stage.question.publicQuestion.options.some((option) => option.optionId === event.optionId)
      )
        throw new MatchError('INVALID_PAYLOAD');
      stage.answers.push({ playerId: event.playerId, optionId: event.optionId, receivedAt: now });
      if (round.mode === 'pressure' || stage.answers.length === state.roster.players.length)
        reveal(stage);
      break;
    }
    case 'timer':
      switch (stage.phase) {
        case 'instructions':
          offer();
          break;
        case 'category-selection':
          effects.push({ kind: 'expire-category' });
          nextQuestion(null);
          break;
        case 'wager-selection':
          state.stage = {
            phase: 'question-reading',
            question: stage.question,
            opensAt: deadline(now, parameters.timings.readingMs),
          };
          break;
        case 'question-reading':
          state.stage = {
            phase: 'question-open',
            question: stage.question,
            opensAt: stage.opensAt,
            deadlineAt: deadline(stage.opensAt, parameters[round.mode].responseMs),
            answers: [],
          };
          if (now >= state.stage.deadlineAt) reveal(state.stage);
          break;
        case 'question-open':
          reveal(stage);
          break;
        case 'theft-target-selection':
          commitReveal(stage.question, stage.resolution, {
            attackerPlayerId: stage.attackerPlayerId,
            targetPlayerId: null,
            amount: 0,
          });
          break;
        case 'reveal':
          nextQuestion(stage.question.publicQuestion.questionId);
          break;
        case 'round-results':
          if (state.roundIndex + 1 === state.rounds.length) {
            state.finalEntry = prepareFinalEntry(
              {
                matchId: state.roster.matchId,
                scope: 'isolated-prototype',
                scores: state.scoreboard,
              },
              state.finalEntry,
            );
            state.stage = { phase: 'prototype-complete' };
          } else {
            state.roundIndex++;
            state.stage = {
              phase: 'instructions',
              readyPlayerIds: [],
              deadlineAt: deadline(now, parameters.timings.instructionsMs),
            };
          }
          break;
        default:
          throw new MatchError('INVALID_PHASE');
      }
      break;
    case 'category-offered':
      if (
        stage.phase !== 'awaiting-category' ||
        event.offer.roundId !== round.roundId ||
        event.offer.mode !== round.mode ||
        event.offer.deadlineAt <= now ||
        !state.roster.players.some((player) => player.playerId === event.offer.chooserPlayerId)
      )
        throw new MatchError('INVALID_PHASE');
      state.stage = { phase: 'category-selection', offer: structuredClone(event.offer) };
      break;
    case 'question-prepared':
      if (stage.phase !== 'awaiting-question') throw new MatchError('INVALID_PHASE');
      if (
        event.question &&
        state.history.some(
          (record) => record.context.questionId === event.question!.publicQuestion.questionId,
        )
      )
        throw new MatchError('STALE_CONTEXT');
      state.wagers = [];
      if (
        event.question &&
        round.mode === 'pressure' &&
        event.question.publicQuestion.difficulty !== currentPressureTurn(state)?.difficulty
      )
        throw new MatchError('INVALID_PAYLOAD');
      state.stage = event.question
        ? round.mode === 'wager'
          ? {
              phase: 'wager-selection',
              question: structuredClone(event.question),
              deadlineAt: deadline(now, parameters.wager.selectionMs),
            }
          : {
              phase: 'question-reading',
              question: structuredClone(event.question),
              opensAt: deadline(now, parameters.timings.readingMs),
            }
        : { phase: 'round-results', deadlineAt: deadline(now, parameters.timings.roundResultsMs) };
      break;
    case 'interrupt':
      state.stage = { phase: 'interrupted', reason: event.reason };
      break;
    case 'final-question-prepared':
      throw new MatchError('INVALID_PHASE');
  }
  state.revision++;
  return { state, effects, changed: true };
}

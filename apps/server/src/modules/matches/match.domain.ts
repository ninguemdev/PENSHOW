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
import { createScoreboard, type QuestionScoreResolution } from '../scoring/scoring.domain.js';
import type { StrategyRegistry } from './match-strategy.js';

type Offer = Extract<RoundSelectionView, { status: 'choosing' }>;
export interface MatchAnswer {
  playerId: PlayerId;
  optionId: OptionId;
  receivedAt: number;
}
export type MatchStage =
  | { phase: 'instructions'; deadlineAt: number; readyPlayerIds: PlayerId[] }
  | { phase: 'awaiting-category' }
  | { phase: 'category-selection'; offer: Offer }
  | { phase: 'awaiting-question'; previousQuestionId: QuestionId | null }
  | { phase: 'question-reading'; question: PreparedQuestion; opensAt: number }
  | {
      phase: 'question-open';
      question: PreparedQuestion;
      opensAt: number;
      deadlineAt: number;
      answers: MatchAnswer[];
    }
  | {
      phase: 'reveal';
      question: PreparedQuestion;
      resolution: QuestionScoreResolution;
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
  stage: MatchStage;
}
export interface MatchSession {
  state: MatchState;
  selection: SelectionCheckpoint;
}
export interface MatchContext {
  matchId: MatchId;
  roundId: RoundId;
}
export interface MatchTimer extends MatchContext {
  questionId: QuestionId | null;
  revision: number;
  phase: MatchStage['phase'];
  deadlineAt: number;
}
export type MatchCommand = MatchContext &
  (
    | { kind: 'ready'; playerId: PlayerId }
    | { kind: 'choose-category'; playerId: PlayerId; category: string }
    | { kind: 'answer'; playerId: PlayerId; questionId: QuestionId; optionId: OptionId }
  );
export type MatchEvent =
  | MatchCommand
  | { kind: 'timer'; timer: MatchTimer }
  | { kind: 'category-offered'; offer: Offer }
  | { kind: 'question-prepared'; question: PreparedQuestion | null }
  | { kind: 'interrupt'; reason: Extract<MatchStage, { phase: 'interrupted' }>['reason'] };
export type MatchInput = {
  [Kind in MatchCommand['kind']]: Omit<Extract<MatchCommand, { kind: Kind }>, 'playerId'>;
}[MatchCommand['kind']];
export type MatchEffect =
  | { kind: 'offer-categories' }
  | { kind: 'select-category'; playerId: PlayerId; category: string }
  | { kind: 'expire-category' }
  | { kind: 'next-question'; previousQuestionId: QuestionId | null };
export class MatchError extends Error {
  constructor(
    readonly code:
      | 'INVALID_PHASE'
      | 'STALE_CONTEXT'
      | 'FORBIDDEN'
      | 'DEADLINE_EXPIRED'
      | 'ALREADY_ANSWERED'
      | 'INVALID_PAYLOAD',
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
export function createMatch(
  roster: QuizRoster,
  rules: FrozenMatchRules,
  rounds: readonly ScoringRound[],
  strategies: StrategyRegistry,
): MatchState {
  time(roster.startedAt);
  if (
    rules.matchId !== roster.matchId ||
    !rounds.length ||
    new Set(rounds.map((round) => round.roundId)).size !== rounds.length
  )
    throw new MatchError('INVALID_PAYLOAD');
  for (const round of rounds) strategies.get(scoringRoundSchema.parse(round).mode);
  return {
    roster: structuredClone(roster),
    rules: freezeMatchRules(roster.matchId, rules.parameters),
    rounds: structuredClone([...rounds]),
    roundIndex: 0,
    revision: 0,
    scoreboard: createScoreboard(roster.players.map((player) => player.playerId)),
    history: [],
    stage: {
      phase: 'instructions',
      readyPlayerIds: [],
      deadlineAt: deadline(roster.startedAt, rules.parameters.timings.instructionsMs),
    },
  };
}
export function matchTimer(state: MatchState): MatchTimer | null {
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
    );
    state.scoreboard = structuredClone(resolution.after);
    state.history.push(structuredClone(resolution));
    state.stage = {
      phase: 'reveal',
      question: open.question,
      resolution,
      deadlineAt: deadline(now, parameters[round.mode].revealMs + parameters.timings.transitionMs),
    };
  };
  switch (event.kind) {
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
      if (stage.answers.some((answer) => answer.playerId === event.playerId))
        throw new MatchError('ALREADY_ANSWERED');
      if (now < stage.opensAt || now >= stage.deadlineAt) throw new MatchError('DEADLINE_EXPIRED');
      if (
        !stage.question.publicQuestion.options.some((option) => option.optionId === event.optionId)
      )
        throw new MatchError('INVALID_PAYLOAD');
      stage.answers.push({ playerId: event.playerId, optionId: event.optionId, receivedAt: now });
      if (stage.answers.length === state.roster.players.length) reveal(stage);
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
        case 'reveal':
          nextQuestion(stage.question.publicQuestion.questionId);
          break;
        case 'round-results':
          if (state.roundIndex + 1 === state.rounds.length)
            state.stage = { phase: 'prototype-complete' };
          else {
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
      state.stage = event.question
        ? {
            phase: 'question-reading',
            question: structuredClone(event.question),
            opensAt: deadline(now, parameters.timings.readingMs),
          }
        : { phase: 'round-results', deadlineAt: deadline(now, parameters.timings.roundResultsMs) };
      break;
    case 'interrupt':
      state.stage = { phase: 'interrupted', reason: event.reason };
      break;
  }
  state.revision++;
  return { state, effects, changed: true };
}

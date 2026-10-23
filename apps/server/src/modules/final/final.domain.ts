import {
  finalistsSchema,
  roundSchema,
  type Finalist,
  type FinalResolution,
  type MatchId,
  type OptionId,
  type PlayerId,
  type QuestionId,
  type Round,
  type RoundId,
} from '@penshow/shared';
import type { PreparedQuestion } from '../questions/question.js';
import { questionReadingMs } from '../questions/question-reading.js';
import type { FrozenMatchRules } from '../scoring/match-rules.js';
import type { FrozenFinalEntry } from '../scoring/final-entry.domain.js';

type FinalRound = Extract<Round, { mode: 'final' }>;
type Accepted = { playerId: PlayerId; optionId: OptionId; receivedAt: number };
export type FinalStage =
  | { phase: 'final-instructions'; readyPlayerIds: PlayerId[]; deadlineAt: number }
  | { phase: 'awaiting-final-question'; previousQuestionId: QuestionId | null }
  | { phase: 'final-question-reading'; question: PreparedQuestion; opensAt: number }
  | {
      phase: 'final-question-open';
      question: PreparedQuestion;
      opensAt: number;
      deadlineAt: number;
    }
  | { phase: 'final-answer-locked'; question: PreparedQuestion; accepted: Accepted }
  | {
      phase: 'final-target-selection';
      question: PreparedQuestion;
      accepted: Accepted;
      deadlineAt: number;
    }
  | {
      phase: 'final-resolution';
      question: PreparedQuestion;
      resolution: FinalResolution;
      deadlineAt: number;
    }
  | { phase: 'final-no-answer-pending'; question: PreparedQuestion }
  | { phase: 'final-no-target-pending'; question: PreparedQuestion; accepted: Accepted }
  | { phase: 'podium' }
  | { phase: 'interrupted'; reason: 'insufficient-questions' | 'no-players' | 'room-closed' };
export interface FinalState {
  matchId: MatchId;
  round: FinalRound;
  finalists: Finalist[];
  history: {
    questionId: QuestionId;
    accepted: Accepted;
    resolution: FinalResolution;
    before: Finalist[];
    after: Finalist[];
  }[];
  stage: FinalStage;
}
export type FinalEvent =
  | { kind: 'ready'; matchId: MatchId; roundId: RoundId; playerId: PlayerId }
  | {
      kind: 'answer';
      matchId: MatchId;
      roundId: RoundId;
      playerId: PlayerId;
      questionId: QuestionId;
      optionId: OptionId;
    }
  | {
      kind: 'target';
      matchId: MatchId;
      roundId: RoundId;
      playerId: PlayerId;
      questionId: QuestionId;
      targetPlayerId: PlayerId;
    }
  | { kind: 'expire' }
  | { kind: 'final-question-prepared'; question: PreparedQuestion | null }
  | { kind: 'interrupt'; reason: 'insufficient-questions' | 'no-players' | 'room-closed' };
export class FinalError extends Error {
  constructor(
    readonly code:
      | 'INVALID_PHASE'
      | 'STALE_CONTEXT'
      | 'FORBIDDEN'
      | 'DEADLINE_EXPIRED'
      | 'INVALID_PAYLOAD'
      | 'INVALID_TARGET'
      | 'QUESTION_CLOSED',
  ) {
    super(code);
  }
}
function instant(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new FinalError('INVALID_PAYLOAD');
  return value;
}
export function createFinal(
  entry: FrozenFinalEntry,
  rules: FrozenMatchRules,
  roundId: RoundId,
  now: number,
  index: 5 | 6 = 6,
): FinalState {
  instant(now);
  if (entry.matchId !== rules.matchId) throw new FinalError('STALE_CONTEXT');
  if (entry.status !== 'ready') throw new FinalError('INVALID_PHASE');
  const round = roundSchema.parse({ roundId, index, mode: 'final' });
  if (round.mode !== 'final') throw new FinalError('INVALID_PAYLOAD');
  return {
    matchId: entry.matchId,
    round,
    finalists: finalistsSchema.parse(
      entry.allocations.map((row) => ({
        playerId: row.playerId,
        rank: row.rank,
        initialLives: row.initialLives,
        lives: row.initialLives,
        status: 'active',
      })),
    ),
    history: [],
    stage: {
      phase: 'final-instructions',
      readyPlayerIds: [],
      deadlineAt: instant(now + rules.parameters.timings.instructionsMs),
    },
  };
}
export function finalDeadline(state: FinalState) {
  const stage = state.stage;
  return stage.phase === 'final-question-reading'
    ? stage.opensAt
    : 'deadlineAt' in stage
      ? stage.deadlineAt
      : null;
}
export function transitionFinal(
  before: FinalState,
  event: FinalEvent,
  now: number,
  rules: FrozenMatchRules,
): { state: FinalState; changed: boolean; nextQuestion?: QuestionId | null } {
  instant(now);
  if (rules.matchId !== before.matchId) throw new FinalError('STALE_CONTEXT');
  if (
    'matchId' in event &&
    (event.matchId !== before.matchId || event.roundId !== before.round.roundId)
  )
    throw new FinalError('STALE_CONTEXT');
  const ignored = () => ({ state: before, changed: false });
  if (event.kind === 'expire' && (finalDeadline(before) === null || now < finalDeadline(before)!))
    return ignored();
  if (['podium', 'interrupted'].includes(before.stage.phase)) {
    if (event.kind === 'interrupt') return ignored();
    throw new FinalError('INVALID_PHASE');
  }
  const state = structuredClone(before),
    stage = state.stage;
  const active = (id: PlayerId) =>
    state.finalists.some((player) => player.playerId === id && player.status === 'active');
  if ('playerId' in event && !active(event.playerId)) throw new FinalError('FORBIDDEN');
  const next = (previousQuestionId: QuestionId | null) => {
    state.stage = { phase: 'awaiting-final-question', previousQuestionId };
    return { state, changed: true, nextQuestion: previousQuestionId };
  };
  const settle = (
    question: PreparedQuestion,
    accepted: Accepted,
    victimId: PlayerId,
    outcome: 'wrong-answer' | 'attack',
  ) => {
    const original = structuredClone(state.finalists);
    const victim = state.finalists.find((player) => player.playerId === victimId);
    if (!victim || victim.status !== 'active') throw new FinalError('INVALID_TARGET');
    const index = state.finalists.indexOf(victim),
      lives = victim.lives - 1;
    state.finalists[index] =
      lives === 0
        ? {
            playerId: victim.playerId,
            rank: victim.rank,
            initialLives: victim.initialLives,
            lives: 0,
            status: 'eliminated',
            eliminationOrder:
              state.finalists.filter((player) => player.status === 'eliminated').length + 1,
          }
        : { ...victim, lives };
    const result: FinalResolution =
      outcome === 'attack'
        ? {
            outcome,
            playerId: accepted.playerId,
            optionId: accepted.optionId,
            targetPlayerId: victimId,
            damage: 1,
          }
        : { outcome, playerId: accepted.playerId, optionId: accepted.optionId, damage: 1 };
    if (state.history.some((record) => record.questionId === question.publicQuestion.questionId))
      throw new FinalError('STALE_CONTEXT');
    state.history.push({
      questionId: question.publicQuestion.questionId,
      accepted,
      resolution: result,
      before: original,
      after: structuredClone(state.finalists),
    });
    state.stage = {
      phase: 'final-resolution',
      question,
      resolution: result,
      deadlineAt: instant(
        now + rules.parameters.final.revealMs + rules.parameters.timings.transitionMs,
      ),
    };
  };
  switch (event.kind) {
    case 'ready':
      if (stage.phase !== 'final-instructions') throw new FinalError('INVALID_PHASE');
      if (now >= stage.deadlineAt) throw new FinalError('DEADLINE_EXPIRED');
      if (stage.readyPlayerIds.includes(event.playerId)) return ignored();
      stage.readyPlayerIds.push(event.playerId);
      if (stage.readyPlayerIds.length === state.finalists.length) return next(null);
      break;
    case 'final-question-prepared':
      if (stage.phase !== 'awaiting-final-question') throw new FinalError('INVALID_PHASE');
      if (!event.question) {
        state.stage = { phase: 'interrupted', reason: 'insufficient-questions' };
        break;
      }
      if (
        state.history.some(
          (record) => record.questionId === event.question!.publicQuestion.questionId,
        )
      )
        throw new FinalError('STALE_CONTEXT');
      state.stage = {
        phase: 'final-question-reading',
        question: structuredClone(event.question),
        opensAt: instant(
          now + questionReadingMs(event.question, rules.parameters.timings.readingMs),
        ),
      };
      break;
    case 'answer': {
      if (!('question' in stage) || stage.question.publicQuestion.questionId !== event.questionId)
        throw new FinalError('STALE_CONTEXT');
      if (stage.phase !== 'final-question-open')
        throw new FinalError(
          [
            'final-answer-locked',
            'final-target-selection',
            'final-resolution',
            'final-no-answer-pending',
            'final-no-target-pending',
          ].includes(stage.phase)
            ? 'QUESTION_CLOSED'
            : 'INVALID_PHASE',
        );
      if (now < stage.opensAt || now >= stage.deadlineAt) throw new FinalError('DEADLINE_EXPIRED');
      if (
        !stage.question.publicQuestion.options.some((option) => option.optionId === event.optionId)
      )
        throw new FinalError('INVALID_PAYLOAD');
      const accepted = { playerId: event.playerId, optionId: event.optionId, receivedAt: now };
      // Lock the opportunity before evaluating correctness. The room commits one atomic result.
      state.stage = { phase: 'final-answer-locked', question: stage.question, accepted };
      if (event.optionId === stage.question.correctOptionId)
        state.stage = {
          phase: 'final-target-selection',
          question: stage.question,
          accepted,
          deadlineAt: instant(now + rules.parameters.final.targetSelectionMs),
        };
      else settle(stage.question, accepted, event.playerId, 'wrong-answer');
      break;
    }
    case 'target':
      if (!('question' in stage) || stage.question.publicQuestion.questionId !== event.questionId)
        throw new FinalError('STALE_CONTEXT');
      if (stage.phase !== 'final-target-selection') throw new FinalError('INVALID_PHASE');
      if (stage.accepted.playerId !== event.playerId) throw new FinalError('FORBIDDEN');
      if (now >= stage.deadlineAt) throw new FinalError('DEADLINE_EXPIRED');
      if (event.targetPlayerId === event.playerId || !active(event.targetPlayerId))
        throw new FinalError('INVALID_TARGET');
      settle(stage.question, stage.accepted, event.targetPlayerId, 'attack');
      break;
    case 'expire':
      switch (stage.phase) {
        case 'final-instructions':
          return next(null);
        case 'final-question-reading':
          state.stage =
            now >= stage.opensAt + rules.parameters.final.responseMs
              ? { phase: 'final-no-answer-pending', question: stage.question }
              : {
                  phase: 'final-question-open',
                  question: stage.question,
                  opensAt: stage.opensAt,
                  deadlineAt: instant(stage.opensAt + rules.parameters.final.responseMs),
                };
          break;
        case 'final-question-open':
          state.stage = { phase: 'final-no-answer-pending', question: stage.question };
          break;
        case 'final-target-selection':
          state.stage = {
            phase: 'final-no-target-pending',
            question: stage.question,
            accepted: stage.accepted,
          };
          break;
        case 'final-resolution':
          if (state.finalists.filter((player) => player.status === 'active').length === 1)
            state.stage = { phase: 'podium' };
          else return next(stage.question.publicQuestion.questionId);
          break;
        default:
          return ignored();
      }
      break;
    case 'interrupt':
      state.stage = { phase: 'interrupted', reason: event.reason };
      break;
  }
  return { state, changed: true };
}

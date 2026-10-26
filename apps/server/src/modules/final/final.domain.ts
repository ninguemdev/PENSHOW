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
import {
  createTiebreak,
  expireTiebreak,
  readyTiebreak,
  answerSurvival,
  type TiebreakState,
} from '../tiebreak/tiebreak.domain.js';

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
  | { phase: 'final-tiebreak'; tiebreak: TiebreakState }
  | { phase: 'interrupted'; reason: 'insufficient-questions' | 'no-players' | 'room-closed' };
export interface FinalState {
  matchId: MatchId;
  round: FinalRound;
  finalists: Finalist[];
  history: {
    questionId: QuestionId;
    accepted: Accepted | null;
    resolution: FinalResolution;
    before: Finalist[];
    after: Finalist[];
  }[];
  stage: FinalStage;
  tiebreakResults?: { tiebreakId: string; batchId: QuestionId; standings: PlayerId[] }[];
}
export type FinalEvent =
  | {
      kind: 'tiebreak-answer';
      matchId: MatchId;
      roundId: RoundId;
      playerId: PlayerId;
      questionId: QuestionId;
      optionId: OptionId;
      tiebreakId: string;
      bout: number;
      generation: number;
    }
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
  | {
      kind: 'expire';
      randomIndex?: number;
      connectedPlayerIds?: PlayerId[];
      spawnOrder?: PlayerId[];
    }
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
  if (stage.phase === 'final-tiebreak') return stage.tiebreak.deadlineAt;
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
  if (stage.phase === 'final-tiebreak' && event.kind !== 'interrupt') {
    const tie = stage.tiebreak;
    if (event.kind === 'ready') readyTiebreak(tie, event.playerId, now);
    else if (event.kind === 'tiebreak-answer') {
      if (
        event.tiebreakId !== tie.tiebreakId ||
        event.bout !== tie.bout ||
        event.generation !== tie.generation
      )
        throw new FinalError('STALE_CONTEXT');
      answerSurvival(tie, event.playerId, event.questionId, event.optionId, now);
    } else if (event.kind === 'expire') {
      if (tie.phase === 'result') {
        const order = tie.standings;
        const otherEliminated = state.finalists.filter(
          (p) => p.status === 'eliminated' && !order.includes(p.playerId),
        );
        const firstOrder =
          Math.max(
            0,
            ...otherEliminated.map((p) => (p.status === 'eliminated' ? p.eliminationOrder : 0)),
          ) + 1;
        for (const p of state.finalists)
          if (p.status === 'eliminated' && order.includes(p.playerId))
            p.eliminationOrder = firstOrder + order.length - order.indexOf(p.playerId) - 1;
        state.tiebreakResults ??= [];
        if (!state.tiebreakResults.some((r) => r.tiebreakId === tie.tiebreakId))
          state.tiebreakResults.push({
            tiebreakId: tie.tiebreakId,
            batchId: tie.batchId,
            standings: [...order],
          });
        const activeCount = state.finalists.filter((p) => p.status === 'active').length;
        if (activeCount <= 1) state.stage = { phase: 'podium' };
        else {
          state.stage = { phase: 'awaiting-final-question', previousQuestionId: tie.batchId };
          return { state, changed: true, nextQuestion: tie.batchId };
        }
      } else expireTiebreak(tie, now, new Set(event.connectedPlayerIds ?? tie.participants));
    } else throw new FinalError('INVALID_PHASE');
    return { state, changed: true };
  }
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
    automatic = false,
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
              Math.max(
                0,
                ...state.finalists
                  .filter((player) => player.status === 'eliminated')
                  .map((p) => p.eliminationOrder),
              ) + 1,
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
            ...(automatic ? { automatic: true as const } : {}),
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
  const noAnswer = (question: PreparedQuestion) => {
    const original = structuredClone(state.finalists);
    const playerIds = original.filter((p) => p.status === 'active').map((p) => p.playerId);
    const eliminationOrder =
      Math.max(
        0,
        ...original.filter((p) => p.status === 'eliminated').map((p) => p.eliminationOrder),
      ) + 1;
    state.finalists = state.finalists.map((p) =>
      p.status !== 'active'
        ? p
        : p.lives > 1
          ? { ...p, lives: p.lives - 1 }
          : {
              playerId: p.playerId,
              rank: p.rank,
              initialLives: p.initialLives,
              status: 'eliminated',
              lives: 0,
              eliminationOrder,
            },
    );
    const resolution: FinalResolution = { outcome: 'no-answer', playerIds, damage: 1 };
    if (state.history.some((r) => r.questionId === question.publicQuestion.questionId))
      throw new FinalError('STALE_CONTEXT');
    state.history.push({
      questionId: question.publicQuestion.questionId,
      accepted: null,
      resolution,
      before: original,
      after: structuredClone(state.finalists),
    });
    state.stage = {
      phase: 'final-resolution',
      question,
      resolution,
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
          if (now >= stage.opensAt + rules.parameters.final.responseMs) noAnswer(stage.question);
          else
            state.stage = {
              phase: 'final-question-open',
              question: stage.question,
              opensAt: stage.opensAt,
              deadlineAt: instant(stage.opensAt + rules.parameters.final.responseMs),
            };
          break;
        case 'final-question-open':
          noAnswer(stage.question);
          break;
        case 'final-target-selection':
          {
            const candidates = state.finalists.filter((p) => p.status === 'active');
            const index = event.randomIndex ?? 0;
            if (!Number.isInteger(index) || index < 0 || index >= candidates.length)
              throw new FinalError('INVALID_PAYLOAD');
            settle(stage.question, stage.accepted, candidates[index]!.playerId, 'attack', true);
          }
          break;
        case 'final-resolution':
          if (stage.resolution.outcome === 'no-answer') {
            const record = state.history.find(
              (r) => r.questionId === stage.question.publicQuestion.questionId,
            )!;
            const eliminated = record.after
              .filter(
                (p) =>
                  p.status === 'eliminated' &&
                  record.before.some(
                    (previous) => previous.playerId === p.playerId && previous.status === 'active',
                  ),
              )
              .map((p) => p.playerId);
            if (eliminated.length > 1) {
              const order = event.spawnOrder?.filter((id) => eliminated.includes(id)) ?? eliminated;
              if (order.length !== eliminated.length || new Set(order).size !== order.length)
                throw new FinalError('INVALID_PAYLOAD');
              state.stage = {
                phase: 'final-tiebreak',
                tiebreak: createTiebreak(
                  stage.question.publicQuestion.questionId,
                  stage.question.publicQuestion.questionId,
                  order,
                  now,
                ),
              };
              break;
            }
          }
          if (state.finalists.filter((player) => player.status === 'active').length === 1)
            state.stage = { phase: 'podium' };
          else return next(stage.question.publicQuestion.questionId);
          break;
        default:
          return ignored();
      }
      break;
    case 'tiebreak-answer':
      throw new FinalError('INVALID_PHASE');
    case 'interrupt':
      state.stage = { phase: 'interrupted', reason: event.reason };
      break;
  }
  return { state, changed: true };
}

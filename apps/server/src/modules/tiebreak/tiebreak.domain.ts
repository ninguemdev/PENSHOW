import {
  TIEBREAK_RULES as rules,
  type PlayerId,
  type QuestionId,
  type OptionId,
  type TiebreakView,
  type TiebreakFrame,
} from '@penshow/shared';
import type { PreparedQuestion } from '../questions/question.js';
import { questionReadingMs } from '../questions/question-reading.js';
import { createCombat, respawn, stepCombat, type Combat } from './combat.domain.js';

export interface SurvivalQuestion {
  playerId: PlayerId;
  question: PreparedQuestion;
  opensAt: number;
  deadlineAt: number;
  outcome: 'correct' | 'wrong' | 'absent' | null;
  optionId: OptionId | null;
}
export interface TiebreakState {
  tiebreakId: string;
  batchId: QuestionId;
  participants: PlayerId[];
  bout: number;
  generation: number;
  phase: TiebreakView['phase'];
  deadlineAt: number;
  readyPlayerIds: PlayerId[];
  combat: Combat;
  pendingPlayerIds: PlayerId[];
  questions: SurvivalQuestion[];
  slots: PlayerId[][];
  slotIndex: number;
  eliminationBatches: PlayerId[][];
  standings: PlayerId[];
}
export class TiebreakError extends Error {
  constructor(
    readonly code:
      | 'STALE_CONTEXT'
      | 'FORBIDDEN'
      | 'INVALID_PHASE'
      | 'DEADLINE_EXPIRED'
      | 'INVALID_PAYLOAD'
      | 'ALREADY_ANSWERED',
  ) {
    super(code);
  }
}
export function createTiebreak(
  tiebreakId: string,
  batchId: QuestionId,
  participants: PlayerId[],
  now: number,
): TiebreakState {
  if (
    participants.length < 2 ||
    participants.length > 12 ||
    new Set(participants).size !== participants.length
  )
    throw new TiebreakError('INVALID_PAYLOAD');
  return {
    tiebreakId,
    batchId,
    participants: [...participants],
    bout: 1,
    generation: 0,
    phase: 'instructions',
    deadlineAt: now + rules.instructionsMs,
    readyPlayerIds: [],
    combat: createCombat(participants),
    pendingPlayerIds: [],
    questions: [],
    slots: [[...participants]],
    slotIndex: 0,
    eliminationBatches: [],
    standings: [],
  };
}
function countdown(state: TiebreakState, now: number) {
  state.phase = 'countdown';
  state.deadlineAt = now + rules.countdownMs;
  state.generation++;
  for (const f of state.combat.fighters) {
    f.input = null;
    f.lastSequence = -1;
  }
}
export function readyTiebreak(state: TiebreakState, playerId: PlayerId, now: number) {
  if (state.phase !== 'instructions') throw new TiebreakError('INVALID_PHASE');
  if (!state.combat.fighters.some((f) => f.playerId === playerId))
    throw new TiebreakError('FORBIDDEN');
  if (now >= state.deadlineAt) throw new TiebreakError('DEADLINE_EXPIRED');
  if (!state.readyPlayerIds.includes(playerId)) state.readyPlayerIds.push(playerId);
  if (state.readyPlayerIds.length === state.combat.fighters.length) countdown(state, now);
}
export function prepareSurvivalQuestions(
  state: TiebreakState,
  questions: PreparedQuestion[],
  now: number,
  minimumReadingMs: number,
) {
  if (
    state.phase !== 'questions' ||
    state.questions.length ||
    questions.length !== state.pendingPlayerIds.length
  )
    throw new TiebreakError('INVALID_PHASE');
  state.questions = questions.map((question, i) => {
    const opensAt = now + questionReadingMs(question, minimumReadingMs);
    return {
      playerId: state.pendingPlayerIds[i]!,
      question,
      opensAt,
      deadlineAt: opensAt + rules.responseMs,
      outcome: null,
      optionId: null,
    };
  });
  state.deadlineAt = Math.min(...state.questions.map((q) => q.opensAt));
}
function revealIfResolved(state: TiebreakState, now: number) {
  if (!state.questions.every((q) => q.outcome !== null)) return false;
  const eliminated: PlayerId[] = [];
  for (const q of state.questions) {
    const fighter = state.combat.fighters.find((f) => f.playerId === q.playerId)!;
    if (q.outcome === 'correct') respawn(state.combat, fighter);
    else {
      fighter.status = 'eliminated';
      eliminated.push(q.playerId);
    }
  }
  if (eliminated.length) state.eliminationBatches.push(eliminated);
  state.phase = 'reveal';
  state.deadlineAt = now + rules.revealMs;
  return true;
}
export function answerSurvival(
  state: TiebreakState,
  playerId: PlayerId,
  questionId: QuestionId,
  optionId: OptionId,
  now: number,
) {
  if (state.phase !== 'questions') throw new TiebreakError('INVALID_PHASE');
  const own = state.questions.find((q) => q.playerId === playerId);
  if (!own) throw new TiebreakError('FORBIDDEN');
  if (own.question.publicQuestion.questionId !== questionId)
    throw new TiebreakError('STALE_CONTEXT');
  if (own.outcome) throw new TiebreakError('ALREADY_ANSWERED');
  if (now < own.opensAt || now >= own.deadlineAt) throw new TiebreakError('DEADLINE_EXPIRED');
  if (!own.question.publicQuestion.options.some((o) => o.optionId === optionId))
    throw new TiebreakError('INVALID_PAYLOAD');
  own.optionId = optionId;
  own.outcome = optionId === own.question.correctOptionId ? 'correct' : 'wrong';
  if (!revealIfResolved(state, now))
    state.deadlineAt = Math.min(
      ...state.questions
        .filter((q) => !q.outcome)
        .map((q) => (now < q.opensAt ? q.opensAt : q.deadlineAt)),
    );
}
function finishBout(state: TiebreakState, now: number) {
  const survivors = state.combat.fighters
    .filter((f) => f.status !== 'eliminated')
    .map((f) => f.playerId);
  const groups = [survivors, ...state.eliminationBatches.slice().reverse()].filter((g) => g.length);
  state.slots.splice(state.slotIndex, 1, ...groups);
  state.slotIndex = state.slots.findIndex((g) => g.length > 1);
  state.questions = [];
  state.pendingPlayerIds = [];
  if (state.slotIndex < 0) {
    state.standings = state.slots.flat();
    state.phase = 'result';
    state.deadlineAt = now + rules.revealMs;
  } else {
    state.bout++;
    state.combat = createCombat(state.slots[state.slotIndex]!);
    state.eliminationBatches = [];
    state.readyPlayerIds = [];
    countdown(state, now);
  }
}
/** Called on the room's authoritative timer; no per-projectile or per-player timers. */
export function expireTiebreak(
  state: TiebreakState,
  now: number,
  connected: ReadonlySet<PlayerId>,
) {
  if (now < state.deadlineAt) return;
  switch (state.phase) {
    case 'instructions':
      countdown(state, now);
      break;
    case 'countdown':
      state.phase = 'combat';
      state.deadlineAt = now + rules.tickMs;
      break;
    case 'combat': {
      // One bounded step: an event loop delay never becomes an unbounded burst of damage.
      const zero = stepCombat(state.combat, now, connected);
      state.deadlineAt = now + rules.tickMs;
      if (zero.length) {
        state.phase = 'questions';
        state.pendingPlayerIds = zero;
        state.questions = [];
        state.combat.projectiles = [];
        state.generation++;
        for (const f of state.combat.fighters) f.input = null;
      }
      break;
    }
    case 'questions':
      for (const q of state.questions) if (!q.outcome && now >= q.deadlineAt) q.outcome = 'absent';
      if (!revealIfResolved(state, now))
        state.deadlineAt = Math.min(
          ...state.questions
            .filter((q) => !q.outcome)
            .map((q) => (now < q.opensAt ? q.opensAt : q.deadlineAt)),
        );
      break;
    case 'reveal':
      if (state.combat.fighters.filter((f) => f.status !== 'eliminated').length <= 1)
        finishBout(state, now);
      else {
        state.questions = [];
        state.pendingPlayerIds = [];
        countdown(state, now);
      }
      break;
    case 'result':
      break;
  }
}
export function buildCombatFrame(state: TiebreakState, now: number): TiebreakFrame {
  return {
    tiebreakId: state.tiebreakId,
    bout: state.bout,
    generation: state.generation,
    tick: state.combat.tick,
    serverNow: now,
    fighters: state.combat.fighters.map((f) => ({
      playerId: f.playerId,
      x: f.x,
      y: f.y,
      aimX: f.aimX,
      aimY: f.aimY,
      lives: f.lives,
      status: f.status,
      protected: state.combat.simulationMs < f.protectedUntil,
    })),
    projectiles: state.combat.projectiles.map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      x: p.x,
      y: p.y,
    })),
  };
}
export function buildTiebreakView(
  state: TiebreakState,
  viewerId: PlayerId,
  now: number,
): TiebreakView {
  const own = state.questions.find((q) => q.playerId === viewerId);
  let ownQuestion: TiebreakView['ownQuestion'] = { status: 'unavailable' };
  if (own && state.phase === 'reveal')
    ownQuestion = {
      status: 'resolved',
      outcome: own.outcome!,
      optionId: own.optionId,
      reveal: {
        question: structuredClone(own.question.publicQuestion),
        correctOptionId: own.question.correctOptionId,
        explanation: own.question.explanation,
      },
    };
  else if (own && state.phase === 'questions') {
    if (now < own.opensAt) {
      const { options: _options, ...stem } = own.question.publicQuestion;
      void _options;
      ownQuestion = {
        status: 'reading',
        question: structuredClone(stem),
        opensAt: own.opensAt,
        ...(own.question.narration
          ? { narration: { ...own.question.narration, voice: 'robot-pt-br-v1' as const } }
          : {}),
      };
    } else
      ownQuestion = {
        status: 'open',
        question: structuredClone(own.question.publicQuestion),
        opensAt: own.opensAt,
        deadlineAt: own.deadlineAt,
        submitted: own.outcome !== null,
      };
  }
  return {
    phase: state.phase,
    frame: buildCombatFrame(state, now),
    participants: [...state.participants],
    deadlineAt: state.deadlineAt,
    readyPlayerIds: [...state.readyPlayerIds],
    pendingPlayerIds: [...state.pendingPlayerIds],
    ownQuestion,
    standings: [...state.standings],
    batchId: state.batchId,
  };
}

import { ROOM_LIMITS, type ScoringMode } from '@penshow/shared';
import type { ApprovedQuestion } from './question.js';
import {
  PROTOTYPE_PARAMETERS,
  type DeepReadonly,
  type PrototypeParameters,
} from '../scoring/match-rules.js';

export type Difficulty = ApprovedQuestion['difficulty'];
export type QuestionDemand = Readonly<Record<Difficulty, number>>;
export type SelectionMode = ScoringMode;
export type SelectionFormat =
  | 'classic-prototype'
  | 'speed-prototype'
  | 'wager-prototype'
  | 'theft-prototype'
  | 'pressure-prototype'
  | 'full-prototype';

// Adapt the single experimental configuration; never duplicate content budgets here.
export function selectionPolicy(parameters: DeepReadonly<PrototypeParameters>) {
  return Object.freeze({
    categoryChoiceMs: parameters.timings.categoryChoiceMs,
    maximumCategoryOptions: parameters.selection.maximumCategoryOptions,
    finalReserve: Object.freeze({
      easy: parameters.final.reserveQuestions / 2,
      medium: parameters.final.reserveQuestions / 2,
      hard: 0,
    }),
    modes: Object.freeze(['classic', 'speed', 'wager', 'theft', 'pressure'] as const),
    demands: Object.freeze({
      classic: parameters.classic.questions,
      speed: parameters.speed.questions,
      wager: parameters.wager.questions,
      theft: parameters.theft.questions,
    }),
  });
}
export const SELECTION_PROPOSAL = selectionPolicy(PROTOTYPE_PARAMETERS);
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export function phaseDemand(
  mode: SelectionMode,
  playerCount: number,
  parameters: DeepReadonly<PrototypeParameters> = PROTOTYPE_PARAMETERS,
): QuestionDemand {
  if (
    !Number.isInteger(playerCount) ||
    playerCount < ROOM_LIMITS.minPlayers ||
    playerCount > ROOM_LIMITS.maxPlayers
  )
    throw new SelectionError('invalid-config');
  if (mode === 'pressure') {
    const demand = { easy: 0, medium: 0, hard: 0 };
    for (const difficulty of parameters.pressure.turnDifficulties)
      demand[difficulty] += playerCount;
    return demand;
  }
  if (!Object.hasOwn(SELECTION_PROPOSAL.demands, mode)) throw new SelectionError('invalid-config');
  return { ...parameters[mode].questions };
}
export function demandSize(demand: QuestionDemand) {
  return demand.easy + demand.medium + demand.hard;
}

type SelectionErrorCode =
  | 'invalid-config'
  | 'invalid-catalog'
  | 'invalid-random'
  | 'invalid-id'
  | 'invalid-state'
  | 'stale-context'
  | 'forbidden'
  | 'invalid-category'
  | 'deadline-expired';
export class SelectionError extends Error {
  constructor(readonly code: SelectionErrorCode) {
    super(`Falha na seleção de perguntas: ${code}.`);
    this.name = 'SelectionError';
  }
}
export interface ContentInterruption {
  status: 'interrupted';
  reason: 'content-exhausted';
  message: string;
  returnToLobby: true;
}
export function contentInterruption(): ContentInterruption {
  return {
    status: 'interrupted',
    reason: 'content-exhausted',
    message: 'As perguntas inéditas disponíveis acabaram. Volte ao lobby para jogar novamente.',
    returnToLobby: true,
  };
}

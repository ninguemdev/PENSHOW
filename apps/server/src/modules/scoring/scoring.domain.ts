import {
  matchIdSchema,
  playerIdSchema,
  questionIdSchema,
  roundIdSchema,
  ROOM_LIMITS,
  scoreEffectSchema,
  scoreEntrySchema,
  scoreboardSchema,
  type PlayerId,
  type ScoreEffect,
  type ScoreEntry,
  type Scoreboard,
  type ScoringMode,
} from '@penshow/shared';
import { z } from 'zod';
import type { FrozenMatchRules } from './match-rules.js';

export class ScoringError extends Error {
  constructor(
    readonly code:
      | 'invalid-input'
      | 'invalid-wager'
      | 'invalid-target'
      | 'invalid-window'
      | 'stale-context'
      | 'overflow',
  ) {
    super(`Falha no cálculo do placar: ${code}.`);
    this.name = 'ScoringError';
  }
}
type CreditReason = Extract<ScoreEffect, { kind: 'credit' }>['reason'];
type DebitReason = Extract<ScoreEffect, { kind: 'debit' }>['reason'];
function integer(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new ScoringError('invalid-input');
  return value;
}
function checkedAdd(left: number, right: number) {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new ScoringError('overflow');
  return value;
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ScoringError('invalid-input');
  return result.data;
}
export function credit(entry: ScoreEntry, amount: number, reason: CreditReason) {
  const next = parse(scoreEntrySchema, entry);
  integer(amount);
  const effect = parse(scoreEffectSchema, {
    kind: 'credit',
    playerId: next.playerId,
    amount,
    reason,
  });
  next.points = checkedAdd(next.points, amount);
  return { entry: next, effect };
}
export function debit(entry: ScoreEntry, requested: number, reason: DebitReason) {
  const next = parse(scoreEntrySchema, entry);
  const amount = Math.min(next.points, integer(requested));
  const effect = parse(scoreEffectSchema, {
    kind: 'debit',
    playerId: next.playerId,
    amount,
    reason,
  });
  next.points -= amount;
  return { entry: next, effect };
}
export function addCorrectAnswer(entry: ScoreEntry): ScoreEntry {
  const next = parse(scoreEntrySchema, entry);
  next.correctAnswers = checkedAdd(next.correctAnswers, 1);
  return next;
}
export function createScoreboard(players: readonly PlayerId[]): Scoreboard {
  return parse(
    scoreboardSchema,
    players.map((playerId) => ({ playerId, points: 0, correctAnswers: 0 })),
  );
}
export function transferPoints(
  scores: readonly ScoreEntry[],
  from: PlayerId,
  to: PlayerId,
  maximum: number,
) {
  const next = parse(scoreboardSchema, scores);
  integer(maximum);
  const sourceIndex = next.findIndex((entry) => entry.playerId === from);
  const destinationIndex = next.findIndex((entry) => entry.playerId === to);
  if (sourceIndex < 0 || destinationIndex < 0 || from === to)
    throw new ScoringError('invalid-target');
  const loss = debit(next[sourceIndex]!, maximum, 'theft');
  const gain = credit(next[destinationIndex]!, loss.effect.amount, 'theft');
  next[sourceIndex] = loss.entry;
  next[destinationIndex] = gain.entry;
  return {
    scoreboard: next,
    effects: [loss.effect, gain.effect].filter((effect) => effect.amount > 0),
  };
}

export interface SealedWager {
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly pointsAtSelection: number;
}
export function allowedWagerAmounts(rules: FrozenMatchRules, balance: number): number[] {
  integer(balance);
  return rules.parameters.wager.allowedAmounts.filter((amount) => amount <= balance);
}
/** No debit occurs here. The single settlement happens when the question is resolved. */
export function sealWager(rules: FrozenMatchRules, entry: ScoreEntry, amount: number): SealedWager {
  const score = parse(scoreEntrySchema, entry);
  if (!Number.isSafeInteger(amount) || !allowedWagerAmounts(rules, score.points).includes(amount))
    throw new ScoringError('invalid-wager');
  return Object.freeze({ playerId: score.playerId, amount, pointsAtSelection: score.points });
}

const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const acceptedAnswerSchema = z.strictObject({
  playerId: playerIdSchema,
  correct: z.boolean(),
  receivedAt: timestamp,
});
const answers = z.array(acceptedAnswerSchema).max(ROOM_LIMITS.maxPlayers);
const wagerSchema = z.strictObject({
  playerId: playerIdSchema,
  amount: timestamp,
  pointsAtSelection: timestamp,
});
const inputSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('classic'), answers }),
  z.strictObject({ mode: z.literal('speed'), answers }),
  z.strictObject({
    mode: z.literal('wager'),
    answers,
    wagers: z.array(wagerSchema).max(ROOM_LIMITS.maxPlayers),
  }),
  z.strictObject({ mode: z.literal('theft'), answers, targetPlayerId: playerIdSchema.nullable() }),
  z.strictObject({
    mode: z.literal('pressure'),
    respondentId: playerIdSchema,
    answer: acceptedAnswerSchema.nullable(),
  }),
]);
const contextSchema = z.strictObject({
  matchId: matchIdSchema,
  roundId: roundIdSchema,
  questionId: questionIdSchema,
  opensAt: timestamp,
});
export type AcceptedScoringAnswer = z.infer<typeof acceptedAnswerSchema>;
export type ScoringInput = z.infer<typeof inputSchema>;
export type ScoringContext = z.infer<typeof contextSchema>;
export interface ScoreChange {
  playerId: PlayerId;
  pointsBefore: number;
  pointsAfter: number;
  delta: number;
  correctAnswersBefore: number;
  correctAnswersAfter: number;
}
export function scoreboardChanges(
  before: readonly ScoreEntry[],
  after: readonly ScoreEntry[],
): ScoreChange[] {
  const left = parse(scoreboardSchema, before),
    right = parse(scoreboardSchema, after);
  if (
    left.length !== right.length ||
    left.some((entry) => !right.some((next) => next.playerId === entry.playerId))
  )
    throw new ScoringError('invalid-input');
  return left.map((entry) => {
    const next = right.find((score) => score.playerId === entry.playerId)!;
    return {
      playerId: entry.playerId,
      pointsBefore: entry.points,
      pointsAfter: next.points,
      delta: next.points - entry.points,
      correctAnswersBefore: entry.correctAnswers,
      correctAnswersAfter: next.correctAnswers,
    };
  });
}
/** Private history entry. The existing public ScoreEffect contract explains actual applied amounts. */
export interface QuestionScoreResolution {
  context: ScoringContext;
  rulesVersion: FrozenMatchRules['parameters']['version'];
  mode: ScoringMode;
  before: Scoreboard;
  after: Scoreboard;
  correctPlayerIds: PlayerId[];
  effects: ScoreEffect[];
  changes: ScoreChange[];
}
export interface ScoringHistory {
  readonly matchId: FrozenMatchRules['matchId'];
  readonly rules: FrozenMatchRules;
  readonly records: readonly QuestionScoreResolution[];
}

/** Trusted server receipts in queue order. Missing players are absent, not extra wrong answers. */
export function resolveQuestion(
  rules: FrozenMatchRules,
  scores: readonly ScoreEntry[],
  rawContext: ScoringContext,
  rawInput: ScoringInput,
): QuestionScoreResolution {
  const context = parse(contextSchema, rawContext),
    input = parse(inputSchema, rawInput);
  if (context.matchId !== rules.matchId) throw new ScoringError('stale-context');
  const before = parse(scoreboardSchema, scores);
  let after = structuredClone(before);
  const effects: ScoreEffect[] = [];
  const receipts = input.mode === 'pressure' ? (input.answer ? [input.answer] : []) : input.answers;
  const mode = rules.parameters[input.mode];
  const deadlineAt = checkedAdd(context.opensAt, mode.responseMs);
  if (
    new Set(receipts.map((answer) => answer.playerId)).size !== receipts.length ||
    receipts.some(
      (answer, index) =>
        !before.some((entry) => entry.playerId === answer.playerId) ||
        (index > 0 && answer.receivedAt < receipts[index - 1]!.receivedAt),
    )
  )
    throw new ScoringError('invalid-input');
  if (
    receipts.some(
      (answer) => answer.receivedAt < context.opensAt || answer.receivedAt >= deadlineAt,
    )
  )
    throw new ScoringError('invalid-window');
  const emit = (
    playerId: PlayerId,
    kind: 'credit' | 'debit',
    amount: number,
    reason: CreditReason | DebitReason,
  ) => {
    const index = after.findIndex((entry) => entry.playerId === playerId);
    if (index < 0) throw new ScoringError('invalid-input');
    const result =
      kind === 'credit'
        ? credit(after[index]!, amount, reason as CreditReason)
        : debit(after[index]!, amount, reason as DebitReason);
    after[index] = result.entry;
    if (result.effect.amount > 0) effects.push(result.effect);
  };
  let wagers: SealedWager[] = [];
  if (input.mode === 'wager') {
    if (new Set(input.wagers.map((wager) => wager.playerId)).size !== input.wagers.length)
      throw new ScoringError('invalid-wager');
    wagers = input.wagers.map((wager) => {
      const entry = before.find((score) => score.playerId === wager.playerId);
      if (!entry || entry.points !== wager.pointsAtSelection)
        throw new ScoringError('invalid-wager');
      return sealWager(rules, entry, wager.amount);
    });
  }
  if (
    input.mode === 'pressure' &&
    (!before.some((entry) => entry.playerId === input.respondentId) ||
      (input.answer && input.answer.playerId !== input.respondentId))
  )
    throw new ScoringError('invalid-input');
  const respondents =
    input.mode === 'pressure'
      ? before.filter((entry) => entry.playerId === input.respondentId)
      : before;
  const correctPlayerIds: PlayerId[] = [];
  for (const entry of respondents) {
    const answer = receipts.find((receipt) => receipt.playerId === entry.playerId);
    if (answer?.correct) {
      correctPlayerIds.push(entry.playerId);
      emit(entry.playerId, 'credit', mode.correctPoints, 'correct-answer');
      const index = after.findIndex((score) => score.playerId === entry.playerId);
      after[index] = addCorrectAnswer(after[index]!);
      if (input.mode === 'speed') {
        const elapsed = answer.receivedAt - context.opensAt;
        const band = rules.parameters.speed.bonusBands.find(
          (candidate) => elapsed < candidate.beforeMs,
        )!;
        emit(entry.playerId, 'credit', band.points, 'speed-bonus');
      }
    }
    if (input.mode === 'wager') {
      const amount = wagers.find((wager) => wager.playerId === entry.playerId)?.amount ?? 0;
      emit(entry.playerId, answer?.correct ? 'credit' : 'debit', amount, 'wager');
    }
    if (input.mode === 'pressure' && !answer?.correct)
      emit(entry.playerId, 'debit', rules.parameters.pressure.wrongPenalty, 'pressure');
  }
  if (input.mode === 'theft' && input.targetPlayerId !== null) {
    const attacker = receipts.find((answer) => answer.correct)?.playerId;
    if (!attacker) throw new ScoringError('invalid-target');
    const transfer = transferPoints(
      after,
      input.targetPlayerId,
      attacker,
      rules.parameters.theft.maximumTransfer,
    );
    after = transfer.scoreboard;
    effects.push(...transfer.effects);
  }
  return {
    context,
    rulesVersion: rules.parameters.version,
    mode: input.mode,
    before,
    after,
    correctPlayerIds,
    effects,
    changes: scoreboardChanges(before, after),
  };
}

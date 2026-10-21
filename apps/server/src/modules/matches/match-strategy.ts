import type { ScoringMode, Scoreboard, PlayerId } from '@penshow/shared';
import type { FrozenMatchRules } from '../scoring/match-rules.js';
import {
  resolveQuestion,
  transferPoints,
  scoreboardChanges,
  type AcceptedScoringAnswer,
  type QuestionScoreResolution,
  type ScoringContext,
  type SealedWager,
} from '../scoring/scoring.domain.js';

/** Resolution inputs are supplied by the authoritative question cycle, including exclusive turns. */
export interface MatchStrategy {
  readonly mode: ScoringMode;
  resolve(
    rules: FrozenMatchRules,
    scoreboard: Scoreboard,
    context: ScoringContext,
    answers: AcceptedScoringAnswer[],
    options?: { wagers?: SealedWager[]; respondentId?: PlayerId },
  ): QuestionScoreResolution;
  settleTarget?(
    rules: FrozenMatchRules,
    resolution: QuestionScoreResolution,
    attackerPlayerId: PlayerId,
    targetPlayerId: PlayerId,
  ): QuestionScoreResolution;
}

export class StrategyRegistry {
  private readonly strategies: ReadonlyMap<ScoringMode, MatchStrategy>;
  constructor(strategies: readonly MatchStrategy[]) {
    if (new Set(strategies.map((strategy) => strategy.mode)).size !== strategies.length)
      throw new Error('Modalidade duplicada no registro.');
    this.strategies = new Map(
      strategies.map((strategy) => [
        strategy.mode,
        Object.freeze({
          mode: strategy.mode,
          resolve: strategy.resolve.bind(strategy),
          ...(strategy.settleTarget ? { settleTarget: strategy.settleTarget.bind(strategy) } : {}),
        }),
      ]),
    );
  }
  get(mode: ScoringMode): MatchStrategy {
    const strategy = this.strategies.get(mode);
    if (!strategy) throw new Error(`Modalidade não implementada: ${mode}.`);
    return strategy;
  }
}

export const classicStrategy = Object.freeze<MatchStrategy>({
  mode: 'classic',
  resolve: (rules, scoreboard, context, answers) =>
    resolveQuestion(rules, scoreboard, context, { mode: 'classic', answers }),
});

export const speedStrategy = Object.freeze<MatchStrategy>({
  mode: 'speed',
  resolve: (rules, scoreboard, context, answers) =>
    resolveQuestion(rules, scoreboard, context, { mode: 'speed', answers }),
});

export const wagerStrategy = Object.freeze<MatchStrategy>({
  mode: 'wager',
  resolve: (rules, scoreboard, context, answers, options) =>
    resolveQuestion(rules, scoreboard, context, {
      mode: 'wager',
      answers,
      wagers: options?.wagers ?? [],
    }),
});

export const pressureStrategy = Object.freeze<MatchStrategy>({
  mode: 'pressure',
  resolve: (rules, scoreboard, context, answers, options) => {
    if (!options?.respondentId || answers.length > 1) throw new Error('Turno de pressão inválido.');
    return resolveQuestion(rules, scoreboard, context, {
      mode: 'pressure',
      respondentId: options.respondentId,
      answer: answers[0] ?? null,
    });
  },
});

export const theftStrategy = Object.freeze<MatchStrategy>({
  mode: 'theft',
  resolve: (rules, scoreboard, context, answers) =>
    resolveQuestion(rules, scoreboard, context, { mode: 'theft', answers, targetPlayerId: null }),
  settleTarget: (rules, resolution, attackerPlayerId, targetPlayerId) => {
    if (
      resolution.mode !== 'theft' ||
      resolution.context.matchId !== rules.matchId ||
      !resolution.correctPlayerIds.includes(attackerPlayerId) ||
      resolution.effects.some((effect) => effect.reason === 'theft')
    )
      throw new Error('Resolução de roubo inválida ou já liquidada.');
    const transfer = transferPoints(
      resolution.after,
      targetPlayerId,
      attackerPlayerId,
      rules.parameters.theft.maximumTransfer,
    );
    return {
      ...structuredClone(resolution),
      after: transfer.scoreboard,
      effects: [...structuredClone(resolution.effects), ...transfer.effects],
      changes: scoreboardChanges(resolution.before, transfer.scoreboard),
    };
  },
});

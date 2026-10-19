import type { ScoringMode, Scoreboard } from '@penshow/shared';
import type { FrozenMatchRules } from '../scoring/match-rules.js';
import {
  resolveQuestion,
  type AcceptedScoringAnswer,
  type QuestionScoreResolution,
  type ScoringContext,
} from '../scoring/scoring.domain.js';

/** Common all-player question cycle. Extra modality stages are added with their implementation. */
export interface MatchStrategy {
  readonly mode: ScoringMode;
  resolve(
    rules: FrozenMatchRules,
    scoreboard: Scoreboard,
    context: ScoringContext,
    answers: AcceptedScoringAnswer[],
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

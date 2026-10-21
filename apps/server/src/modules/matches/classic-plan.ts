import { roundIdSchema, scoringRoundSchema, type ScoringMode } from '@penshow/shared';
import type { IdGenerator, RandomSource } from '../../ports.js';
import { shuffled } from '../questions/theme-queue.domain.js';

export const CLASSIC_MODES = ['classic', 'speed', 'wager', 'theft', 'pressure'] as const;

/** Sample without replacement. Positions describe the plan, never the modality. */
export function createClassicPlan(deps: { ids: IdGenerator; random: RandomSource }) {
  const modes: ScoringMode[] = shuffled(CLASSIC_MODES, deps.random).slice(0, 4);
  const rounds = modes.map((mode, position) =>
    scoringRoundSchema.parse({
      roundId: roundIdSchema.parse(deps.ids.next()),
      index: position + 1,
      mode,
      ...(mode === 'pressure'
        ? {
            variant: {
              status: 'prototype' as const,
              decisionId: 'D04' as const,
              mode: 'dynamite' as const,
            },
          }
        : {}),
    }),
  );
  return {
    rounds,
    finalRound: {
      roundId: roundIdSchema.parse(deps.ids.next()),
      index: 5 as const,
      mode: 'final' as const,
    },
  };
}

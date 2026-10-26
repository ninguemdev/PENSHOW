import { roundIdSchema, scoringRoundSchema, type ScoringMode } from '@penshow/shared';
import type { IdGenerator, RandomSource } from '../../ports.js';
import { shuffled } from '../questions/theme-queue.domain.js';
import { PROTOTYPE_PARAMETERS, type FrozenMatchRules } from '../scoring/match-rules.js';

export const CLASSIC_MODES = ['classic', 'speed', 'wager', 'theft', 'pressure'] as const;

/** Sample without replacement. Positions describe the plan, never the modality. */
export function createClassicPlan(
  deps: { ids: IdGenerator; random: RandomSource },
  pressurePolicy: FrozenMatchRules['parameters']['pressure']['policy'] = PROTOTYPE_PARAMETERS
    .pressure.policy,
) {
  const modes: ScoringMode[] = shuffled(CLASSIC_MODES, deps.random).slice(0, 4);
  const rounds = modes.map((mode, position) =>
    scoringRoundSchema.parse({
      roundId: roundIdSchema.parse(deps.ids.next()),
      index: position + 1,
      mode,
      ...(mode === 'pressure'
        ? {
            variant: { ...pressurePolicy },
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

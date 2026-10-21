import { createClassicPlan } from '../../apps/server/src/modules/matches/classic-plan.js';
import { stockDependencies } from './question-stock.js';

/** Exhaust all Fisher–Yates choices (5 × 4 × 3 × 2), without sampling statistics. */
export function classicPlanMatrix() {
  const plans = [];
  for (let a = 0; a < 5; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 3; c++)
        for (let d = 0; d < 2; d++) {
          const choices = [a, b, c, d];
          const deps = stockDependencies(36);
          const plan = createClassicPlan({ ...deps, random: { integer: () => choices.shift()! } });
          plans.push(plan);
        }
  return plans;
}

import { describe, expect, it } from 'vitest';
import { classicPlanMatrix } from '../../../../../scripts/lib/classic-plan-matrix.js';
import { CLASSIC_MODES } from './classic-plan.js';

describe('plano do modo clássico', () => {
  it('permite exatamente as 120 sequências, todas as posições e todas as omissões', () => {
    const plans = classicPlanMatrix();
    expect(plans).toHaveLength(120);
    expect(
      new Set(plans.map((plan) => plan.rounds.map((round) => round.mode).join(','))).size,
    ).toBe(120);
    for (const plan of plans) {
      expect(plan.rounds.map((round) => round.index)).toEqual([1, 2, 3, 4]);
      expect(new Set(plan.rounds.map((round) => round.mode)).size).toBe(4);
      expect(plan.finalRound).toMatchObject({ mode: 'final', index: 5 });
      expect(new Set([...plan.rounds, plan.finalRound].map((round) => round.roundId)).size).toBe(5);
    }
    for (const mode of CLASSIC_MODES) {
      expect(
        plans.filter((plan) => plan.rounds.every((round) => round.mode !== mode)),
      ).toHaveLength(24);
      for (let index = 0; index < 4; index++)
        expect(plans.filter((plan) => plan.rounds[index]?.mode === mode)).toHaveLength(24);
    }
  });
});

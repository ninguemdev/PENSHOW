import type { PlayerId } from '@penshow/shared';
import type { FrozenMatchRules } from '../scoring/match-rules.js';

/** The permutation is drawn once; answers, scores and presence never change it. */
export function pressureTurn(
  order: readonly PlayerId[],
  difficulties: FrozenMatchRules['parameters']['pressure']['turnDifficulties'],
  index: number,
) {
  const turnCount = order.length * difficulties.length;
  if (!order.length || index < 0 || index >= turnCount) return null;
  const owner = (at: number) => {
    const cycle = Math.floor(at / order.length);
    const position = at % order.length;
    return order[cycle % 2 === 0 ? position : order.length - position - 1]!;
  };
  const cycle = Math.floor(index / order.length);
  return {
    playerId: owner(index),
    cycle: cycle + 1,
    cycleCount: difficulties.length,
    turnNumber: index + 1,
    turnCount,
    nextPlayerId: index + 1 < turnCount ? owner(index + 1) : null,
    difficulty: difficulties[cycle]!,
  };
}

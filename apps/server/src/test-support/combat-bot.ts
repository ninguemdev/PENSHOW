import { TIEBREAK_RULES, type PlayerId, type TiebreakInput } from '@penshow/shared';
import { spawnPoint } from '../modules/tiebreak/combat.domain.js';
import type { TiebreakState } from '../modules/tiebreak/tiebreak.domain.js';

/** Test/pilot intentions only: uses movement and firing, never injects hits or health. */
export function combatBotInput(
  state: TiebreakState,
  playerId: PlayerId,
  sequence: number,
): TiebreakInput {
  const fighter = state.combat.fighters.find((f) => f.playerId === playerId)!;
  const target = state.combat.fighters
    .filter((f) => f.playerId !== playerId && f.status === 'fighting')
    .sort(
      (a, b) =>
        Math.hypot(a.x - fighter.x, a.y - fighter.y) - Math.hypot(b.x - fighter.x, b.y - fighter.y),
    )[0];
  const nearest = Array.from({ length: 12 }, (_, i) => ({ i, p: spawnPoint(i) })).sort(
    (a, b) =>
      Math.hypot(a.p.x - fighter.x, a.p.y - fighter.y) -
      Math.hypot(b.p.x - fighter.x, b.p.y - fighter.y),
  )[0]!;
  const next = spawnPoint((nearest.i + 1) % 12),
    length = Math.hypot(next.x - fighter.x, next.y - fighter.y) || 1;
  const flight = target
    ? Math.hypot(target.x - fighter.x, target.y - fighter.y) / TIEBREAK_RULES.projectileSpeed
    : 0;
  const targetInput = target?.input;
  const dx =
    (target?.x ?? fighter.x) +
    (targetInput?.moveX ?? 0) * TIEBREAK_RULES.speed * flight -
    fighter.x;
  const dy =
    (target?.y ?? fighter.y) +
    (targetInput?.moveY ?? 0) * TIEBREAK_RULES.speed * flight -
    fighter.y;
  const aim = Math.hypot(dx, dy) || 1;
  return {
    tiebreakId: state.tiebreakId,
    bout: state.bout,
    generation: state.generation,
    sequence,
    moveX: (next.x - fighter.x) / length,
    moveY: (next.y - fighter.y) / length,
    aimX: dx / aim,
    aimY: dy / aim,
    shooting: !!target,
  };
}

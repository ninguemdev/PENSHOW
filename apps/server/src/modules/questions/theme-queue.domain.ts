import { playerIdSchema, type PlayerId } from '@penshow/shared';
import type { RandomSource } from '../../ports.js';
import { SelectionError } from './selection-policy.js';

export interface ThemeChoiceQueue {
  pending: readonly PlayerId[];
  served: readonly PlayerId[];
}
export function randomIndex(random: RandomSource, length: number) {
  const value = length === 1 ? 0 : random.integer(length);
  if (!Number.isSafeInteger(value) || value < 0 || value >= length)
    throw new SelectionError('invalid-random');
  return value;
}
export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(random, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
export function choiceQueue(
  players: readonly PlayerId[],
  random: RandomSource,
  previous?: ThemeChoiceQueue,
): ThemeChoiceQueue {
  const valid = (ids: readonly PlayerId[]) =>
    ids.every((id) => playerIdSchema.safeParse(id).success) && new Set(ids).size === ids.length;
  if (!players.length || !valid(players)) throw new SelectionError('invalid-config');
  if (!previous) return { pending: shuffled([...players].sort(), random), served: [] };
  if (!valid([...previous.pending, ...previous.served])) throw new SelectionError('invalid-config');
  const current = new Set(players);
  const known = new Set([...previous.pending, ...previous.served]);
  const added = shuffled(players.filter((id) => !known.has(id)).sort(), random);
  const pending = [...previous.pending.filter((id) => current.has(id)), ...added];
  const served = previous.served.filter((id) => current.has(id));
  return pending.length ? { pending, served } : { pending: served, served: [] };
}
export function advanceChoiceQueue(queue: ThemeChoiceQueue): ThemeChoiceQueue {
  const pending = queue.pending.length ? [...queue.pending] : [...queue.served];
  const served = queue.pending.length ? [...queue.served] : [];
  const chooser = pending.shift();
  if (!chooser) throw new SelectionError('invalid-state');
  served.push(chooser);
  return pending.length ? { pending, served } : { pending: served, served: [] };
}
export function nextChooser(queue: ThemeChoiceQueue): PlayerId {
  const next = queue.pending[0];
  if (!next) throw new SelectionError('invalid-state');
  return next;
}

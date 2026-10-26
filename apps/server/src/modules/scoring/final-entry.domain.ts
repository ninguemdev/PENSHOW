import {
  CONFIRMED_FINAL_RULES,
  finalEntrySchema,
  matchIdSchema,
  qualificationPolicySchema,
  scoreboardSchema,
  type FinalEntry,
  type MatchId,
  type PlayerId,
  type QualificationPolicy,
  type ScoreEntry,
} from '@penshow/shared';
import type { DeepReadonly } from './match-rules.js';

export type FrozenFinalEntry = DeepReadonly<FinalEntry>;
export class FinalEntryError extends Error {
  constructor(
    readonly code:
      'invalid-input' | 'stale-context' | 'decision-required' | 'conflicting-resolution',
  ) {
    super(code);
  }
}
function seal(raw: FinalEntry): FrozenFinalEntry {
  const parsed = finalEntrySchema.safeParse(raw);
  if (!parsed.success) throw new FinalEntryError('invalid-input');
  function freeze(value: unknown) {
    if (typeof value === 'object' && value !== null) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  }
  freeze(parsed.data);
  return parsed.data;
}
type Groups = PlayerId[][];
type Record = FinalEntry['tieBreaks'][number];
function finish(
  matchId: MatchId,
  scope: FinalEntry['scope'],
  policy: QualificationPolicy,
  scores: ScoreEntry[],
  groups: Groups,
  tieBreaks: Record[],
): FrozenFinalEntry {
  const common = { matchId, scope, policy, tieBreaks };
  if (policy.status !== 'confirmed' && groups.some((ids) => ids.length > 1))
    return seal({
      ...common,
      status: 'pending-tiebreak',
      ranking: { status: 'pending-tiebreak', decisionId: 'D06', scores },
      groups,
      next: {
        kind:
          policy.status === 'pending'
            ? 'decision-required'
            : policy.residual === 'draw'
              ? 'draw-required'
              : 'extra-questions-required',
        decisionId: 'D06',
      },
    });
  const entries = groups.flatMap((group, groupIndex) =>
    group.map((playerId) => ({
      ...scores.find((score) => score.playerId === playerId)!,
      rank: groupIndex + 1,
    })),
  );
  return seal({
    ...common,
    status: 'ready',
    ranking: { status: 'resolved', entries },
    allocations: entries.map((entry) => {
      const initialLives = CONFIRMED_FINAL_RULES.initialLivesByRank[Math.min(entry.rank, 4) - 1]!;
      return {
        playerId: entry.playerId,
        rank: entry.rank,
        initialLives,
        survivableLosses: initialLives - 1,
        eliminatingLoss: initialLives,
      };
    }),
  });
}
function partition(scores: readonly ScoreEntry[], value: (score: ScoreEntry) => number): Groups {
  const groups: Groups = [];
  let previous: number | undefined;
  for (const score of [...scores].sort(
    (a, b) => value(b) - value(a) || a.playerId.localeCompare(b.playerId),
  )) {
    const next = value(score);
    if (next !== previous) groups.push([]);
    groups.at(-1)!.push(score.playerId);
    previous = next;
  }
  return groups;
}

/** Freeze once. Later score/presence changes cannot recalculate the advantage already assigned. */
export function prepareFinalEntry(
  input: {
    matchId: MatchId;
    scope: FinalEntry['scope'];
    scores: readonly ScoreEntry[];
    policy?: QualificationPolicy;
  },
  previous?: FrozenFinalEntry | null,
): FrozenFinalEntry {
  if (previous) {
    if (previous.matchId !== input.matchId || previous.scope !== input.scope)
      throw new FinalEntryError('stale-context');
    return previous;
  }
  const id = matchIdSchema.safeParse(input.matchId),
    scoresResult = scoreboardSchema.safeParse(input.scores),
    policyResult = qualificationPolicySchema.safeParse(
      input.policy ?? {
        status: 'confirmed',
        decisionId: 'D06',
        secondary: 'correct-answers',
        residual: 'equal-lives',
      },
    );
  if (!id.success || !scoresResult.success || !policyResult.success)
    throw new FinalEntryError('invalid-input');
  const scores = scoresResult.data.sort(
    (a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId),
  );
  const policy = policyResult.data,
    tieBreaks: Record[] = [];
  let groups = partition(scores, (score) => score.points);
  if (policy.status !== 'pending')
    groups = groups.flatMap((ids) => {
      if (ids.length === 1) return [ids];
      const after = partition(
        scores.filter((score) => ids.includes(score.playerId)),
        (score) => score.correctAnswers,
      );
      tieBreaks.push({ criterion: 'correct-answers', before: ids, after });
      return after;
    });
  return finish(id.data, input.scope, policy, scores, groups, tieBreaks);
}

/** An explicit server result, never host/connection order or randomness hidden inside the domain. */
export function resolveFinalTie(
  before: FrozenFinalEntry,
  result: { matchId: MatchId; order: readonly PlayerId[] },
): FrozenFinalEntry {
  if (before.matchId !== result.matchId) throw new FinalEntryError('stale-context');
  const order = [...result.order];
  if (order.length < 2 || new Set(order).size !== order.length)
    throw new FinalEntryError('invalid-input');
  const previous = before.tieBreaks.find(
    (record) =>
      record.criterion !== 'correct-answers' &&
      record.before.length === order.length &&
      record.before.every((id) => order.includes(id)),
  );
  if (previous) {
    if (previous.after.flat().every((id, index) => id === order[index])) return before;
    throw new FinalEntryError('conflicting-resolution');
  }
  if (before.policy.status === 'pending') throw new FinalEntryError('decision-required');
  if (before.status !== 'pending-tiebreak') throw new FinalEntryError('invalid-input');
  const groupIndex = before.groups.findIndex(
    (ids) => ids.length === order.length && ids.every((id) => order.includes(id)),
  );
  if (groupIndex < 0) throw new FinalEntryError('invalid-input');
  const entry = finalEntrySchema.parse(before);
  if (entry.status !== 'pending-tiebreak' || entry.policy.status !== 'prototype')
    throw new FinalEntryError('invalid-input');
  const after = order.map((id) => [id]);
  entry.tieBreaks.push({
    criterion: entry.policy.residual,
    before: entry.groups[groupIndex]!,
    after,
  });
  entry.groups.splice(groupIndex, 1, ...after);
  return finish(
    entry.matchId,
    entry.scope,
    entry.policy,
    entry.ranking.scores,
    entry.groups,
    entry.tieBreaks,
  );
}

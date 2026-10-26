import { z } from 'zod';
import { CONFIRMED_FINAL_RULES } from '../domain/rules.js';
import { matchIdSchema, playerIdSchema, playerIdsSchema } from './identifiers.js';
import { rankingSchema } from './score.js';

export const qualificationPolicySchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('confirmed'),
    decisionId: z.literal('D06'),
    secondary: z.literal('correct-answers'),
    residual: z.literal('equal-lives'),
  }),
  z.strictObject({ status: z.literal('pending'), decisionId: z.literal('D06') }),
  z.strictObject({
    status: z.literal('prototype'),
    decisionId: z.literal('D06'),
    secondary: z.literal('correct-answers'),
    residual: z.enum(['draw', 'extra-questions']),
  }),
]);
const group = playerIdsSchema.min(1);
const tieBreak = z.strictObject({
  criterion: z.enum(['correct-answers', 'draw', 'extra-questions']),
  before: playerIdsSchema.min(2),
  after: z.array(group).min(1).max(12),
});
const common = {
  matchId: matchIdSchema,
  scope: z.enum(['isolated-prototype', 'full-match']),
  policy: qualificationPolicySchema,
  tieBreaks: z.array(tieBreak).max(24),
};
export const finalEntrySchema = z
  .discriminatedUnion('status', [
    z.strictObject({
      ...common,
      status: z.literal('pending-tiebreak'),
      ranking: rankingSchema.options[0],
      groups: z.array(group).min(1).max(12),
      next: z.strictObject({
        kind: z.enum(['decision-required', 'draw-required', 'extra-questions-required']),
        decisionId: z.literal('D06'),
      }),
    }),
    z.strictObject({
      ...common,
      status: z.literal('ready'),
      ranking: rankingSchema.options[1],
      allocations: z
        .array(
          z.strictObject({
            playerId: playerIdSchema,
            rank: z.number().int().min(1).max(12),
            initialLives: z.union([z.literal(5), z.literal(4), z.literal(3), z.literal(2)]),
            survivableLosses: z.number().int().min(1).max(4),
            eliminatingLoss: z.number().int().min(2).max(5),
          }),
        )
        .min(2)
        .max(12),
    }),
  ])
  .superRefine((entry, context) => {
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    const scores =
      entry.ranking.status === 'resolved' ? entry.ranking.entries : entry.ranking.scores;
    const byId = new Map(scores.map((score) => [score.playerId, score]));
    const sameMembers = (left: readonly string[], right: readonly string[]) =>
      left.length === right.length &&
      new Set(left).size === left.length &&
      new Set(right).size === right.length &&
      left.every((id) => right.includes(id));
    for (const record of entry.tieBreaks) {
      if (
        record.before.length < 2 ||
        record.after.some((ids) => ids.length === 0) ||
        !sameMembers(record.before, record.after.flat()) ||
        record.before.some((id) => !byId.has(id)) ||
        record.before.some((id) => byId.get(id)?.points !== byId.get(record.before[0]!)?.points)
      ) {
        invalid('O desempate deve conservar exatamente um grupo de participantes empatados.');
        continue;
      }
      if (entry.policy.status === 'pending')
        invalid('Desempate experimental exige política explícita.');
      if (record.criterion === 'correct-answers') {
        const values = record.after.map((ids) => byId.get(ids[0]!)!.correctAnswers);
        if (
          record.after.some((ids, index) =>
            ids.some((id) => byId.get(id)!.correctAnswers !== values[index]),
          ) ||
          values.some((value, index) => index > 0 && value >= values[index - 1]!)
        )
          invalid('O critério de acertos deve agrupar iguais em ordem decrescente.');
      } else if (
        entry.policy.status !== 'prototype' ||
        entry.policy.residual !== record.criterion ||
        record.after.some((ids) => ids.length !== 1) ||
        record.before.some(
          (id) => byId.get(id)!.correctAnswers !== byId.get(record.before[0]!)!.correctAnswers,
        )
      )
        invalid('A resolução residual deve corresponder à política e ao grupo empatado.');
    }
    // Replay the public evidence: a canonical display order must never silently decide a tie.
    const replay: z.infer<typeof group>[] = [];
    let previousPoints: number | undefined;
    for (const score of [...scores].sort(
      (a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId),
    )) {
      if (score.points !== previousPoints) replay.push([]);
      replay.at(-1)!.push(score.playerId);
      previousPoints = score.points;
    }
    const expectedSecondary =
      entry.policy.status !== 'pending'
        ? replay.filter((ids) => ids.length > 1).map((ids) => [...ids])
        : [];
    const secondarySeen: string[] = [];
    for (const record of entry.tieBreaks) {
      const index = replay.findIndex((ids) => sameMembers(ids, record.before));
      if (index < 0) {
        invalid('A evidência deve resolver um grupo ainda empatado.');
        continue;
      }
      if (record.criterion === 'correct-answers') {
        const key = [...record.before].sort().join(',');
        if (
          secondarySeen.includes(key) ||
          !expectedSecondary.some((ids) => [...ids].sort().join(',') === key)
        )
          invalid('O critério de acertos só pode ser aplicado uma vez por grupo.');
        secondarySeen.push(key);
      }
      replay.splice(index, 1, ...record.after);
    }
    if (expectedSecondary.some((ids) => !secondarySeen.includes([...ids].sort().join(','))))
      invalid('A proposta deve registrar a comparação de acertos em cada empate de pontos.');
    if (entry.status === 'pending-tiebreak') {
      const expected =
        entry.policy.status === 'pending'
          ? 'decision-required'
          : entry.policy.residual === 'draw'
            ? 'draw-required'
            : 'extra-questions-required';
      if (
        entry.next.kind !== expected ||
        !entry.groups.some((ids) => ids.length > 1) ||
        !sameMembers(
          entry.groups.flat(),
          scores.map((score) => score.playerId),
        )
      )
        invalid(
          'A classificação pendente precisa conservar participantes e informar o próximo passo.',
        );
      for (const ids of entry.groups) {
        const first = byId.get(ids[0]!);
        if (
          ids.some(
            (id) =>
              !byId.has(id) ||
              byId.get(id)!.points !== first?.points ||
              (entry.policy.status === 'prototype' &&
                byId.get(id)!.correctAnswers !== first?.correctAnswers),
          )
        )
          invalid('Cada grupo pendente precisa estar empatado nos critérios aplicados.');
      }
      if (JSON.stringify(entry.groups) !== JSON.stringify(replay))
        invalid('Os grupos devem corresponder aos critérios e desempates registrados.');
    } else {
      if (
        (entry.policy.status !== 'confirmed' && replay.some((ids) => ids.length > 1)) ||
        replay.flat().some((id, index) => entry.ranking.entries[index]?.playerId !== id)
      )
        invalid('A classificação resolvida precisa ter evidência para todos os empates.');
      if (
        entry.allocations.length !== scores.length ||
        new Set(entry.allocations.map((row) => row.playerId)).size !== scores.length
      )
        invalid('A conversão deve conter uma atribuição por participante.');
      for (const allocation of entry.allocations) {
        const expected = CONFIRMED_FINAL_RULES.initialLivesByRank[Math.min(allocation.rank, 4) - 1];
        if (
          !entry.ranking.entries.some(
            (row) => row.rank === allocation.rank && row.playerId === allocation.playerId,
          ) ||
          allocation.initialLives !== expected ||
          allocation.survivableLosses !== allocation.initialLives - 1 ||
          allocation.eliminatingLoss !== allocation.initialLives
        )
          invalid('Vidas e perdas suportadas precisam corresponder à colocação congelada.');
      }
      if (
        entry.policy.status === 'confirmed' &&
        replay.some((group, index) =>
          group.some(
            (id) => entry.ranking.entries.find((row) => row.playerId === id)?.rank !== index + 1,
          ),
        )
      )
        invalid('Empatados compartilham posição e a posição seguinte não pula uma faixa.');
    }
  });
export type QualificationPolicy = z.infer<typeof qualificationPolicySchema>;
export type FinalEntry = z.infer<typeof finalEntrySchema>;

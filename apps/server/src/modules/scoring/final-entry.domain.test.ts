import { describe, expect, it } from 'vitest';
import {
  finalEntrySchema,
  matchIdSchema,
  playerIdSchema,
  type FinalEntry,
  type Scoreboard,
} from '@penshow/shared';
import { prepareFinalEntry, resolveFinalTie } from './final-entry.domain.js';
import { uuid } from '../../test-support/match.js';

const matchId = matchIdSchema.parse(uuid(100));
const players = Array.from({ length: 12 }, (_, i) => playerIdSchema.parse(uuid(i + 1)));
const scope = 'full-match' as const;
const prototype = (residual: 'draw' | 'extra-questions' = 'draw') => ({
  status: 'prototype' as const,
  decisionId: 'D06' as const,
  secondary: 'correct-answers' as const,
  residual,
});
const scores = (points: number[], correctAnswers = points.map(() => 0)): Scoreboard =>
  points.map((points, i) => ({
    playerId: players[i]!,
    points,
    correctAnswers: correctAnswers[i]!,
  }));
function ready(points: number[], correctAnswers?: number[]) {
  const entry = prepareFinalEntry({ matchId, scope, scores: scores(points, correctAnswers) });
  if (entry.status !== 'ready') throw new Error('Classificação resolvida esperada.');
  return entry;
}
describe('classificação e conversão de entrada na final', () => {
  it('D06 confirmada compartilha vidas e não pula posição após grupos empatados', () => {
    const entry = ready([500, 500, 400, 300, 200], [5, 5, 4, 3, 2]);
    expect(entry.allocations.map((row) => row.rank)).toEqual([1, 1, 2, 3, 4]);
    expect(entry.allocations.map((row) => row.initialLives)).toEqual([5, 5, 4, 3, 2]);
    const all = ready([0, 0, 0]);
    expect(all.allocations.map((row) => row.initialLives)).toEqual([5, 5, 5]);
  });
  it.each([2, 3, 4, 12])(
    '%i participantes recebem exatamente as faixas existentes de vidas',
    (count) => {
      const entry = ready(Array.from({ length: count }, (_, i) => (count - i) * 100));
      expect(entry.allocations.map((row) => row.initialLives)).toEqual(
        Array.from({ length: count }, (_, i) => [5, 4, 3, 2][Math.min(i, 3)]),
      );
      expect(entry.allocations.map((row) => row.survivableLosses)).toEqual(
        Array.from({ length: count }, (_, i) => [4, 3, 2, 1][Math.min(i, 3)]),
      );
      for (const row of entry.allocations) {
        expect(row.initialLives - row.survivableLosses).toBe(1);
        expect(row.initialLives - row.eliminatingLoss).toBe(0);
      }
      expect(entry.ranking.entries).toHaveLength(count);
      expect(entry.tieBreaks).toEqual([]);
      expect(finalEntrySchema.safeParse(entry).success).toBe(true);
    },
  );
  it('independe da ordem de arrays ou Map; IDs organizam somente a apresentação de empates pendentes', () => {
    const source = scores([100, 300, 200, 100], [1, 0, 9, 5]);
    const first = prepareFinalEntry({
      matchId,
      scope,
      scores: source,
      policy: { status: 'pending', decisionId: 'D06' },
    });
    const reversed = prepareFinalEntry({
      matchId,
      scope,
      scores: [...new Map([...source].reverse().map((score) => [score.playerId, score])).values()],
      policy: { status: 'pending', decisionId: 'D06' },
    });
    expect(reversed).toEqual(first);
    expect(first).toMatchObject({
      status: 'pending-tiebreak',
      next: { kind: 'decision-required' },
      groups: [[players[1]], [players[2]], [players[0], players[3]]],
    });
    expect('allocations' in first).toBe(false);
    expect(first.tieBreaks).toEqual([]);
  });
  it('política ausente não usa acertos ou sorteio para decidir empate', () => {
    const entry = prepareFinalEntry({
      matchId,
      scope,
      scores: scores([100, 100], [1, 5]),
      policy: { status: 'pending', decisionId: 'D06' },
    });
    expect(entry.status).toBe('pending-tiebreak');
    expect(() => resolveFinalTie(entry, { matchId, order: players.slice(0, 2) })).toThrowError(
      expect.objectContaining({ code: 'decision-required' }),
    );
  });
  it('congela saldo e vidas uma única vez; repetição ignora alterações tardias e mantém a mesma referência', () => {
    const source = scores([200, 100]);
    const entry = prepareFinalEntry({ matchId, scope, scores: source });
    source[0]!.points = 0;
    source[1]!.correctAnswers = 999;
    expect(prepareFinalEntry({ matchId, scope, scores: source, policy: prototype() }, entry)).toBe(
      entry,
    );
    expect(entry.ranking).toMatchObject({
      entries: [
        { points: 200, correctAnswers: 0 },
        { points: 100, correctAnswers: 0 },
      ],
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.ranking)).toBe(true);
    if (entry.status !== 'ready') throw new Error();
    expect(Object.isFrozen(entry.allocations[0])).toBe(true);
    expect(() => {
      (entry as unknown as FinalEntry & { scope: string }).scope = 'isolated-prototype';
    }).toThrow();
    expect(() =>
      prepareFinalEntry({ matchId: matchIdSchema.parse(uuid(101)), scope, scores: source }, entry),
    ).toThrowError(expect.objectContaining({ code: 'stale-context' }));
    expect(() =>
      prepareFinalEntry({ matchId, scope: 'isolated-prototype', scores: source }, entry),
    ).toThrowError(expect.objectContaining({ code: 'stale-context' }));
  });
  it('proposta explícita compara acertos sem alterar pontos; registra grupos residuais', () => {
    const source = scores([300, 300, 300, 100], [2, 4, 2, 10]);
    const before = structuredClone(source);
    const entry = prepareFinalEntry({ matchId, scope, scores: source, policy: prototype() });
    expect(entry).toMatchObject({
      status: 'pending-tiebreak',
      groups: [[players[1]], [players[0], players[2]], [players[3]]],
      next: { kind: 'draw-required' },
      tieBreaks: [
        { criterion: 'correct-answers', after: [[players[1]], [players[0], players[2]]] },
      ],
    });
    expect(source).toEqual(before);
    const resolved = resolveFinalTie(entry, { matchId, order: [players[2]!, players[0]!] });
    expect(resolved.status).toBe('ready');
    if (resolved.status !== 'ready') throw new Error();
    expect(resolved.ranking.entries.map((score) => score.playerId)).toEqual([
      players[1],
      players[2],
      players[0],
      players[3],
    ]);
    expect(resolved.allocations.map((row) => row.initialLives)).toEqual([5, 4, 3, 2]);
    expect(resolved.tieBreaks.at(-1)).toEqual({
      criterion: 'draw',
      before: [players[0], players[2]],
      after: [[players[2]], [players[0]]],
    });
    expect(resolved.ranking.entries.map((score) => score.points)).toEqual([300, 300, 300, 100]);
  });
  it('acertos únicos resolvem todos os empates apenas na proposta explicitamente selecionada', () => {
    const entry = prepareFinalEntry({
      matchId,
      scope,
      scores: scores([100, 100, 100], [2, 3, 1]),
      policy: prototype(),
    });
    expect(entry.status).toBe('ready');
    if (entry.status !== 'ready') throw new Error();
    expect(entry.ranking.entries.map((row) => row.playerId)).toEqual([
      players[1],
      players[0],
      players[2],
    ]);
    expect(entry.tieBreaks).toHaveLength(1);
  });
  it.each(['draw', 'extra-questions'] as const)(
    '%s requer resultado explícito de cada grupo; repetir não redistribui vidas',
    (criterion) => {
      let entry = prepareFinalEntry({
        matchId,
        scope,
        scores: scores([300, 300, 100, 100], [2, 2, 1, 1]),
        policy: prototype(criterion),
      });
      expect(entry).toMatchObject({
        status: 'pending-tiebreak',
        next: { kind: criterion === 'draw' ? 'draw-required' : 'extra-questions-required' },
      });
      entry = resolveFinalTie(entry, { matchId, order: [players[1]!, players[0]!] });
      expect(entry.status).toBe('pending-tiebreak');
      expect('allocations' in entry).toBe(false);
      expect(resolveFinalTie(entry, { matchId, order: [players[1]!, players[0]!] })).toBe(entry);
      expect(() =>
        resolveFinalTie(entry, { matchId, order: [players[0]!, players[1]!] }),
      ).toThrowError(expect.objectContaining({ code: 'conflicting-resolution' }));
      entry = resolveFinalTie(entry, { matchId, order: [players[2]!, players[3]!] });
      expect(entry.status).toBe('ready');
      expect(resolveFinalTie(entry, { matchId, order: [players[1]!, players[0]!] })).toBe(entry);
      expect(entry.tieBreaks.filter((record) => record.criterion === criterion)).toHaveLength(2);
    },
  );
  it('12 empatados permanecem sem vidas até resolver o grupo inteiro, com resultado independente da ordem original', () => {
    const source = scores(Array(12).fill(0));
    const entry = prepareFinalEntry({ matchId, scope, scores: source, policy: prototype() });
    const ordered = [...players].reverse();
    const a = resolveFinalTie(entry, { matchId, order: ordered });
    const b = resolveFinalTie(
      prepareFinalEntry({ matchId, scope, scores: [...source].reverse(), policy: prototype() }),
      { matchId, order: ordered },
    );
    expect(a).toEqual(b);
    expect(a.status).toBe('ready');
  });
  it('recusa grupos parciais, repetidos, jogador externo e contexto de outra partida', () => {
    const entry = prepareFinalEntry({
      matchId,
      scope,
      scores: scores([0, 0, 0]),
      policy: prototype(),
    });
    for (const order of [
      [players[0]!],
      [players[0]!, players[0]!],
      [players[0]!, players[1]!],
      [players[0]!, players[1]!, players[3]!],
    ])
      expect(() => resolveFinalTie(entry, { matchId, order })).toThrowError(
        expect.objectContaining({ code: 'invalid-input' }),
      );
    expect(() =>
      resolveFinalTie(entry, {
        matchId: matchIdSchema.parse(uuid(101)),
        order: players.slice(0, 3),
      }),
    ).toThrowError(expect.objectContaining({ code: 'stale-context' }));
  });
  it.each([
    { invalid: [] },
    { invalid: [{ playerId: players[0]!, points: 1, correctAnswers: 0 }] },
    {
      invalid: scores([0, 0]).map(() => ({ playerId: players[0]!, points: 0, correctAnswers: 0 })),
    },
    { invalid: scores([-1, 0]) },
  ])('recusa placar inválido', ({ invalid }) => {
    expect(() => prepareFinalEntry({ matchId, scope, scores: invalid })).toThrowError(
      expect.objectContaining({ code: 'invalid-input' }),
    );
  });
});

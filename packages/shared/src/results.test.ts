import { describe, expect, it } from 'vitest';
import { matchViewSchema, roundSummarySchema } from './index.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const round = { roundId: uuid(10), mode: 'classic', index: 1 };
const summary = {
  round,
  status: 'completed',
  questionsPlayed: 6,
  players: [
    { playerId: uuid(1), pointsBefore: 0, pointsAfter: 100, pointsDelta: 100, correctAnswers: 1 },
    { playerId: uuid(2), pointsBefore: 0, pointsAfter: 0, pointsDelta: 0, correctAnswers: 0 },
  ],
};
const view = {
  matchId: uuid(11),
  rulesVersion: 'prototype-v1',
  progress: { roundNumber: 1, roundCount: 1, questionNumber: 6, questionCount: 6 },
  scoreboard: summary.players.map((player) => ({
    playerId: player.playerId,
    points: player.pointsAfter,
    correctAnswers: player.correctAnswers,
  })),
  stage: { phase: 'prototype-complete', round },
  roundSummaries: [summary],
};

describe('histórico público por fase', () => {
  it('aceita resumo encerrado com resultados coerentes sem publicar recibos ou perguntas', () => {
    expect(matchViewSchema.safeParse(view).success).toBe(true);
    expect(roundSummarySchema.safeParse({ ...summary, receivedAt: 123 }).success).toBe(false);
  });
  it.each([
    { ...summary.players[0], pointsDelta: 200 },
    { ...summary.players[0], correctAnswers: 7 },
    { ...summary.players[0], playerId: uuid(2) },
  ])('recusa delta, acertos ou membros inconsistentes', (player) => {
    expect(
      roundSummarySchema.safeParse({ ...summary, players: [player, summary.players[1]] }).success,
    ).toBe(false);
  });
  it('recusa resumo antes do encerramento, placar divergente e participantes substituídos', () => {
    expect(
      matchViewSchema.safeParse({
        ...view,
        stage: { phase: 'round-results', round, deadlineAt: 1000 },
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...view,
        scoreboard: view.scoreboard.map((score) => ({ ...score, points: score.points + 1 })),
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...view,
        roundSummaries: [
          {
            ...summary,
            players: summary.players.map((player) => ({ ...player, playerId: uuid(90) })),
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('exige continuidade do saldo entre fases e conserva o total de acertos', () => {
    const speed = {
      ...summary,
      round: { roundId: uuid(12), mode: 'speed', index: 2 },
      players: summary.players.map((player) => ({
        ...player,
        pointsBefore: player.pointsAfter,
        pointsAfter: player.pointsAfter + 200,
        pointsDelta: 200,
        correctAnswers: 1,
      })),
    };
    const combined = {
      ...view,
      stage: { phase: 'prototype-complete', round: speed.round },
      progress: { ...view.progress, roundNumber: 2, roundCount: 2 },
      speedRules: {
        correctPoints: 100,
        responseMs: 15000,
        bonusBands: [{ beforeMs: 15000, points: 0 }],
      },
      roundSummaries: [summary, speed],
      scoreboard: view.scoreboard.map((score) => ({
        ...score,
        points: score.points + 200,
        correctAnswers: score.correctAnswers + 1,
      })),
    };
    expect(matchViewSchema.safeParse(combined).success).toBe(true);
    expect(
      matchViewSchema.safeParse({ ...combined, roundSummaries: [speed, summary] }).success,
    ).toBe(false);
  });
});

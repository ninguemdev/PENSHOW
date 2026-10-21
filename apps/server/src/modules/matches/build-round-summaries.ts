import type { RoundSummary } from '@penshow/shared';
import type { MatchState } from './match.domain.js';

/** Aggregate only settled score records. Never expose answers, receipts or question IDs. */
export function buildRoundSummaries(state: MatchState): RoundSummary[] {
  const totals = new Map(
    state.roster.players.map((player) => [player.playerId, { points: 0, correctAnswers: 0 }]),
  );
  return state.rounds.slice(0, state.roundIndex + 1).map((round, index) => {
    const records = state.history.filter((record) => record.context.roundId === round.roundId);
    const players = state.roster.players.map(({ playerId }) => {
      const before = totals.get(playerId)!;
      const after = records.at(-1)?.after.find((score) => score.playerId === playerId) ?? before;
      const result = {
        playerId,
        pointsBefore: before.points,
        pointsAfter: after.points,
        pointsDelta: after.points - before.points,
        correctAnswers: after.correctAnswers - before.correctAnswers,
      };
      totals.set(playerId, { points: after.points, correctAnswers: after.correctAnswers });
      return result;
    });
    return {
      round: structuredClone(round),
      questionsPlayed: records.length,
      players,
      status:
        state.stage.phase === 'interrupted' && index === state.roundIndex
          ? 'interrupted'
          : 'completed',
    };
  });
}

import type { MatchState } from './match.domain.js';

/** Close the current window at its original deadline; stop before exposing a new question. */
export function waitsForPlayers(state: MatchState): boolean {
  const final = state.final;
  if (final) {
    if (final.stage.phase === 'final-tiebreak')
      return !['questions'].includes(final.stage.tiebreak.phase);
    return (
      final.stage.phase === 'final-instructions' ||
      (final.stage.phase === 'final-resolution' &&
        final.finalists.filter((player) => player.status === 'active').length > 1)
    );
  }
  return [
    'instructions',
    'category-selection',
    'wager-selection',
    'reveal',
    'round-results',
  ].includes(state.stage.phase);
}

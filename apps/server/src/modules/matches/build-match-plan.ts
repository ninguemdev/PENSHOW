import type { MatchState } from './match.domain.js';

export function buildMatchPlan(state: MatchState) {
  return state.finalRound
    ? { format: 'classic' as const, plan: structuredClone([...state.rounds, state.finalRound]) }
    : { format: 'isolated-prototype' as const };
}

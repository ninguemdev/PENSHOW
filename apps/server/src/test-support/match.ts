import {
  defaultAvatar,
  matchIdSchema,
  optionIdSchema,
  playerIdSchema,
  questionIdSchema,
  roundIdSchema,
  type ScoringRound,
} from '@penshow/shared';
import { approvedQuestionSchema } from '../modules/questions/editorial-question.schema.js';
import type { PreparedQuestion } from '../modules/questions/question.js';
import type { QuestionRepository } from '../modules/questions/question.repository.js';
import type { QuizRoster } from '../modules/rooms/room.js';
import { freezeMatchRules } from '../modules/scoring/match-rules.js';
import {
  createMatch,
  currentRound,
  transitionMatch,
  type MatchEvent,
  type MatchState,
} from '../modules/matches/match.domain.js';
import { classicStrategy, StrategyRegistry } from '../modules/matches/match-strategy.js';

export const uuid = (n: number) => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const players = [playerIdSchema.parse(uuid(1)), playerIdSchema.parse(uuid(2))];
export const profile = { nickname: 'Ana', avatar: defaultAvatar() };
export const roster: QuizRoster = {
  matchId: matchIdSchema.parse(uuid(100)),
  startedAt: 1000,
  settings: { format: 'prototype-v1', maxPlayers: 3, enabledCategories: ['history'] },
  players: players.map((playerId) => ({ playerId, profile })),
};
export const round: ScoringRound = {
  mode: 'classic',
  index: 1,
  roundId: roundIdSchema.parse(uuid(200)),
};
export const registry = new StrategyRegistry([classicStrategy]);
export function initial() {
  return createMatch(roster, freezeMatchRules(roster.matchId), [round], registry);
}
export function context(state = initial()) {
  return { matchId: state.roster.matchId, roundId: currentRound(state).roundId };
}
export function prepared(n = 300): PreparedQuestion {
  const options = ['Alfa', 'Beta', 'Gama', 'Delta'].map((text, i) => ({
    text,
    optionId: optionIdSchema.parse(uuid(n + i + 1)),
  }));
  return {
    publicQuestion: {
      questionId: questionIdSchema.parse(uuid(n)),
      category: 'history',
      locale: 'pt-BR',
      type: 'multiple',
      prompt: `Pergunta ${n}?`,
      difficulty: 'easy',
      options,
    },
    correctOptionId: options[0]!.optionId,
    explanation: 'Explicação privada.',
    editorialQuestionId: `private:${n}`,
    editorialOptionByPublicId: new Map(
      options.map((option, i) => [option.optionId, `editorial:${i}`]),
    ),
  };
}
export function step(state: MatchState, event: MatchEvent, now = 1000) {
  return transitionMatch(state, event, now, registry);
}
export function category() {
  let state = initial();
  for (const playerId of players)
    state = step(state, { kind: 'ready', ...context(), playerId }).state;
  return step(state, {
    kind: 'category-offered',
    offer: {
      status: 'choosing',
      ...round,
      chooserPlayerId: players[0]!,
      categories: ['history'],
      deadlineAt: 11000,
    },
  }).state;
}
export function reading() {
  const state = step(category(), {
    kind: 'choose-category',
    ...context(),
    playerId: players[0]!,
    category: 'history',
  }).state;
  return step(state, { kind: 'question-prepared', question: prepared() }).state;
}
export function repository(withHard = false, perDifficulty = 3): QuestionRepository {
  const questions = (withHard ? ['easy', 'medium', 'hard'] : ['easy', 'medium']).flatMap(
    (difficulty) =>
      Array.from({ length: perDifficulty }, (_, i) =>
        approvedQuestionSchema.parse({
          id: `fixture:${difficulty}:${i}`,
          category: 'history',
          difficulty,
          status: 'approved',
          locale: 'pt-BR',
          type: 'multiple',
          prompt: `Pergunta de teste ${difficulty} ${i}?`,
          options: ['Alfa', 'Beta', 'Gama', 'Delta'].map((text, j) => ({ id: `opt-${j}`, text })),
          correctOptionId: 'opt-0',
          explanation: 'Explicação privada.',
          source: {
            id: 'fixture',
            url: 'https://example.test/source',
            recordIndex: i,
            license: 'MIT',
          },
          review: {
            referenceUrl: 'https://example.test/fact',
            reviewedAt: '2026-10-19',
            checks: { factual: true, language: true, uniqueAnswer: true },
          },
        }),
      ),
  );
  return {
    list: () => structuredClone(questions),
    availability: () => {
      throw new Error('Não usar resumo como estoque.');
    },
  };
}

import {
  matchIdSchema,
  optionIdSchema,
  questionIdSchema,
  roundIdSchema,
  playerIdSchema,
  roomViewSchema,
  type MatchStage,
  type RoomView,
  type Scoreboard,
} from '@penshow/shared';
import { issuedSession, profile, roomView } from './fixtures';

export const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const hostId = issuedSession.playerId,
  guestId = playerIdSchema.parse(uuid(2)),
  spectatorId = playerIdSchema.parse(uuid(3));
export const round = {
  roundId: roundIdSchema.parse(uuid(10)),
  mode: 'classic' as const,
  index: 1 as const,
};
export const matchId = matchIdSchema.parse(uuid(11));
export const option1 = optionIdSchema.parse(uuid(20)),
  option2 = optionIdSchema.parse(uuid(21));
export function question(index = 1) {
  return {
    questionId: questionIdSchema.parse(uuid(100 + index)),
    category: 'history',
    locale: 'pt-BR' as const,
    type: 'multiple' as const,
    prompt: `Pergunta recebida ${index}?`,
    difficulty: (index <= 3 ? 'easy' : 'medium') as 'easy' | 'medium',
    options: [
      { optionId: option1, text: 'Alternativa Alfa' },
      { optionId: option2, text: 'Alternativa Beta' },
      { optionId: optionIdSchema.parse(uuid(22)), text: 'Alternativa Gama' },
      { optionId: optionIdSchema.parse(uuid(23)), text: 'Alternativa Delta' },
    ],
  };
}
export const zeroScores: Scoreboard = [hostId, guestId].map((playerId) => ({
  playerId,
  points: 0,
  correctAnswers: 0,
}));
export function phases(index = 1) {
  const q = question(index),
    { options: _options, ...stem } = q;
  void _options;
  return {
    instructions: { phase: 'instructions', round, deadlineAt: 16000, readyPlayerIds: [] },
    category: {
      phase: 'category-selection',
      round,
      chooserPlayerId: hostId,
      categories: ['history', 'geography'],
      deadlineAt: 11000,
    },
    reading: { phase: 'question-reading', round, question: stem, opensAt: 4000 },
    open: {
      phase: 'question-open',
      round,
      question: q,
      opensAt: 1000,
      deadlineAt: 16000,
      answeredPlayerIds: [],
      ownAnswer: { status: 'pending' },
      respondents: { kind: 'all-players' },
    },
    reveal: {
      phase: 'reveal',
      round,
      reveal: {
        question: q,
        correctOptionId: option1,
        explanation: 'Explicação recebida apenas na revelação.',
      },
      effects: [{ kind: 'credit', playerId: hostId, amount: 100, reason: 'correct-answer' }],
      deadlineAt: 6000,
    },
    results: { phase: 'round-results', round, deadlineAt: 9000 },
    complete: { phase: 'prototype-complete', round },
  } satisfies Record<string, MatchStage>;
}
export function matchView(
  stage: MatchStage = phases().open,
  version = 2,
  viewerId = hostId,
  number = 1,
  scores = zeroScores,
): RoomView {
  return roomViewSchema.parse({
    ...roomView,
    viewerId,
    stateVersion: version,
    serverNow: 1000,
    members: [
      { ...roomView.members[0], playerId: hostId, profile },
      {
        ...roomView.members[0],
        playerId: guestId,
        profile: { ...profile, nickname: 'Bruno' },
        isHost: false,
      },
      {
        ...roomView.members[0],
        playerId: spectatorId,
        profile: { ...profile, nickname: 'Cris' },
        isHost: false,
        role: 'spectator',
      },
    ],
    state: {
      status: 'match',
      settings: {
        format: 'prototype-v1',
        maxPlayers: 2,
        enabledCategories: ['history', 'geography'],
      },
      match: {
        matchId,
        rulesVersion: 'prototype-v1',
        progress: { roundNumber: 1, roundCount: 1, questionNumber: number, questionCount: 6 },
        scoreboard: scores,
        stage,
      },
    },
  });
}

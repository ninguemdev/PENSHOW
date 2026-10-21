import { roomViewSchema, roundIdSchema, playerIdSchema, type MatchStage } from '@penshow/shared';
import {
  guestId,
  hostId,
  matchId,
  matchView,
  option1,
  option2,
  phases,
  question,
  uuid,
} from './match-fixtures';

export const thirdId = playerIdSchema.parse(uuid(4));
export const finalRound = {
  roundId: roundIdSchema.parse(uuid(12)),
  mode: 'final' as const,
  index: 6 as const,
};
const scores = [hostId, guestId, thirdId].map((playerId, index) => ({
  playerId,
  points: 600 - index * 200,
  correctAnswers: 6 - index * 2,
}));
export const finalEntry = {
  matchId,
  scope: 'isolated-prototype' as const,
  status: 'ready' as const,
  policy: { status: 'pending' as const, decisionId: 'D06' as const },
  tieBreaks: [],
  ranking: {
    status: 'resolved' as const,
    entries: scores.map((score, index) => ({ ...score, rank: index + 1 })),
  },
  allocations: scores.map((score, index) => ({
    playerId: score.playerId,
    rank: index + 1,
    initialLives: 5 - index,
    survivableLosses: 4 - index,
    eliminatingLoss: 5 - index,
  })),
};
export function finalPhases() {
  const common = {
    round: finalRound,
    finalists: scores.map((score, index) => ({
      playerId: score.playerId,
      rank: index + 1,
      initialLives: (5 - index) as 5 | 4 | 3,
      lives: 5 - index,
      status: 'active' as const,
    })),
  };
  const reveal = {
    question: question(),
    correctOptionId: option1,
    explanation: 'A explicação da final.',
  };
  return {
    instructions: { ...common, phase: 'final-instructions', deadlineAt: 16000, readyPlayerIds: [] },
    reading: {
      ...common,
      phase: 'final-question-reading',
      question: phases().reading.question,
      opensAt: 4000,
    },
    open: {
      ...common,
      phase: 'final-question-open',
      question: question(),
      opensAt: 1000,
      deadlineAt: 16000,
      answerPolicy: 'first-valid-only',
    },
    target: {
      ...common,
      phase: 'final-target-selection',
      reveal,
      acceptedAnswer: { playerId: hostId, optionId: option1 },
      eligibleTargetIds: [guestId, thirdId],
      deadlineAt: 7000,
    },
    wrong: {
      ...common,
      phase: 'final-resolution',
      reveal,
      resolution: { playerId: hostId, optionId: option2, outcome: 'wrong-answer', damage: 1 },
      deadlineAt: 6000,
      finalists: common.finalists.map((player) =>
        player.playerId === hostId ? { ...player, lives: 4 } : player,
      ),
    },
    noAnswer: {
      ...common,
      phase: 'final-no-answer-pending',
      question: question(),
      decisionId: 'D02',
    },
    noTarget: {
      ...common,
      phase: 'final-no-target-pending',
      reveal,
      acceptedAnswer: { playerId: hostId, optionId: option1 },
      eligibleTargetIds: [guestId, thirdId],
      decisionId: 'D03',
    },
  } satisfies Record<string, MatchStage>;
}
export function finalView(stage: MatchStage = finalPhases().open, version = 2, viewerId = hostId) {
  const base = matchView(undefined, version);
  if (base.state.status !== 'match') throw new Error();
  return roomViewSchema.parse({
    ...base,
    viewerId,
    members: [
      ...base.members,
      {
        ...base.members[1],
        playerId: thirdId,
        profile: { ...base.members[1]!.profile, nickname: 'Dani' },
      },
    ],
    state: {
      ...base.state,
      settings: { ...base.state.settings, maxPlayers: 3 },
      match: {
        ...base.state.match,
        finalEntry,
        stage,
        scoreboard: scores,
        progress: { roundNumber: 1, roundCount: 1, questionNumber: 6, questionCount: 6 },
        ...(stage.phase === 'prototype-complete'
          ? {}
          : {
              progress: {
                roundNumber: 2,
                roundCount: 2,
                questionNumber: stage.phase === 'final-instructions' ? 0 : 1,
                questionCount: null,
              },
              finalRules: {
                status: 'prototype',
                responseMs: 15000,
                targetSelectionMs: 6000,
                noAnswerPolicy: { status: 'pending', decisionId: 'D02' },
                noTargetPolicy: { status: 'pending', decisionId: 'D03' },
              },
            }),
      },
    },
  });
}

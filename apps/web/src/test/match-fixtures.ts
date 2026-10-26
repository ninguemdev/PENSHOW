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
export function pressureView(
  kind: 'instructions' | 'reading' | 'open' | 'reveal',
  version = 2,
  viewerId = hostId,
) {
  const pressureRound = {
    ...round,
    mode: 'pressure' as const,
    index: 5 as const,
    variant: {
      status: 'confirmed' as const,
      decisionId: 'D04' as const,
      mode: 'dynamite' as const,
    },
  };
  const common = phases();
  const q = { ...question(), difficulty: 'medium' as const };
  const { options: _options, ...stem } = q;
  void _options;
  const stage: MatchStage =
    kind === 'instructions'
      ? { ...common.instructions, round: pressureRound }
      : kind === 'reading'
        ? { ...common.reading, round: pressureRound, question: stem }
        : kind === 'open'
          ? {
              ...common.open,
              round: pressureRound,
              question: q,
              deadlineAt: 11_000,
              respondents: { kind: 'single-player', playerId: hostId },
              ownAnswer: { status: viewerId === hostId ? 'pending' : 'unavailable' },
            }
          : {
              ...common.reveal,
              round: pressureRound,
              reveal: { ...common.reveal.reveal, question: q },
              effects: [{ kind: 'debit', playerId: hostId, amount: 150, reason: 'pressure' }],
            };
  const base = matchView();
  if (base.state.status !== 'match') throw new Error();
  return roomViewSchema.parse({
    ...base,
    stateVersion: version,
    viewerId,
    state: {
      ...base.state,
      match: {
        ...base.state.match,
        stage,
        progress: {
          roundNumber: 1,
          roundCount: 1,
          questionNumber: kind === 'instructions' ? 0 : 1,
          questionCount: 4,
        },
        scoreboard: [
          { playerId: hostId, points: kind === 'reveal' ? 150 : 300, correctAnswers: 1 },
          zeroScores[1],
        ],
        pressureRules: {
          correctPoints: 300,
          wrongPenalty: 150,
          responseMs: 10000,
          turnDifficulties: ['medium', 'hard'],
          status: 'confirmed',
          mode: 'dynamite',
        },
        ...(kind === 'instructions'
          ? {}
          : {
              pressureTurn: {
                playerId: hostId,
                cycle: 1,
                cycleCount: 2,
                turnNumber: 1,
                turnCount: 4,
                nextPlayerId: guestId,
                difficulty: 'medium',
                ...(kind === 'reveal' ? { outcome: 'exploded' } : {}),
              },
            }),
      },
    },
  });
}
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
        ...('round' in stage && stage.round.mode === 'theft'
          ? {
              theftRules: {
                correctPoints: 100,
                maximumTransfer: 100,
                targetSelectionMs: 6000,
                policy: 'first-correct-only',
                status: 'confirmed',
              },
            }
          : {}),
        ...('round' in stage && stage.round.mode === 'wager'
          ? { wagerRules: { correctPoints: 100, selectionMs: 6000 } }
          : {}),
        progress: { roundNumber: 1, roundCount: 1, questionNumber: number, questionCount: 6 },
        scoreboard: scores,
        stage,
      },
    },
  });
}

export function wagerPhases() {
  const wagerRound = { ...round, mode: 'wager' as const, index: 3 as const };
  const common = phases();
  return {
    instructions: { ...common.instructions, round: wagerRound },
    selection: {
      phase: 'wager-selection',
      round: wagerRound,
      questionId: question().questionId,
      category: 'history',
      difficulty: 'easy',
      deadlineAt: 7000,
      allowedAmounts: [0, 25, 50],
      ownWager: { status: 'pending' },
    },
    reading: {
      ...common.reading,
      round: wagerRound,
      ownWager: { status: 'submitted', amount: 25 },
    },
    open: { ...common.open, round: wagerRound, ownWager: { status: 'submitted', amount: 25 } },
    reveal: {
      ...common.reveal,
      round: wagerRound,
      effects: [
        { kind: 'credit', playerId: hostId, amount: 100, reason: 'correct-answer' },
        { kind: 'credit', playerId: hostId, amount: 25, reason: 'wager' },
        { kind: 'debit', playerId: guestId, amount: 50, reason: 'wager' },
      ],
      wagerResults: [
        { playerId: hostId, amount: 25, balanceBefore: 50, balanceAfter: 175 },
        { playerId: guestId, amount: 50, balanceBefore: 50, balanceAfter: 0 },
      ],
    },
  } satisfies Record<string, MatchStage>;
}

export function theftView(
  phase: 'target' | 'reveal' | 'instructions' = 'target',
  version = 2,
  viewer = hostId,
): RoomView {
  const theftRound = { ...round, mode: 'theft' as const, index: 4 as const };
  const stage: MatchStage =
    phase === 'instructions'
      ? { ...phases().instructions, round: theftRound }
      : phase === 'target'
        ? {
            phase: 'theft-target-selection',
            round: theftRound,
            questionId: question().questionId,
            attackerPlayerId: hostId,
            eligibleTargetIds: [guestId],
            deadlineAt: 7000,
          }
        : {
            ...phases().reveal,
            round: theftRound,
            effects: [
              { kind: 'credit', playerId: hostId, amount: 100, reason: 'correct-answer' },
              { kind: 'credit', playerId: guestId, amount: 100, reason: 'correct-answer' },
              { kind: 'debit', playerId: guestId, amount: 100, reason: 'theft' },
              { kind: 'credit', playerId: hostId, amount: 100, reason: 'theft' },
            ],
            theftResult: {
              attackerPlayerId: hostId,
              targetPlayerId: guestId,
              amount: 100,
              balances: [
                {
                  playerId: hostId,
                  balanceBefore: 0,
                  correctPoints: 100,
                  transfer: 100,
                  balanceAfter: 200,
                },
                {
                  playerId: guestId,
                  balanceBefore: 0,
                  correctPoints: 100,
                  transfer: -100,
                  balanceAfter: 0,
                },
              ],
            },
          };
  return matchView(
    stage,
    version,
    viewer,
    phase === 'instructions' ? 0 : 1,
    zeroScores.map((score) => ({
      ...score,
      points:
        phase === 'instructions'
          ? 0
          : phase === 'target'
            ? 100
            : score.playerId === hostId
              ? 200
              : 0,
      correctAnswers: phase === 'instructions' ? 0 : 1,
    })),
  );
}
export function wagerView(
  stage: MatchStage = wagerPhases().selection,
  version = 2,
  viewer = hostId,
) {
  return matchView(
    stage,
    version,
    viewer,
    stage.phase === 'instructions' ? 0 : 1,
    stage.phase === 'reveal'
      ? [
          { playerId: hostId, points: 175, correctAnswers: 1 },
          { playerId: guestId, points: 0, correctAnswers: 0 },
        ]
      : zeroScores.map((score) => ({ ...score, points: 50 })),
  );
}

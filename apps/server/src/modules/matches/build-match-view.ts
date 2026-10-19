import { matchViewSchema, type MatchStage, type PlayerId } from '@penshow/shared';
import { currentRound, type MatchState } from './match.domain.js';
import { demandSize, phaseDemand } from '../questions/selection-policy.js';

/** Explicit public fields only. Internal IDs, receipts and content checkpoints stay private. */
export function buildMatchView(state: MatchState, viewerId: PlayerId) {
  const round = structuredClone(currentRound(state));
  const stage = state.stage;
  let view: MatchStage;
  switch (stage.phase) {
    case 'instructions':
      view = {
        phase: stage.phase,
        round,
        deadlineAt: stage.deadlineAt,
        readyPlayerIds: [...stage.readyPlayerIds],
      };
      break;
    case 'category-selection':
      view = {
        phase: stage.phase,
        round,
        chooserPlayerId: stage.offer.chooserPlayerId,
        categories: [...stage.offer.categories],
        deadlineAt: stage.offer.deadlineAt,
      };
      break;
    case 'question-reading': {
      const question = stage.question.publicQuestion;
      view = {
        phase: stage.phase,
        round,
        opensAt: stage.opensAt,
        question: {
          questionId: question.questionId,
          category: question.category,
          locale: question.locale,
          type: question.type,
          prompt: question.prompt,
          difficulty: question.difficulty,
        },
      };
      break;
    }
    case 'question-open': {
      const own = stage.answers.find((answer) => answer.playerId === viewerId);
      view = {
        phase: stage.phase,
        round,
        question: structuredClone(stage.question.publicQuestion),
        opensAt: stage.opensAt,
        deadlineAt: stage.deadlineAt,
        answeredPlayerIds: stage.answers.map((answer) => answer.playerId),
        ownAnswer: own
          ? { status: 'submitted', optionId: own.optionId }
          : {
              status: state.roster.players.some((player) => player.playerId === viewerId)
                ? 'pending'
                : 'unavailable',
            },
        respondents: { kind: 'all-players' },
      };
      break;
    }
    case 'reveal':
      view = {
        phase: stage.phase,
        round,
        reveal: {
          question: structuredClone(stage.question.publicQuestion),
          correctOptionId: stage.question.correctOptionId,
          explanation: stage.question.explanation,
        },
        effects: structuredClone(stage.resolution.effects),
        deadlineAt: stage.deadlineAt,
      };
      break;
    case 'round-results':
      view = { phase: stage.phase, round, deadlineAt: stage.deadlineAt };
      break;
    case 'prototype-complete':
      view = { phase: stage.phase, round };
      break;
    case 'interrupted':
      view = { phase: stage.phase, reason: stage.reason };
      break;
    default:
      throw new Error('Uma transição interna não pode ser publicada.');
  }
  return matchViewSchema.parse({
    matchId: state.roster.matchId,
    rulesVersion: state.rules.parameters.version,
    progress: {
      roundNumber: state.roundIndex + 1,
      roundCount: state.rounds.length,
      questionNumber:
        state.history.filter((record) => record.context.roundId === round.roundId).length +
        (stage.phase === 'question-reading' || stage.phase === 'question-open' ? 1 : 0),
      questionCount: demandSize(
        phaseDemand(round.mode, state.roster.players.length, state.rules.parameters),
      ),
    },
    scoreboard: structuredClone(state.scoreboard),
    stage: view,
  });
}

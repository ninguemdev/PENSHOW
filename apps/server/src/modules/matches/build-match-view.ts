import { matchViewSchema, rankingSchema, type MatchStage, type PlayerId } from '@penshow/shared';
import { currentRound, currentPressureTurn, type MatchState } from './match.domain.js';
import { demandSize, phaseDemand } from '../questions/selection-policy.js';
import { allowedWagerAmounts } from '../scoring/scoring.domain.js';
import { buildFinalView } from '../final/build-final-view.js';
import { buildRoundSummaries } from './build-round-summaries.js';
import { buildMatchPlan } from './build-match-plan.js';

/** Explicit public fields only. Internal IDs, receipts and content checkpoints stay private. */
export function buildMatchView(state: MatchState, viewerId: PlayerId) {
  if (state.final) return buildFinalView(state);
  const round = structuredClone(currentRound(state));
  const stage = state.stage;
  const turn = currentPressureTurn(state);
  const own = state.wagers.find((wager) => wager.playerId === viewerId);
  const participant = state.scoreboard.find((entry) => entry.playerId === viewerId);
  const ownWager = !participant
    ? { status: 'unavailable' as const }
    : own
      ? { status: 'submitted' as const, amount: own.amount }
      : stage.phase === 'wager-selection'
        ? { status: 'pending' as const }
        : { status: 'submitted' as const, amount: 0 };
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
        ...(stage.question.narration
          ? { narration: { ...stage.question.narration, voice: 'robot-pt-br-v1' as const } }
          : {}),
        round,
        opensAt: stage.opensAt,
        ...(round.mode === 'wager' ? { ownWager } : {}),
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
              status:
                state.roster.players.some((player) => player.playerId === viewerId) &&
                (!turn || turn.playerId === viewerId)
                  ? 'pending'
                  : 'unavailable',
            },
        respondents: turn
          ? { kind: 'single-player', playerId: turn.playerId }
          : { kind: 'all-players' },
        ...(round.mode === 'wager' ? { ownWager } : {}),
      };
      break;
    }
    case 'wager-selection':
      if (round.mode !== 'wager') throw new Error('Aposta fora da modalidade.');
      view = {
        phase: stage.phase,
        round,
        questionId: stage.question.publicQuestion.questionId,
        category: stage.question.publicQuestion.category,
        difficulty: stage.question.publicQuestion.difficulty,
        deadlineAt: stage.deadlineAt,
        allowedAmounts: allowedWagerAmounts(state.rules, participant?.points ?? 0),
        ownWager,
      };
      break;
    case 'theft-target-selection':
      if (round.mode !== 'theft') throw new Error('Alvo fora da modalidade de roubo.');
      view = {
        phase: stage.phase,
        round,
        questionId: stage.question.publicQuestion.questionId,
        attackerPlayerId: stage.attackerPlayerId,
        eligibleTargetIds: [...stage.eligibleTargetIds],
        deadlineAt: stage.deadlineAt,
      };
      break;
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
        ...(stage.theftResult
          ? {
              theftResult: {
                ...stage.theftResult,
                balances: stage.resolution.changes.map((change) => ({
                  playerId: change.playerId,
                  balanceBefore: change.pointsBefore,
                  balanceAfter: change.pointsAfter,
                  correctPoints: stage.resolution.effects
                    .filter(
                      (effect) =>
                        effect.playerId === change.playerId && effect.reason === 'correct-answer',
                    )
                    .reduce((total, effect) => total + effect.amount, 0),
                  transfer:
                    change.delta -
                    stage.resolution.effects
                      .filter(
                        (effect) =>
                          effect.playerId === change.playerId && effect.reason === 'correct-answer',
                      )
                      .reduce((total, effect) => total + effect.amount, 0),
                })),
              },
            }
          : {}),
        ...(round.mode === 'wager'
          ? {
              wagerResults: stage.resolution.changes.map((change) => ({
                playerId: change.playerId,
                amount:
                  state.wagers.find((wager) => wager.playerId === change.playerId)?.amount ?? 0,
                balanceBefore: change.pointsBefore,
                balanceAfter: change.pointsAfter,
              })),
            }
          : {}),
        deadlineAt: stage.deadlineAt,
      };
      break;
    case 'round-results':
      view = { phase: stage.phase, round, deadlineAt: stage.deadlineAt };
      break;
    case 'prototype-complete':
      view = { phase: stage.phase, round };
      break;
    case 'ranking':
      if (!state.finalEntry) throw new Error('Classificação ausente.');
      view = { phase: 'ranking', ranking: rankingSchema.parse(state.finalEntry.ranking) };
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
    ...buildMatchPlan(state),
    ...(['prototype-complete', 'ranking', 'interrupted'].includes(stage.phase)
      ? { roundSummaries: buildRoundSummaries(state) }
      : {}),
    ...(state.finalEntry ? { finalEntry: structuredClone(state.finalEntry) } : {}),
    ...(round.mode === 'pressure'
      ? {
          pressureRules: {
            correctPoints: state.rules.parameters.pressure.correctPoints,
            wrongPenalty: state.rules.parameters.pressure.wrongPenalty,
            responseMs: state.rules.parameters.pressure.responseMs,
            turnDifficulties: [...state.rules.parameters.pressure.turnDifficulties],
            status: 'prototype',
            mode: 'dynamite',
          },
          ...(turn && ['question-reading', 'question-open', 'reveal'].includes(stage.phase)
            ? {
                pressureTurn: {
                  ...turn,
                  ...(stage.phase === 'reveal'
                    ? {
                        outcome: stage.resolution.correctPlayerIds.includes(turn.playerId)
                          ? 'passed'
                          : 'exploded',
                      }
                    : {}),
                },
              }
            : {}),
        }
      : {}),
    ...(round.mode === 'theft'
      ? {
          theftRules: {
            correctPoints: state.rules.parameters.theft.correctPoints,
            maximumTransfer: state.rules.parameters.theft.maximumTransfer,
            targetSelectionMs: state.rules.parameters.theft.targetSelectionMs,
            policy: state.rules.parameters.theft.policy.eligible,
            status: state.rules.parameters.theft.policy.status,
          },
        }
      : {}),
    ...(round.mode === 'wager'
      ? {
          wagerRules: {
            correctPoints: state.rules.parameters.wager.correctPoints,
            selectionMs: state.rules.parameters.wager.selectionMs,
          },
        }
      : {}),
    ...(round.mode === 'speed'
      ? {
          speedRules: {
            correctPoints: state.rules.parameters.speed.correctPoints,
            responseMs: state.rules.parameters.speed.responseMs,
            bonusBands: structuredClone(state.rules.parameters.speed.bonusBands),
          },
        }
      : {}),
    progress: {
      roundNumber: state.roundIndex + 1,
      roundCount: state.rounds.length + (state.finalRound ? 1 : 0),
      questionNumber:
        state.history.filter((record) => record.context.roundId === round.roundId).length +
        (stage.phase === 'wager-selection' ||
        stage.phase === 'theft-target-selection' ||
        stage.phase === 'question-reading' ||
        stage.phase === 'question-open'
          ? 1
          : 0),
      questionCount: demandSize(
        phaseDemand(round.mode, state.roster.players.length, state.rules.parameters),
      ),
    },
    scoreboard: structuredClone(state.scoreboard),
    stage: view,
  });
}

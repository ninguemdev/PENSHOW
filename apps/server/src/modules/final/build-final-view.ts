import { matchViewSchema, type MatchStage } from '@penshow/shared';
import type { MatchState } from '../matches/match.domain.js';
import { buildRoundSummaries } from '../matches/build-round-summaries.js';
import { buildMatchPlan } from '../matches/build-match-plan.js';

/** Public final fields are explicit; queue receipts and content checkpoints stay private. */
export function buildFinalView(state: MatchState) {
  const final = state.final;
  if (!final) throw new Error('Final ausente.');
  const stage = final.stage,
    common = { round: structuredClone(final.round), finalists: structuredClone(final.finalists) };
  const question = 'question' in stage ? stage.question : null;
  const reveal = question
    ? {
        question: structuredClone(question.publicQuestion),
        correctOptionId: question.correctOptionId,
        explanation: question.explanation,
      }
    : null;
  let view: MatchStage;
  switch (stage.phase) {
    case 'final-instructions':
      view = {
        phase: stage.phase,
        ...common,
        deadlineAt: stage.deadlineAt,
        readyPlayerIds: [...stage.readyPlayerIds],
      };
      break;
    case 'final-question-reading': {
      const { options: _options, ...stem } = stage.question.publicQuestion;
      void _options;
      view = {
        phase: stage.phase,
        ...(stage.question.narration
          ? { narration: { ...stage.question.narration, voice: 'robot-pt-br-v1' as const } }
          : {}),
        ...common,
        question: structuredClone(stem),
        opensAt: stage.opensAt,
      };
      break;
    }
    case 'final-question-open':
      view = {
        phase: stage.phase,
        ...common,
        question: structuredClone(stage.question.publicQuestion),
        opensAt: stage.opensAt,
        deadlineAt: stage.deadlineAt,
        answerPolicy: 'first-valid-only',
      };
      break;
    case 'final-target-selection':
    case 'final-no-target-pending': {
      const fields = {
        ...common,
        reveal: reveal!,
        acceptedAnswer: { playerId: stage.accepted.playerId, optionId: stage.accepted.optionId },
        eligibleTargetIds: final.finalists
          .filter(
            (player) => player.status === 'active' && player.playerId !== stage.accepted.playerId,
          )
          .map((player) => player.playerId),
      };
      view =
        stage.phase === 'final-target-selection'
          ? { phase: stage.phase, ...fields, deadlineAt: stage.deadlineAt }
          : { phase: stage.phase, ...fields, decisionId: 'D03' };
      break;
    }
    case 'final-no-answer-pending':
      view = {
        phase: stage.phase,
        ...common,
        question: structuredClone(stage.question.publicQuestion),
        decisionId: 'D02',
      };
      break;
    case 'final-resolution':
      view = {
        phase: stage.phase,
        ...common,
        reveal: reveal!,
        resolution: structuredClone(stage.resolution),
        deadlineAt: stage.deadlineAt,
      };
      break;
    case 'podium':
      view = {
        phase: stage.phase,
        ...common,
        standings: [...final.finalists]
          .sort((a, b) =>
            a.status === 'active'
              ? -1
              : b.status === 'active'
                ? 1
                : b.eliminationOrder - a.eliminationOrder,
          )
          .map((player) => player.playerId),
      };
      break;
    case 'interrupted':
      view = { phase: stage.phase, reason: stage.reason };
      break;
    default:
      throw new Error('Transição interna da final não pode ser publicada.');
  }
  const activeQuestion = [
    'final-question-reading',
    'final-question-open',
    'final-target-selection',
    'final-no-answer-pending',
    'final-no-target-pending',
  ].includes(stage.phase);
  return matchViewSchema.parse({
    matchId: state.roster.matchId,
    rulesVersion: state.rules.parameters.version,
    ...buildMatchPlan(state),
    ...(['podium', 'interrupted'].includes(stage.phase)
      ? { roundSummaries: buildRoundSummaries(state) }
      : {}),
    finalEntry: structuredClone(state.finalEntry),
    finalRules: {
      status: 'prototype',
      responseMs: state.rules.parameters.final.responseMs,
      targetSelectionMs: state.rules.parameters.final.targetSelectionMs,
      noAnswerPolicy: { status: 'pending', decisionId: 'D02' },
      noTargetPolicy: { status: 'pending', decisionId: 'D03' },
    },
    progress: {
      roundNumber: state.rounds.length + 1,
      roundCount: state.rounds.length + 1,
      questionNumber: final.history.length + (activeQuestion ? 1 : 0),
      questionCount: null,
    },
    scoreboard: structuredClone(state.scoreboard),
    stage: view,
  });
}

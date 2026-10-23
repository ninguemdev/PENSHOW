import { z } from 'zod';
import { finalEntrySchema } from './final-entry.js';
import { roundSummarySchema } from './results.js';
import { ROOM_LIMITS } from '../domain/rooms.js';
import {
  categoryIdSchema,
  matchIdSchema,
  nonnegativeIntegerSchema,
  optionIdSchema,
  playerIdSchema,
  playerIdsSchema,
  questionIdSchema,
  roomCodeSchema,
  roomIdSchema,
  stateVersionSchema,
  timestampSchema,
} from './identifiers.js';
import { roomMemberSchema } from './profile.js';
import {
  difficultySchema,
  publicQuestionSchema,
  questionStemSchema,
  revealedQuestionSchema,
} from './question.js';
import { finalistsSchema, rankingSchema, scoreboardSchema, scoreEffectSchema } from './score.js';
import {
  finalRoundSchema,
  roomSettingsSchema,
  roundSchema,
  scoringRoundSchema,
  theftRoundSchema,
  wagerRoundSchema,
} from './settings.js';

export const ownAnswerSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unavailable') }),
  z.strictObject({ status: z.literal('pending') }),
  z.strictObject({ status: z.literal('submitted'), optionId: optionIdSchema }),
]);
export const ownWagerSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unavailable') }),
  z.strictObject({ status: z.literal('pending') }),
  z.strictObject({ status: z.literal('submitted'), amount: nonnegativeIntegerSchema }),
]);

const responseWindow = { opensAt: timestampSchema, deadlineAt: timestampSchema };
const narrationSchema = z.strictObject({
  durationMs: z.number().int().min(1).max(120_000),
  voice: z.literal('robot-pt-br-v1'),
});
const finalFields = { round: finalRoundSchema, finalists: finalistsSchema };
const acceptedAnswerFields = { playerId: playerIdSchema, optionId: optionIdSchema };
export const finalResolutionSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    ...acceptedAnswerFields,
    outcome: z.literal('wrong-answer'),
    damage: z.literal(1),
  }),
  z
    .strictObject({
      ...acceptedAnswerFields,
      outcome: z.literal('attack'),
      targetPlayerId: playerIdSchema,
      damage: z.literal(1),
    })
    .refine(
      (result) => result.playerId !== result.targetPlayerId,
      'O alvo precisa ser outro participante.',
    ),
]);

export const matchStageSchema = z
  .discriminatedUnion('phase', [
    z.strictObject({
      phase: z.literal('instructions'),
      round: scoringRoundSchema,
      deadlineAt: timestampSchema,
      readyPlayerIds: playerIdsSchema,
    }),
    z.strictObject({
      phase: z.literal('category-selection'),
      round: scoringRoundSchema,
      chooserPlayerId: playerIdSchema,
      categories: z
        .array(categoryIdSchema)
        .min(1)
        .max(4)
        .refine((ids) => new Set(ids).size === ids.length),
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('question-reading'),
      narration: narrationSchema.optional(),
      round: scoringRoundSchema,
      question: questionStemSchema,
      opensAt: timestampSchema,
      ownWager: ownWagerSchema.optional(),
    }),
    z.strictObject({
      phase: z.literal('wager-selection'),
      round: wagerRoundSchema,
      questionId: questionIdSchema,
      category: categoryIdSchema,
      difficulty: difficultySchema,
      deadlineAt: timestampSchema,
      allowedAmounts: z
        .array(nonnegativeIntegerSchema)
        .min(1)
        .max(16)
        .refine((amounts) => amounts.includes(0) && new Set(amounts).size === amounts.length),
      ownWager: ownWagerSchema,
    }),
    z.strictObject({
      phase: z.literal('question-open'),
      round: scoringRoundSchema,
      question: publicQuestionSchema,
      ...responseWindow,
      answeredPlayerIds: playerIdsSchema,
      ownAnswer: ownAnswerSchema,
      ownWager: ownWagerSchema.optional(),
      respondents: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('all-players') }),
        z.strictObject({ kind: z.literal('single-player'), playerId: playerIdSchema }),
      ]),
    }),
    z.strictObject({
      phase: z.literal('theft-target-selection'),
      round: theftRoundSchema,
      questionId: questionIdSchema,
      attackerPlayerId: playerIdSchema,
      eligibleTargetIds: playerIdsSchema,
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('reveal'),
      round: scoringRoundSchema,
      reveal: revealedQuestionSchema,
      effects: z.array(scoreEffectSchema).max(120),
      theftResult: z
        .strictObject({
          attackerPlayerId: playerIdSchema.nullable(),
          targetPlayerId: playerIdSchema.nullable(),
          amount: nonnegativeIntegerSchema,
          balances: z
            .array(
              z.strictObject({
                playerId: playerIdSchema,
                balanceBefore: nonnegativeIntegerSchema,
                correctPoints: nonnegativeIntegerSchema,
                transfer: z
                  .number()
                  .int()
                  .min(-Number.MAX_SAFE_INTEGER)
                  .max(Number.MAX_SAFE_INTEGER),
                balanceAfter: nonnegativeIntegerSchema,
              }),
            )
            .min(2)
            .max(12),
        })
        .optional(),
      wagerResults: z
        .array(
          z.strictObject({
            playerId: playerIdSchema,
            amount: nonnegativeIntegerSchema,
            balanceBefore: nonnegativeIntegerSchema,
            balanceAfter: nonnegativeIntegerSchema,
          }),
        )
        .min(2)
        .max(12)
        .refine(
          (results) => new Set(results.map((result) => result.playerId)).size === results.length,
        )
        .optional(),
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('round-results'),
      round: scoringRoundSchema,
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('prototype-complete'),
      round: scoringRoundSchema,
    }),
    z.strictObject({ phase: z.literal('ranking'), ranking: rankingSchema }),
    z.strictObject({
      phase: z.literal('final-instructions'),
      ...finalFields,
      deadlineAt: timestampSchema,
      readyPlayerIds: playerIdsSchema,
    }),
    z.strictObject({
      phase: z.literal('final-question-reading'),
      narration: narrationSchema.optional(),
      ...finalFields,
      question: questionStemSchema,
      opensAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('final-question-open'),
      ...finalFields,
      question: publicQuestionSchema,
      ...responseWindow,
      answerPolicy: z.literal('first-valid-only'),
    }),
    z.strictObject({
      phase: z.literal('final-target-selection'),
      ...finalFields,
      reveal: revealedQuestionSchema,
      acceptedAnswer: z.strictObject(acceptedAnswerFields),
      eligibleTargetIds: playerIdsSchema,
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('final-resolution'),
      ...finalFields,
      reveal: revealedQuestionSchema,
      resolution: finalResolutionSchema,
      deadlineAt: timestampSchema,
    }),
    z.strictObject({
      phase: z.literal('final-no-answer-pending'),
      ...finalFields,
      question: publicQuestionSchema,
      decisionId: z.literal('D02'),
    }),
    z.strictObject({
      phase: z.literal('final-no-target-pending'),
      ...finalFields,
      reveal: revealedQuestionSchema,
      acceptedAnswer: z.strictObject(acceptedAnswerFields),
      eligibleTargetIds: playerIdsSchema,
      decisionId: z.literal('D03'),
    }),
    z.strictObject({
      phase: z.literal('podium'),
      ...finalFields,
      standings: playerIdsSchema.refine((ids) => ids.length >= 2),
    }),
    z.strictObject({
      phase: z.literal('interrupted'),
      reason: z.enum(['insufficient-questions', 'no-players', 'room-closed']),
    }),
  ])
  .superRefine((stage, context) => {
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    if ('deadlineAt' in stage && 'opensAt' in stage && stage.deadlineAt <= stage.opensAt) {
      invalid('O prazo precisa terminar depois da abertura das respostas.');
    }
    if (
      'round' in stage &&
      stage.round.mode === 'pressure' &&
      stage.round.variant.status === 'pending' &&
      stage.phase !== 'instructions' &&
      stage.phase !== 'category-selection'
    ) {
      invalid(
        'A quinta fase precisa de uma variante explicitamente experimental antes de abrir perguntas.',
      );
    }
    if (stage.phase === 'question-open') {
      const ownAnswer = stage.ownAnswer;
      const respondents = stage.respondents;
      if (
        ownAnswer.status === 'submitted' &&
        !stage.question.options.some((option) => option.optionId === ownAnswer.optionId)
      ) {
        invalid('A resposta própria precisa referenciar uma alternativa da pergunta.');
      }
      const isDynamite =
        stage.round.mode === 'pressure' && stage.round.variant.status === 'prototype';
      if (isDynamite !== (stage.respondents.kind === 'single-player'))
        invalid('Somente a dinamite experimental recebe um respondente exclusivo.');
      if (
        respondents.kind === 'single-player' &&
        stage.answeredPlayerIds.some((id) => id !== respondents.playerId)
      )
        invalid('Somente o dono do turno pode ter respondido.');
    }
    if (
      stage.phase === 'wager-selection' &&
      stage.ownWager.status === 'submitted' &&
      !stage.allowedAmounts.includes(stage.ownWager.amount)
    )
      invalid('A aposta própria precisa pertencer às opções permitidas.');
    if (
      stage.phase === 'theft-target-selection' &&
      stage.eligibleTargetIds.includes(stage.attackerPlayerId)
    )
      invalid('Quem rouba não pode ser o alvo.');
    if ('finalists' in stage) {
      const active = stage.finalists.filter((player) => player.status === 'active');
      if (stage.phase !== 'final-resolution' && stage.phase !== 'podium' && active.length < 2)
        invalid('Uma disputa da final precisa de pelo menos dois jogadores ativos.');
      if (
        stage.phase === 'final-instructions' &&
        stage.finalists.some(
          (player) => player.status !== 'active' || player.lives !== player.initialLives,
        )
      )
        invalid('A entrada na final conserva as vidas iniciais de todos.');
      if (stage.phase === 'final-target-selection' || stage.phase === 'final-no-target-pending') {
        const attacker = active.find((player) => player.playerId === stage.acceptedAnswer.playerId);
        const opponents = active.filter(
          (player) => player.playerId !== stage.acceptedAnswer.playerId,
        );
        if (
          !attacker ||
          stage.acceptedAnswer.optionId !== stage.reveal.correctOptionId ||
          opponents.length !== stage.eligibleTargetIds.length ||
          opponents.some((player) => !stage.eligibleTargetIds.includes(player.playerId))
        )
          invalid('Somente o autor do acerto escolhe entre todos os adversários ativos.');
      }
      if (stage.phase === 'final-resolution') {
        const result = stage.resolution;
        const actor = stage.finalists.find((player) => player.playerId === result.playerId);
        const victimId =
          result.outcome === 'wrong-answer' ? result.playerId : result.targetPlayerId;
        const victim = stage.finalists.find((player) => player.playerId === victimId);
        if (
          !actor ||
          !victim ||
          !stage.reveal.question.options.some((option) => option.optionId === result.optionId) ||
          (result.outcome === 'attack') !== (result.optionId === stage.reveal.correctOptionId)
        )
          invalid('A resolução precisa corresponder à única resposta avaliada e à sua vítima.');
        if (result.outcome === 'attack' && actor?.status !== 'active')
          invalid('O autor do acerto precisa estar ativo.');
        if (
          victim?.status === 'eliminated' &&
          victim.eliminationOrder !==
            stage.finalists.filter((player) => player.status === 'eliminated').length
        )
          invalid('Uma vítima eliminada nesta pergunta precisa ser a última eliminação.');
      }
      if (stage.phase === 'podium') {
        const order = [...stage.finalists]
          .sort((left, right) => {
            if (left.status === 'active') return -1;
            if (right.status === 'active') return 1;
            return right.eliminationOrder - left.eliminationOrder;
          })
          .map((player) => player.playerId);
        if (
          active.length !== 1 ||
          order.length !== stage.standings.length ||
          order.some((id, index) => id !== stage.standings[index])
        )
          invalid('O pódio começa pelo sobrevivente e segue a ordem inversa das eliminações.');
      }
    }
  });

export const matchViewSchema = z
  .strictObject({
    matchId: matchIdSchema,
    rulesVersion: z.literal('prototype-v1'),
    format: z.enum(['classic', 'isolated-prototype']).optional(),
    plan: z.array(roundSchema).length(5).optional(),
    waitingForPlayers: z.literal(true).optional(),
    finalEntry: finalEntrySchema.optional(),
    roundSummaries: z.array(roundSummarySchema).min(1).max(5).optional(),
    finalRules: z
      .strictObject({
        status: z.literal('prototype'),
        responseMs: nonnegativeIntegerSchema.min(1),
        targetSelectionMs: nonnegativeIntegerSchema.min(1),
        noAnswerPolicy: z.strictObject({
          status: z.literal('pending'),
          decisionId: z.literal('D02'),
        }),
        noTargetPolicy: z.strictObject({
          status: z.literal('pending'),
          decisionId: z.literal('D03'),
        }),
      })
      .optional(),
    pressureRules: z
      .strictObject({
        correctPoints: nonnegativeIntegerSchema,
        wrongPenalty: nonnegativeIntegerSchema,
        responseMs: nonnegativeIntegerSchema.min(1),
        turnDifficulties: z.array(difficultySchema).min(1).max(16),
        status: z.literal('prototype'),
        mode: z.literal('dynamite'),
      })
      .optional(),
    pressureTurn: z
      .strictObject({
        playerId: playerIdSchema,
        cycle: nonnegativeIntegerSchema.min(1),
        cycleCount: nonnegativeIntegerSchema.min(1).max(16),
        turnNumber: nonnegativeIntegerSchema.min(1),
        turnCount: nonnegativeIntegerSchema.min(1),
        nextPlayerId: playerIdSchema.nullable(),
        difficulty: difficultySchema,
        outcome: z.enum(['passed', 'exploded']).optional(),
      })
      .optional(),
    theftRules: z
      .strictObject({
        correctPoints: nonnegativeIntegerSchema,
        maximumTransfer: nonnegativeIntegerSchema,
        targetSelectionMs: nonnegativeIntegerSchema.min(1),
        policy: z.literal('first-correct-only'),
        status: z.literal('prototype'),
      })
      .optional(),
    wagerRules: z
      .strictObject({
        correctPoints: nonnegativeIntegerSchema,
        selectionMs: nonnegativeIntegerSchema.min(1),
      })
      .optional(),
    speedRules: z
      .strictObject({
        correctPoints: nonnegativeIntegerSchema,
        responseMs: nonnegativeIntegerSchema.min(1),
        bonusBands: z
          .array(
            z.strictObject({
              beforeMs: nonnegativeIntegerSchema.min(1),
              points: nonnegativeIntegerSchema,
            }),
          )
          .min(1)
          .max(16),
      })
      .superRefine((rules, context) => {
        if (
          rules.bonusBands.at(-1)?.beforeMs !== rules.responseMs ||
          rules.bonusBands.some(
            (band, index) =>
              index > 0 &&
              (band.beforeMs <= rules.bonusBands[index - 1]!.beforeMs ||
                band.points > rules.bonusBands[index - 1]!.points),
          )
        )
          context.addIssue({ code: 'custom', message: 'Faixas de velocidade inválidas.' });
      })
      .optional(),
    progress: z
      .strictObject({
        roundNumber: z.number().int().min(1).max(6),
        roundCount: z.number().int().min(1).max(6),
        questionNumber: nonnegativeIntegerSchema,
        questionCount: nonnegativeIntegerSchema.min(1).nullable(),
      })
      .refine(
        (progress) =>
          progress.roundNumber <= progress.roundCount &&
          (progress.questionCount === null || progress.questionNumber <= progress.questionCount),
        'O progresso precisa pertencer ao plano de fases e perguntas.',
      ),
    scoreboard: scoreboardSchema,
    stage: matchStageSchema,
  })
  .superRefine((match, context) => {
    const ids = new Set(match.scoreboard.map((entry) => entry.playerId));
    const stage = match.stage;
    if (match.format === 'classic') {
      const plan = match.plan;
      if (
        !plan ||
        plan.some(
          (round, index) =>
            round.index !== index + 1 ||
            (index === 4 ? round.mode !== 'final' : round.mode === 'final'),
        ) ||
        new Set(plan.map((round) => round.roundId)).size !== 5 ||
        new Set(plan.slice(0, 4).map((round) => round.mode)).size !== 4 ||
        match.progress.roundCount !== 5 ||
        ('round' in stage &&
          JSON.stringify(plan[match.progress.roundNumber - 1]) !== JSON.stringify(stage.round))
      )
        context.addIssue({
          code: 'custom',
          message: 'O modo clássico exige quatro modalidades distintas e a final na quinta fase.',
        });
    } else if (match.plan) {
      context.addIssue({ code: 'custom', message: 'O plano completo pertence ao modo clássico.' });
    }
    const isFinal = 'finalists' in stage;
    if (match.roundSummaries) {
      const summaries = match.roundSummaries;
      const ended = ['prototype-complete', 'ranking', 'podium', 'interrupted'].includes(
        stage.phase,
      );
      const totals = new Map(
        match.scoreboard.map((score) => [score.playerId, { points: 0, correctAnswers: 0 }]),
      );
      let valid =
        ended &&
        new Set(summaries.map((summary) => summary.round.roundId)).size === summaries.length;
      for (const summary of summaries) {
        if (summary.players.length !== totals.size) valid = false;
        for (const player of summary.players) {
          const total = totals.get(player.playerId);
          if (!total || total.points !== player.pointsBefore) {
            valid = false;
            continue;
          }
          total.points = player.pointsAfter;
          total.correctAnswers += player.correctAnswers;
        }
      }
      if (
        !valid ||
        match.scoreboard.some((score) => {
          const total = totals.get(score.playerId)!;
          return total.points !== score.points || total.correctAnswers !== score.correctAnswers;
        })
      )
        context.addIssue({
          code: 'custom',
          message: 'O histórico por fase precisa corresponder ao placar encerrado.',
        });
    }
    if (
      match.finalRules &&
      stage.phase === 'final-question-open' &&
      stage.deadlineAt - stage.opensAt !== match.finalRules.responseMs
    )
      context.addIssue({
        code: 'custom',
        message: 'A janela da final deve conservar o prazo anunciado.',
      });
    if (
      (match.progress.questionCount === null &&
        !isFinal &&
        !(stage.phase === 'interrupted' && match.finalRules)) ||
      (match.finalRules &&
        ((!isFinal && stage.phase !== 'interrupted') || match.progress.questionCount !== null))
    )
      context.addIssue({
        code: 'custom',
        message: 'O progresso sem total fixo pertence à disputa da final.',
      });
    if (match.finalEntry) {
      const entry = match.finalEntry;
      const scores =
        entry.ranking.status === 'resolved' ? entry.ranking.entries : entry.ranking.scores;
      if (
        (stage.phase !== 'prototype-complete' &&
          stage.phase !== 'ranking' &&
          !isFinal &&
          !(stage.phase === 'interrupted' && match.finalRules)) ||
        entry.scope !== (match.format === 'classic' ? 'full-match' : 'isolated-prototype') ||
        entry.matchId !== match.matchId ||
        scores.length !== match.scoreboard.length ||
        scores.some(
          (score) =>
            !match.scoreboard.some(
              (current) =>
                current.playerId === score.playerId &&
                current.points === score.points &&
                current.correctAnswers === score.correctAnswers,
            ),
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'O resumo de conversão deve corresponder ao placar encerrado e à partida.',
        });
      if (
        isFinal &&
        (entry.status !== 'ready' ||
          !match.finalRules ||
          stage.finalists.some(
            (player) =>
              entry.status === 'ready' &&
              !entry.allocations.some(
                (row) =>
                  row.playerId === player.playerId &&
                  row.rank === player.rank &&
                  row.initialLives === player.initialLives,
              ),
          ))
      )
        context.addIssue({
          code: 'custom',
          message: 'A final precisa conservar a atribuição congelada de vidas.',
        });
    }
    const pressure =
      'round' in stage &&
      stage.round.mode === 'pressure' &&
      stage.round.variant.status === 'prototype';
    const activeTurn =
      pressure && ['question-reading', 'question-open', 'reveal'].includes(stage.phase);
    const turn = match.pressureTurn;
    const pressureRules = match.pressureRules;
    if ('round' in stage && pressure !== Boolean(pressureRules))
      context.addIssue({
        code: 'custom',
        message: 'A dinamite precisa publicar suas regras de protótipo.',
      });
    if (
      activeTurn !== Boolean(turn) ||
      (turn &&
        (!pressureRules ||
          !ids.has(turn.playerId) ||
          (turn.nextPlayerId !== null && !ids.has(turn.nextPlayerId)) ||
          turn.cycleCount !== pressureRules.turnDifficulties.length ||
          turn.turnCount !== ids.size * turn.cycleCount ||
          turn.cycle !== Math.floor((turn.turnNumber - 1) / ids.size) + 1 ||
          turn.turnNumber !== match.progress.questionNumber ||
          turn.turnCount !== match.progress.questionCount ||
          turn.turnNumber > turn.turnCount ||
          (turn.nextPlayerId === null) !== (turn.turnNumber === turn.turnCount) ||
          turn.difficulty !== pressureRules.turnDifficulties[turn.cycle - 1] ||
          (stage.phase === 'reveal') !== Boolean(turn.outcome) ||
          (stage.phase === 'question-open' &&
            (stage.respondents.kind !== 'single-player' ||
              stage.respondents.playerId !== turn.playerId ||
              stage.deadlineAt - stage.opensAt !== pressureRules.responseMs ||
              stage.question.difficulty !== turn.difficulty)) ||
          (stage.phase === 'question-reading' && stage.question.difficulty !== turn.difficulty) ||
          (stage.phase === 'reveal' &&
            (stage.reveal.question.difficulty !== turn.difficulty ||
              stage.effects.length > 1 ||
              (turn.outcome === 'passed' &&
                stage.effects.length !== (pressureRules.correctPoints > 0 ? 1 : 0)) ||
              (turn.outcome === 'exploded' &&
                (stage.effects[0]?.amount ?? 0) < pressureRules.wrongPenalty &&
                match.scoreboard.find((score) => score.playerId === turn.playerId)!.points !== 0) ||
              stage.effects.some(
                (effect) =>
                  effect.playerId !== turn.playerId ||
                  (turn.outcome === 'passed'
                    ? effect.kind !== 'credit' ||
                      effect.reason !== 'correct-answer' ||
                      effect.amount !== pressureRules.correctPoints
                    : effect.kind !== 'debit' ||
                      effect.reason !== 'pressure' ||
                      effect.amount > pressureRules.wrongPenalty),
              )))))
    )
      context.addIssue({
        code: 'custom',
        message: 'Turno de dinamite incompatível com a fase, os participantes ou os efeitos.',
      });
    if ('round' in stage && (stage.round.mode === 'theft') !== Boolean(match.theftRules))
      context.addIssue({
        code: 'custom',
        message: 'A modalidade de roubo precisa publicar suas regras.',
      });
    if (stage.phase === 'theft-target-selection') {
      const expected = match.scoreboard
        .filter((score) => score.playerId !== stage.attackerPlayerId && score.points > 0)
        .map((score) => score.playerId);
      if (
        !stage.eligibleTargetIds.length ||
        expected.length !== stage.eligibleTargetIds.length ||
        expected.some((id) => !stage.eligibleTargetIds.includes(id))
      )
        context.addIssue({
          code: 'custom',
          message: 'Os alvos do roubo precisam ter saldo após os créditos.',
        });
    }
    if ('round' in stage && (stage.round.mode === 'speed') !== Boolean(match.speedRules))
      context.addIssue({ code: 'custom', message: 'A velocidade precisa publicar suas regras.' });
    if ('round' in stage && (stage.round.mode === 'wager') !== Boolean(match.wagerRules))
      context.addIssue({
        code: 'custom',
        message: 'A modalidade de aposta precisa publicar suas regras.',
      });
    if (
      (stage.phase === 'question-reading' || stage.phase === 'question-open') &&
      (stage.round.mode === 'wager') !== Boolean(stage.ownWager)
    )
      context.addIssue({
        code: 'custom',
        message: 'A pergunta de aposta precisa informar somente a aposta própria.',
      });
    if (stage.phase === 'reveal') {
      const result = stage.theftResult;
      if (
        (stage.round.mode === 'theft') !== Boolean(result) ||
        (result &&
          ((result.targetPlayerId === null && result.amount !== 0) ||
            (result.attackerPlayerId !== null && !ids.has(result.attackerPlayerId)) ||
            (result.targetPlayerId !== null &&
              (!ids.has(result.targetPlayerId) ||
                !result.attackerPlayerId ||
                result.targetPlayerId === result.attackerPlayerId)) ||
            result.balances.length !== ids.size ||
            new Set(result.balances.map((entry) => entry.playerId)).size !== ids.size ||
            result.balances.some(
              (entry) =>
                !ids.has(entry.playerId) ||
                entry.balanceAfter !==
                  match.scoreboard.find((score) => score.playerId === entry.playerId)?.points ||
                entry.balanceAfter !== entry.balanceBefore + entry.correctPoints + entry.transfer ||
                entry.transfer !==
                  (entry.playerId === result.attackerPlayerId
                    ? result.amount
                    : entry.playerId === result.targetPlayerId
                      ? -result.amount
                      : 0),
            )))
      )
        context.addIssue({
          code: 'custom',
          message: 'A transferência e a decomposição precisam corresponder ao placar.',
        });
      if (
        (stage.round.mode === 'wager') !== Boolean(stage.wagerResults) ||
        (stage.wagerResults &&
          (stage.wagerResults.length !== ids.size ||
            stage.wagerResults.some(
              (result) =>
                !ids.has(result.playerId) ||
                result.balanceAfter !==
                  match.scoreboard.find((score) => score.playerId === result.playerId)?.points ||
                result.amount > result.balanceBefore,
            )))
      )
        context.addIssue({
          code: 'custom',
          message: 'A revelação de aposta precisa corresponder aos saldos e participantes.',
        });
    }
    if (
      (('question' in stage || 'reveal' in stage || 'questionId' in stage) &&
        match.progress.questionNumber === 0) ||
      (stage.phase === 'prototype-complete' &&
        (match.progress.roundNumber !==
          match.progress.roundCount - (match.format === 'classic' ? 1 : 0) ||
          match.progress.questionNumber !== match.progress.questionCount))
    )
      context.addIssue({
        code: 'custom',
        message: 'O progresso precisa corresponder à pergunta atual e à conclusão do plano.',
      });
    const referenced = [
      ...('finalists' in stage ? stage.finalists.map((player) => player.playerId) : []),
      ...('readyPlayerIds' in stage ? stage.readyPlayerIds : []),
      ...('answeredPlayerIds' in stage ? stage.answeredPlayerIds : []),
      ...('chooserPlayerId' in stage ? [stage.chooserPlayerId] : []),
      ...('eligibleTargetIds' in stage ? stage.eligibleTargetIds : []),
      ...('attackerPlayerId' in stage ? [stage.attackerPlayerId] : []),
      ...(stage.phase === 'question-open' && stage.respondents.kind === 'single-player'
        ? [stage.respondents.playerId]
        : []),
      ...(stage.phase === 'reveal' ? stage.effects.map((effect) => effect.playerId) : []),
    ];
    if (
      referenced.some((id) => !ids.has(id)) ||
      ('finalists' in stage && stage.finalists.length !== ids.size)
    )
      context.addIssue({
        code: 'custom',
        message: 'A visão só pode referenciar os participantes fixados no placar.',
      });
    if (stage.phase === 'ranking') {
      const entries =
        stage.ranking.status === 'resolved' ? stage.ranking.entries : stage.ranking.scores;
      if (
        entries.length !== ids.size ||
        entries.some(
          (entry) =>
            !match.scoreboard.some(
              (score) =>
                score.playerId === entry.playerId &&
                score.points === entry.points &&
                score.correctAnswers === entry.correctAnswers,
            ),
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'A classificação precisa conservar o placar congelado.',
        });
    }
  });

export const roomViewSchema = z
  .strictObject({
    roomId: roomIdSchema,
    code: roomCodeSchema,
    viewerId: playerIdSchema,
    stateVersion: stateVersionSchema,
    serverNow: timestampSchema,
    members: z.array(roomMemberSchema).min(1).max(ROOM_LIMITS.maxMembers),
    state: z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('lobby'), settings: roomSettingsSchema }),
      z.strictObject({
        status: z.literal('match'),
        settings: roomSettingsSchema,
        match: matchViewSchema,
      }),
      z.strictObject({
        status: z.literal('closed'),
        reason: z.enum(['expired', 'no-players', 'server-shutdown']),
      }),
    ]),
  })
  .superRefine((room, context) => {
    const invalid = (message: string) => context.addIssue({ code: 'custom', message });
    const players = room.members.filter((member) => member.role === 'player');
    const viewer = room.members.find((member) => member.playerId === room.viewerId);
    if (
      new Set(room.members.map((member) => member.playerId)).size !== room.members.length ||
      !viewer
    )
      invalid('Os membros precisam ser únicos e incluir quem recebe a visão.');
    if (room.state.status !== 'closed') {
      if (
        players.length > room.state.settings.maxPlayers ||
        room.members.filter((member) => member.isHost).length !== 1
      )
        invalid('A sala precisa respeitar a capacidade e ter um único anfitrião.');
    }
    if (room.state.status === 'match') {
      const match = room.state.match;
      if (
        match.scoreboard.length !== players.length ||
        match.scoreboard.some(
          (entry) => !players.some((member) => member.playerId === entry.playerId),
        )
      )
        invalid('Participantes da partida precisam continuar representados nos membros da sala.');
      const stage = match.stage;
      if (stage.phase === 'question-open') {
        const canAnswer =
          viewer?.role === 'player' &&
          match.scoreboard.some((entry) => entry.playerId === viewer.playerId) &&
          (stage.respondents.kind === 'all-players' ||
            stage.respondents.playerId === viewer.playerId);
        if (canAnswer === (stage.ownAnswer.status === 'unavailable'))
          invalid(
            'A disponibilidade da resposta própria precisa corresponder ao papel e ao turno.',
          );
        if (
          viewer &&
          stage.answeredPlayerIds.includes(viewer.playerId) !==
            (stage.ownAnswer.status === 'submitted')
        )
          invalid('A resposta própria precisa corresponder à confirmação pública.');
      }
      if (stage.phase === 'wager-selection') {
        if ((viewer?.role === 'spectator') !== (stage.ownWager.status === 'unavailable'))
          invalid(
            'A disponibilidade da aposta precisa corresponder ao papel de quem recebe a visão.',
          );
        const balance =
          match.scoreboard.find((entry) => entry.playerId === room.viewerId)?.points ?? 0;
        if (stage.ownWager.status === 'submitted' && stage.ownWager.amount > balance)
          invalid('A aposta não pode ultrapassar o saldo disponível.');
        if (stage.allowedAmounts.some((amount) => amount > balance))
          invalid('As apostas oferecidas precisam estar cobertas pelo saldo.');
      }
      if (
        (stage.phase === 'question-reading' || stage.phase === 'question-open') &&
        stage.ownWager &&
        (viewer?.role === 'spectator') !== (stage.ownWager.status === 'unavailable')
      )
        invalid('Somente participantes recebem sua aposta própria.');
    }
  });

export type MatchStage = z.infer<typeof matchStageSchema>;
export type MatchView = z.infer<typeof matchViewSchema>;
export type RoomView = z.infer<typeof roomViewSchema>;
export type FinalResolution = z.infer<typeof finalResolutionSchema>;

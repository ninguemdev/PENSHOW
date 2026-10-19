import { z } from 'zod';
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
      round: scoringRoundSchema,
      question: questionStemSchema,
      opensAt: timestampSchema,
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
      if (stage.phase === 'final-target-selection') {
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
    progress: z
      .strictObject({
        roundNumber: z.number().int().min(1).max(6),
        roundCount: z.number().int().min(1).max(6),
        questionNumber: nonnegativeIntegerSchema,
        questionCount: nonnegativeIntegerSchema.min(1),
      })
      .refine(
        (progress) =>
          progress.roundNumber <= progress.roundCount &&
          progress.questionNumber <= progress.questionCount,
        'O progresso precisa pertencer ao plano de fases e perguntas.',
      ),
    scoreboard: scoreboardSchema,
    stage: matchStageSchema,
  })
  .superRefine((match, context) => {
    const ids = new Set(match.scoreboard.map((entry) => entry.playerId));
    const stage = match.stage;
    if (
      (('question' in stage || 'reveal' in stage || 'questionId' in stage) &&
        match.progress.questionNumber === 0) ||
      (stage.phase === 'prototype-complete' &&
        (match.progress.roundNumber !== match.progress.roundCount ||
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
      }
    }
  });

export type MatchStage = z.infer<typeof matchStageSchema>;
export type MatchView = z.infer<typeof matchViewSchema>;
export type RoomView = z.infer<typeof roomViewSchema>;
export type FinalResolution = z.infer<typeof finalResolutionSchema>;

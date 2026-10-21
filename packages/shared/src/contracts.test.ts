import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  acknowledgementSchema,
  actionIdSchema,
  clientCommandSchema,
  CONFIRMED_FINAL_RULES,
  createDomainError,
  DOMAIN_ERROR_MESSAGES,
  domainErrorCodeSchema,
  domainErrorSchema,
  finalistSchema,
  finalistsSchema,
  finalEntrySchema,
  matchStageSchema,
  matchViewSchema,
  nicknameSchema,
  PENDING_DECISIONS,
  playerIdSchema,
  playerProfileSchema,
  publicQuestionSchema,
  questionIdSchema,
  questionStemSchema,
  rankingSchema,
  revealedQuestionSchema,
  roomCodeSchema,
  roomMemberSchema,
  roomSettingsSchema,
  roomViewSchema,
  roundSchema,
  scoreboardSchema,
  serverEventSchema,
  stateVersionSchema,
} from './index.js';
import type { ClientCommand, CommandOf, PublicQuestion } from './index.js';

const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const player1 = uuid(1);
const player2 = uuid(2);
const player3 = uuid(3);
const roomId = uuid(10);
const matchId = uuid(11);
const roundId = uuid(12);
const questionId = uuid(13);
const actionId = uuid(14);
const option1 = uuid(20);
const option2 = uuid(21);
const profile = {
  nickname: 'Ana',
  avatar: {
    head: 'head-round',
    eyes: 'eyes-dots',
    mouth: 'mouth-smile',
    cheeks: null,
    faceAccessory: null,
    hat: null,
  },
};
const settings = {
  format: 'prototype-v1',
  maxPlayers: 12,
  enabledCategories: ['geography', 'history'],
};
const question = {
  questionId,
  category: 'geography',
  locale: 'pt-BR',
  type: 'multiple',
  prompt: 'Qual é a capital do Brasil?',
  difficulty: 'easy',
  options: [
    { optionId: option1, text: 'Brasília' },
    { optionId: option2, text: 'Recife' },
    { optionId: uuid(22), text: 'Manaus' },
    { optionId: uuid(23), text: 'Santos' },
  ],
};
const stem = {
  questionId,
  category: question.category,
  locale: question.locale,
  type: question.type,
  prompt: question.prompt,
  difficulty: question.difficulty,
};
const reveal = { question, correctOptionId: option1, explanation: 'Brasília é a capital federal.' };
const classic = { roundId, mode: 'classic', index: 1 };
const wager = { roundId, mode: 'wager', index: 3 };
const wagerRules = { correctPoints: 100, selectionMs: 6000 };
const theft = { roundId, mode: 'theft', index: 4 };
const theftRules = {
  correctPoints: 100,
  maximumTransfer: 50,
  targetSelectionMs: 6000,
  status: 'prototype',
  policy: 'first-correct-only',
};
const finalRound = { roundId, mode: 'final', index: 6 };
const finalists = [
  { playerId: player1, rank: 1, initialLives: 5, lives: 5, status: 'active' },
  { playerId: player2, rank: 2, initialLives: 4, lives: 4, status: 'active' },
];
const scoreboard = [
  { playerId: player1, points: 100, correctAnswers: 1 },
  { playerId: player2, points: 0, correctAnswers: 0 },
];
const questionOpen = {
  phase: 'question-open',
  round: classic,
  question,
  opensAt: 1000,
  deadlineAt: 16000,
  answeredPlayerIds: [],
  ownAnswer: { status: 'pending' },
  respondents: { kind: 'all-players' },
};
const finalOpen = {
  phase: 'final-question-open',
  round: finalRound,
  finalists,
  question,
  opensAt: 1000,
  deadlineAt: 16000,
  answerPolicy: 'first-valid-only',
};
const finalTarget = {
  phase: 'final-target-selection',
  round: finalRound,
  finalists,
  reveal,
  acceptedAnswer: { playerId: player1, optionId: option1 },
  eligibleTargetIds: [player2],
  deadlineAt: 22000,
};
const match = {
  matchId,
  rulesVersion: 'prototype-v1',
  progress: { roundNumber: 1, roundCount: 1, questionNumber: 1, questionCount: 6 },
  scoreboard,
  stage: questionOpen,
};
const room = {
  roomId,
  code: 'ABC234',
  viewerId: player1,
  stateVersion: 4,
  serverNow: 1000,
  members: [
    {
      playerId: player1,
      profile,
      role: 'player',
      isHost: true,
      connection: { status: 'connected' },
    },
    {
      playerId: player2,
      profile: { ...profile, nickname: 'Beto' },
      role: 'player',
      isHost: false,
      connection: { status: 'disconnected', since: 900 },
    },
  ],
  state: { status: 'match', settings, match },
};
const context = { roomId, matchId, roundId, questionId };
const command = {
  protocolVersion: 1,
  actionId,
  event: 'answer:submit',
  payload: { ...context, optionId: option1 },
};

describe('identidade, perfil e configuração', () => {
  it.each([
    [' Ana   Maria ', 'Ana Maria'],
    ['Ame\u0301lia', 'Amélia'],
    ['😀'.repeat(20), '😀'.repeat(20)],
  ])('normaliza apelidos Unicode: %s', (input, expected) => {
    expect(nicknameSchema.parse(input)).toBe(expected);
  });
  it.each(['', '   ', 'a'.repeat(21), '😀'.repeat(21), 'a\u0000b', 'a\u202eb', 'a'.repeat(257)])(
    'recusa apelido inválido: %j',
    (input) => {
      expect(nicknameSchema.safeParse(input).success).toBe(false);
    },
  );
  it('valida as peças obrigatórias e rejeita identidade ou segredo no perfil', () => {
    expect(playerProfileSchema.safeParse(profile).success).toBe(true);
    expect(
      playerProfileSchema.safeParse({ ...profile, avatar: { ...profile.avatar, head: null } })
        .success,
    ).toBe(false);
    expect(
      playerProfileSchema.safeParse({
        ...profile,
        avatar: { ...profile.avatar, eyes: '../segredo' },
      }).success,
    ).toBe(false);
    expect(playerProfileSchema.safeParse({ ...profile, token: 'segredo' }).success).toBe(false);
  });
  it.each([
    '',
    '123',
    'questionados:geography:123',
    'option-0',
    '00000000-0000-0000-0000-000000000000',
  ])('recusa IDs que não são UUIDv4: %j', (id) => {
    expect(playerIdSchema.safeParse(id).success).toBe(false);
    expect(questionIdSchema.safeParse(id).success).toBe(false);
    expect(actionIdSchema.safeParse(id).success).toBe(false);
  });
  it('distingue IDs de entidades na tipagem', () => {
    expectTypeOf<ReturnType<typeof playerIdSchema.parse>>().not.toEqualTypeOf<
      ReturnType<typeof questionIdSchema.parse>
    >();
    expect(playerIdSchema.parse(player1)).toBe(player1);
  });
  it.each(['ABC123', 'ABCDE', 'ABC2345', 'abc234', 'ABO234', 'ABI234'])(
    'recusa código ambíguo ou malformado: %s',
    (code) => {
      expect(roomCodeSchema.safeParse(code).success).toBe(false);
    },
  );
  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    'recusa uma versão não utilizável: %s',
    (version) => {
      expect(stateVersionSchema.safeParse(version).success).toBe(false);
    },
  );
  it('distingue espectador, jogador e presença sem expor transporte', () => {
    expect(roomMemberSchema.safeParse(room.members[0]).success).toBe(true);
    expect(
      roomMemberSchema.safeParse({ ...room.members[0], role: 'spectator', isHost: false }).success,
    ).toBe(true);
    expect(roomMemberSchema.safeParse({ ...room.members[0], role: 'spectator' }).success).toBe(
      false,
    );
    expect(roomMemberSchema.safeParse({ ...room.members[0], role: 'admin' }).success).toBe(false);
    expect(
      roomMemberSchema.safeParse({ ...room.members[0], connection: { status: 'disconnected' } })
        .success,
    ).toBe(false);
  });
  it.each([
    { ...settings, maxPlayers: 1 },
    { ...settings, maxPlayers: 13 },
    { ...settings, enabledCategories: [] },
    { ...settings, enabledCategories: ['history', 'history'] },
    { ...settings, enabledCategories: ['Tema com espaço'] },
    { ...settings, format: 'approved-v1' },
    { ...settings, correctOptionId: option1 },
  ])('rejeita configuração incompatível: %j', (input) => {
    expect(roomSettingsSchema.safeParse(input).success).toBe(false);
  });
  it('exige coerência entre modalidade, posição da fase e D04', () => {
    expect(roundSchema.safeParse(classic).success).toBe(true);
    expect(roundSchema.safeParse({ ...classic, index: 6 }).success).toBe(false);
    expect(roundSchema.safeParse({ ...classic, mode: 'unknown' }).success).toBe(false);
    expect(roundSchema.safeParse({ roundId, mode: 'pressure', index: 5 }).success).toBe(false);
    expect(
      roundSchema.safeParse({
        roundId,
        mode: 'pressure',
        index: 5,
        variant: { status: 'pending', decisionId: 'D04' },
      }).success,
    ).toBe(true);
  });
});

describe('fronteira pública de perguntas', () => {
  it('aceita quatro alternativas e verdadeiro/falso com duas', () => {
    expect(publicQuestionSchema.safeParse(question).success).toBe(true);
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        type: 'boolean',
        options: question.options.slice(0, 2),
      }).success,
    ).toBe(true);
    expectTypeOf<PublicQuestion>().not.toHaveProperty('correctOptionId');
    expectTypeOf<PublicQuestion>().not.toHaveProperty('source');
  });
  it.each([
    'correctOptionId',
    'explanation',
    'source',
    'editorialQuestionId',
    'futureQuestions',
    'randomSeed',
    'otherAnswers',
  ])('rejeita vazamento por %s', (field) => {
    expect(publicQuestionSchema.safeParse({ ...question, [field]: 'privado' }).success).toBe(false);
    expect(
      roomViewSchema.safeParse({
        ...room,
        state: {
          ...room.state,
          match: {
            ...match,
            stage: { ...questionOpen, question: { ...question, [field]: 'privado' } },
          },
        },
      }).success,
    ).toBe(false);
  });
  it('recusa segredo dentro de uma alternativa e IDs editoriais posicionais', () => {
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        options: question.options.map((option) => ({ ...option, isCorrect: true })),
      }).success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        options: question.options.map((option, index) => ({
          ...option,
          optionId: `option-${index}`,
        })),
      }).success,
    ).toBe(false);
  });
  it('a leitura não libera alternativas nem gabarito', () => {
    expect(questionStemSchema.safeParse(stem).success).toBe(true);
    expect(questionStemSchema.safeParse(question).success).toBe(false);
    expect(questionStemSchema.safeParse({ ...stem, correctOptionId: option1 }).success).toBe(false);
  });
  it('rejeita alternativa repetida, vazia, contagem errada e dificuldade não revisada', () => {
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        options: [...question.options.slice(0, 3), question.options[0]],
      }).success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        options: [
          question.options[0],
          { optionId: option2, text: 'BRASILIA!' },
          ...question.options.slice(2),
        ],
      }).success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({ ...question, options: question.options.slice(0, 3) })
        .success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({
        ...question,
        options: question.options.map((option) => ({ ...option, text: ' ' })),
      }).success,
    ).toBe(false);
    expect(publicQuestionSchema.safeParse({ ...question, type: 'boolean' }).success).toBe(false);
    expect(publicQuestionSchema.safeParse({ ...question, difficulty: 'unrated' }).success).toBe(
      false,
    );
  });
  it('permite gabarito apenas em revelação e exige referência a uma alternativa pública', () => {
    expect(revealedQuestionSchema.safeParse(reveal).success).toBe(true);
    expect(revealedQuestionSchema.safeParse({ ...reveal, correctOptionId: uuid(99) }).success).toBe(
      false,
    );
  });
});

describe('comandos e confirmações', () => {
  const commands = [
    ['room:create', { profile, settings }],
    ['room:join', { code: 'ABC234', profile }],
    ['room:leave', { roomId }],
    ['room:updateProfile', { roomId, profile }],
    ['room:updateSettings', { roomId, settings }],
    ['room:kick', { roomId, targetPlayerId: player2 }],
    ['match:start', { roomId }],
    ['round:ready', { roomId, matchId, roundId }],
    ['category:choose', { roomId, matchId, roundId, category: 'history' }],
    ['answer:submit', { ...context, optionId: option1 }],
    ['wager:submit', { ...context, amount: 25 }],
    ['target:choose', { ...context, targetPlayerId: player2 }],
    ['match:returnToLobby', { roomId, matchId }],
    ['time:sync', { clientSentAt: 1000 }],
  ] as const;
  it.each(commands)('valida o payload de %s', (event, payload) => {
    expect(
      clientCommandSchema.safeParse({ protocolVersion: 1, actionId, event, payload }).success,
    ).toBe(true);
    expect(
      clientCommandSchema.safeParse({
        protocolVersion: 1,
        actionId,
        event,
        payload: { ...payload, token: 'segredo' },
      }).success,
    ).toBe(false);
  });
  it('rejeita evento, versão e contexto inválidos e campos controlados pelo servidor', () => {
    expect(clientCommandSchema.safeParse({ ...command, event: 'answer:cheat' }).success).toBe(
      false,
    );
    expect(clientCommandSchema.safeParse({ ...command, protocolVersion: 2 }).success).toBe(false);
    expect(clientCommandSchema.safeParse({ ...command, actionId: undefined }).success).toBe(false);
    expect(
      clientCommandSchema.safeParse({
        ...command,
        payload: { ...command.payload, roundId: undefined },
      }).success,
    ).toBe(false);
    for (const field of ['playerId', 'receivedAt', 'clientAnsweredAt', 'isCorrect', 'points']) {
      expect(
        clientCommandSchema.safeParse({ ...command, payload: { ...command.payload, [field]: 100 } })
          .success,
      ).toBe(false);
    }
    expect(
      clientCommandSchema.safeParse({
        ...command,
        event: 'wager:submit',
        payload: { ...context, amount: -25 },
      }).success,
    ).toBe(false);
    expectTypeOf<CommandOf<'answer:submit'>>().toMatchTypeOf<ClientCommand>();
    expectTypeOf<CommandOf<'answer:submit'>['payload']>().not.toHaveProperty('playerId');
  });
  it.each(commands.map(([event]) => event))(
    'confirma %s com resultado próprio do evento',
    (event) => {
      const result =
        event === 'room:create' || event === 'room:join'
          ? { roomId, code: 'ABC234', playerId: player1, stateVersion: 1 }
          : event === 'room:leave'
            ? {}
            : event === 'match:start'
              ? { matchId, stateVersion: 1 }
              : event === 'answer:submit'
                ? { stateVersion: 1, acceptance: 'first-valid' }
                : event === 'time:sync'
                  ? { clientSentAt: 800, serverReceivedAt: 1000, serverSentAt: 1001 }
                  : { stateVersion: 1 };
      expect(
        acknowledgementSchema.safeParse({
          protocolVersion: 1,
          actionId,
          status: 'ok',
          event,
          result,
        }).success,
      ).toBe(true);
    },
  );
  it('não revela acerto na confirmação e rejeita resultado incompatível', () => {
    const ack = {
      protocolVersion: 1,
      actionId,
      status: 'ok',
      event: 'answer:submit',
      result: { stateVersion: 1, acceptance: 'first-valid' },
    };
    expect(
      acknowledgementSchema.safeParse({ ...ack, result: { ...ack.result, correct: true } }).success,
    ).toBe(false);
    expect(acknowledgementSchema.safeParse({ ...ack, event: 'room:create' }).success).toBe(false);
    expect(
      acknowledgementSchema.safeParse({
        ...ack,
        event: 'time:sync',
        result: { clientSentAt: 800, serverReceivedAt: 1001, serverSentAt: 1000 },
      }).success,
    ).toBe(false);
  });
  it('publica erros por código em pt-BR sem detalhes internos', () => {
    for (const code of domainErrorCodeSchema.options) {
      expect(domainErrorSchema.parse(createDomainError(code))).toEqual({
        code,
        message: DOMAIN_ERROR_MESSAGES[code],
      });
    }
    const failure = {
      protocolVersion: 1,
      actionId,
      status: 'error',
      error: createDomainError('QUESTION_CLOSED'),
    };
    expect(acknowledgementSchema.safeParse(failure).success).toBe(true);
    expect(acknowledgementSchema.safeParse({ ...failure, actionId: null }).success).toBe(true);
    expect(
      acknowledgementSchema.safeParse({
        ...failure,
        error: { ...failure.error, stack: '/interno' },
      }).success,
    ).toBe(false);
    expect(
      domainErrorSchema.safeParse({ code: 'INTERNAL_ERROR', message: 'SQL /interno' }).success,
    ).toBe(false);
    expect(domainErrorSchema.safeParse({ code: 'UNKNOWN', message: 'Erro' }).success).toBe(false);
  });
});

describe('fases e projeções por participante', () => {
  it('final:start aceita somente contexto da partida; não recebe vidas, políticas ou identidade', () => {
    const command = {
      protocolVersion: 1,
      actionId,
      event: 'final:start',
      payload: { roomId, matchId },
    };
    expect(clientCommandSchema.safeParse(command).success).toBe(true);
    expect(
      acknowledgementSchema.safeParse({
        protocolVersion: 1,
        actionId,
        status: 'ok',
        event: 'final:start',
        result: { stateVersion: 2 },
      }).success,
    ).toBe(true);
    for (const extra of [
      { lives: 5 },
      { playerId: player1 },
      { policy: 'skip' },
      { receivedAt: 1000 },
      { roundId },
    ])
      expect(
        clientCommandSchema.safeParse({ ...command, payload: { ...command.payload, ...extra } })
          .success,
      ).toBe(false);
  });
  it('final pendente de D02 oculta gabarito; D03 conserva autor, elegibilidade e ausência de dano', () => {
    const noAnswer = {
      phase: 'final-no-answer-pending',
      round: finalRound,
      finalists,
      question,
      decisionId: 'D02',
    };
    expect(matchStageSchema.safeParse(noAnswer).success).toBe(true);
    expect(matchStageSchema.safeParse({ ...noAnswer, reveal }).success).toBe(false);
    const noTarget = {
      phase: 'final-no-target-pending',
      round: finalRound,
      finalists,
      reveal,
      acceptedAnswer: { playerId: player1, optionId: option1 },
      eligibleTargetIds: [player2],
      decisionId: 'D03',
    };
    expect(matchStageSchema.safeParse(noTarget).success).toBe(true);
    expect(matchStageSchema.safeParse({ ...noTarget, eligibleTargetIds: [player1] }).success).toBe(
      false,
    );
    expect(
      matchStageSchema.safeParse({
        ...noTarget,
        acceptedAnswer: { playerId: player2, optionId: option2 },
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...match,
        progress: { ...match.progress, questionCount: null },
        stage: noAnswer,
      }).success,
    ).toBe(true);
    expect(
      matchViewSchema.safeParse({ ...match, progress: { ...match.progress, questionCount: null } })
        .success,
    ).toBe(false);
  });
  it('resumo de entrada exige vidas e evidências coerentes e somente aparece no encerramento correto', () => {
    const finalEntry = {
      matchId,
      scope: 'isolated-prototype',
      policy: { status: 'pending', decisionId: 'D06' },
      tieBreaks: [],
      status: 'ready',
      ranking: {
        status: 'resolved',
        entries: scoreboard.map((score, index) => ({ ...score, rank: index + 1 })),
      },
      allocations: [
        { playerId: player1, rank: 1, initialLives: 5, survivableLosses: 4, eliminatingLoss: 5 },
        { playerId: player2, rank: 2, initialLives: 4, survivableLosses: 3, eliminatingLoss: 4 },
      ],
    };
    expect(finalEntrySchema.safeParse(finalEntry).success).toBe(true);
    const complete = {
      ...match,
      progress: { ...match.progress, questionNumber: 6 },
      stage: { phase: 'prototype-complete', round: classic },
      finalEntry,
    };
    expect(matchViewSchema.safeParse(complete).success).toBe(true);
    expect(matchViewSchema.safeParse({ ...match, finalEntry }).success).toBe(false);
    for (const entry of [
      { ...finalEntry, matchId: uuid(999) },
      { ...finalEntry, scope: 'full-match' },
      {
        ...finalEntry,
        allocations: [{ ...finalEntry.allocations[0], initialLives: 4 }, finalEntry.allocations[1]],
      },
      {
        ...finalEntry,
        allocations: [
          { ...finalEntry.allocations[0], survivableLosses: 5 },
          finalEntry.allocations[1],
        ],
      },
      { ...finalEntry, allocations: [finalEntry.allocations[0], finalEntry.allocations[0]] },
    ])
      expect(matchViewSchema.safeParse({ ...complete, finalEntry: entry }).success).toBe(false);
    const equal = scoreboard.map((score) => ({ ...score, points: 0 }));
    expect(
      finalEntrySchema.safeParse({
        ...finalEntry,
        ranking: {
          status: 'resolved',
          entries: equal.map((score, index) => ({ ...score, rank: index + 1 })),
        },
      }).success,
    ).toBe(false);
    const pending = {
      ...finalEntry,
      status: 'pending-tiebreak',
      ranking: { status: 'pending-tiebreak', decisionId: 'D06', scores: equal },
      groups: [[player1, player2]],
      next: { kind: 'decision-required', decisionId: 'D06' },
    };
    const { allocations: _allocations, ...withoutLives } = pending;
    void _allocations;
    expect(finalEntrySchema.safeParse(withoutLives).success).toBe(true);
    expect(
      finalEntrySchema.safeParse({ ...withoutLives, groups: [[player1], [player2]] }).success,
    ).toBe(false);
    expect(
      finalEntrySchema.safeParse({
        ...withoutLives,
        next: { kind: 'draw-required', decisionId: 'D06' },
      }).success,
    ).toBe(false);
    expect(
      finalEntrySchema.safeParse({ ...withoutLives, allocations: finalEntry.allocations }).success,
    ).toBe(false);
    expect(
      finalEntrySchema.safeParse({
        ...withoutLives,
        tieBreaks: [
          { criterion: 'draw', before: [player1, player2], after: [[player1], [player2]] },
        ],
      }).success,
    ).toBe(false);
  });
  it('recusa evidência de desempate com grupos vazios, incompletos ou jogadores externos', () => {
    const pending = {
      matchId,
      scope: 'full-match',
      status: 'pending-tiebreak',
      policy: {
        status: 'prototype',
        decisionId: 'D06',
        secondary: 'correct-answers',
        residual: 'draw',
      },
      ranking: {
        status: 'pending-tiebreak',
        decisionId: 'D06',
        scores: scoreboard.map((score) => ({ ...score, points: 0, correctAnswers: 0 })),
      },
      groups: [[player1, player2]],
      next: { kind: 'draw-required', decisionId: 'D06' },
    };
    for (const record of [
      {
        criterion: 'correct-answers',
        before: [player1, player2],
        after: [[player1], [], [player2]],
      },
      { criterion: 'correct-answers', before: [], after: [] },
      { criterion: 'draw', before: [player1, player2], after: [[player1], [player3]] },
    ])
      expect(finalEntrySchema.safeParse({ ...pending, tieBreaks: [record] }).success).toBe(false);
  });
  it('dinamite publica turno exclusivo coerente e impede gabarito antecipado ou metadados contraditórios', () => {
    const pressureRules = {
      correctPoints: 300,
      wrongPenalty: 150,
      responseMs: 10000,
      turnDifficulties: ['medium', 'hard'],
      status: 'prototype',
      mode: 'dynamite',
    };
    const pressureTurn = {
      playerId: player1,
      cycle: 1,
      cycleCount: 2,
      turnNumber: 1,
      turnCount: 4,
      nextPlayerId: player2,
      difficulty: 'medium',
    };
    const pressure = {
      ...match,
      pressureRules,
      pressureTurn,
      progress: { ...match.progress, questionCount: 4 },
      stage: {
        ...questionOpen,
        round: {
          roundId,
          mode: 'pressure',
          index: 5,
          variant: { status: 'prototype', decisionId: 'D04', mode: 'dynamite' },
        },
        question: { ...question, difficulty: 'medium' },
        deadlineAt: 11000,
        respondents: { kind: 'single-player', playerId: player1 },
      },
    };
    expect(
      clientCommandSchema.safeParse({
        protocolVersion: 1,
        actionId,
        event: 'match:start',
        payload: { roomId, mode: 'pressure' },
      }).success,
    ).toBe(true);
    expect(matchViewSchema.safeParse(pressure).success).toBe(true);
    for (const turn of [
      { ...pressureTurn, playerId: player3 },
      { ...pressureTurn, cycle: 2 },
      { ...pressureTurn, turnCount: 6 },
      { ...pressureTurn, nextPlayerId: null },
      { ...pressureTurn, outcome: 'exploded' },
      { ...pressureTurn, difficulty: 'hard' },
    ])
      expect(matchViewSchema.safeParse({ ...pressure, pressureTurn: turn }).success).toBe(false);
    expect(matchViewSchema.safeParse({ ...pressure, pressureTurn: undefined }).success).toBe(false);
    expect(matchViewSchema.safeParse({ ...pressure, pressureRules: undefined }).success).toBe(
      false,
    );
    expect(
      matchViewSchema.safeParse({ ...pressure, pressureOrder: [player1, player2] }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({ ...pressure, stage: { ...pressure.stage, deadlineAt: 12000 } })
        .success,
    ).toBe(false);
    const explosion = {
      ...pressure,
      scoreboard: scoreboard.map((score) => ({ ...score, points: 0 })),
      pressureTurn: { ...pressureTurn, outcome: 'exploded' },
      stage: {
        phase: 'reveal',
        round: pressure.stage.round,
        reveal: { ...reveal, question: pressure.stage.question },
        effects: [{ kind: 'debit', reason: 'pressure', playerId: player1, amount: 100 }],
        deadlineAt: 15000,
      },
    };
    expect(matchViewSchema.safeParse(explosion).success).toBe(true);
    expect(
      matchViewSchema.safeParse({
        ...explosion,
        stage: {
          ...explosion.stage,
          effects: [...explosion.stage.effects, ...explosion.stage.effects],
        },
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...explosion,
        stage: {
          ...explosion.stage,
          effects: [{ ...explosion.stage.effects[0], playerId: player2 }],
        },
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...explosion,
        pressureTurn: { ...pressureTurn, outcome: 'passed' },
        stage: { ...explosion.stage, effects: [] },
      }).success,
    ).toBe(false);
  });
  it('aceita início isolado de velocidade e recusa modalidades ou relógios injetados', () => {
    const start = {
      protocolVersion: 1,
      actionId,
      event: 'match:start',
      payload: { roomId, mode: 'speed' },
    };
    expect(clientCommandSchema.safeParse(start).success).toBe(true);
    expect(clientCommandSchema.safeParse({ ...start, payload: { roomId } }).success).toBe(true);
    for (const payload of [
      { roomId, mode: 'final' },
      { roomId, mode: 'speed', receivedAt: 1 },
    ])
      expect(clientCommandSchema.safeParse({ ...start, payload }).success).toBe(false);
  });
  it('exige faixas públicas coerentes somente na velocidade, sem configuração privada', () => {
    const speedRules = {
      correctPoints: 100,
      responseMs: 15000,
      bonusBands: [
        { beforeMs: 5000, points: 50 },
        { beforeMs: 10000, points: 25 },
        { beforeMs: 15000, points: 0 },
      ],
    };
    const speed = {
      ...match,
      stage: { ...match.stage, round: { roundId, index: 2, mode: 'speed' } },
    };
    expect(matchViewSchema.safeParse({ ...speed, speedRules }).success).toBe(true);
    expect(matchViewSchema.safeParse(speed).success).toBe(false);
    expect(matchViewSchema.safeParse({ ...match, speedRules }).success).toBe(false);
    for (const invalid of [
      { ...speedRules, responseMs: 16000 },
      { ...speedRules, bonusBands: [...speedRules.bonusBands].reverse() },
      {
        ...speedRules,
        bonusBands: [
          { beforeMs: 5000, points: 25 },
          { beforeMs: 15000, points: 50 },
        ],
      },
      { ...speedRules, questions: { easy: 2, medium: 3, hard: 1 } },
    ])
      expect(matchViewSchema.safeParse({ ...speed, speedRules: invalid }).success).toBe(false);
  });
  it('recusa progresso fora do plano ou pergunta aberta sem posição', () => {
    for (const progress of [
      { ...match.progress, roundNumber: 2 },
      { ...match.progress, roundCount: 0 },
      { ...match.progress, questionNumber: 7 },
      { ...match.progress, questionNumber: 0 },
      { ...match.progress, questionCount: 0 },
    ])
      expect(matchViewSchema.safeParse({ ...match, progress }).success).toBe(false);
  });
  it('conclui explicitamente o protótipo somente após todo o plano e sem declarar vencedor', () => {
    const complete = {
      ...match,
      progress: { ...match.progress, questionNumber: 6 },
      stage: { phase: 'prototype-complete', round: classic },
    };
    expect(matchViewSchema.safeParse(complete).success).toBe(true);
    expect(matchViewSchema.safeParse({ ...complete, progress: match.progress }).success).toBe(
      false,
    );
    expect(
      matchViewSchema.safeParse({ ...complete, progress: { ...complete.progress, roundCount: 2 } })
        .success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({ ...complete, stage: { ...complete.stage, winner: player1 } })
        .success,
    ).toBe(false);
  });
  const stages = [
    { phase: 'instructions', round: classic, deadlineAt: 1000, readyPlayerIds: [] },
    {
      phase: 'category-selection',
      round: classic,
      chooserPlayerId: player1,
      categories: ['history'],
      deadlineAt: 1000,
    },
    { phase: 'question-reading', round: classic, question: stem, opensAt: 1000 },
    {
      phase: 'wager-selection',
      round: wager,
      questionId,
      category: 'geography',
      difficulty: 'easy',
      deadlineAt: 1000,
      allowedAmounts: [0, 25, 50],
      ownWager: { status: 'submitted', amount: 25 },
    },
    questionOpen,
    {
      phase: 'theft-target-selection',
      round: theft,
      questionId,
      attackerPlayerId: player1,
      eligibleTargetIds: [player2],
      deadlineAt: 1000,
    },
    {
      phase: 'reveal',
      round: classic,
      reveal,
      effects: [{ kind: 'credit', playerId: player1, amount: 100, reason: 'correct-answer' }],
      deadlineAt: 1000,
    },
    { phase: 'round-results', round: classic, deadlineAt: 1000 },
    { phase: 'prototype-complete', round: classic },
    {
      phase: 'ranking',
      ranking: { status: 'pending-tiebreak', decisionId: 'D06', scores: scoreboard },
    },
    {
      phase: 'final-instructions',
      round: finalRound,
      finalists,
      deadlineAt: 1000,
      readyPlayerIds: [],
    },
    {
      phase: 'final-question-reading',
      round: finalRound,
      finalists,
      question: stem,
      opensAt: 1000,
    },
    finalOpen,
    finalTarget,
    {
      phase: 'final-resolution',
      round: finalRound,
      finalists: [{ ...finalists[0], lives: 4 }, finalists[1]],
      reveal,
      resolution: { outcome: 'wrong-answer', playerId: player1, optionId: option2, damage: 1 },
      deadlineAt: 1000,
    },
    {
      phase: 'podium',
      round: finalRound,
      finalists: [
        finalists[0],
        { ...finalists[1], status: 'eliminated', lives: 0, eliminationOrder: 1 },
      ],
      standings: [player1, player2],
    },
    { phase: 'interrupted', reason: 'insufficient-questions' },
  ];
  it.each(stages)('aceita a fotografia completa de $phase', (stage) => {
    expect(matchStageSchema.safeParse(stage).success).toBe(true);
    const snapshot = {
      ...room,
      state: {
        ...room.state,
        match: {
          ...match,
          ...(stage.phase === 'wager-selection' ? { wagerRules } : {}),
          ...(stage.phase === 'theft-target-selection' ? { theftRules } : {}),
          ...(stage.phase === 'theft-target-selection'
            ? { scoreboard: scoreboard.map((entry) => ({ ...entry, points: 100 })) }
            : {}),
          progress:
            stage.phase === 'prototype-complete'
              ? { ...match.progress, questionNumber: match.progress.questionCount }
              : match.progress,
          stage,
        },
      },
    };
    expect(roomViewSchema.safeParse(snapshot).success).toBe(true);
    expect(
      serverEventSchema.safeParse({ protocolVersion: 1, event: 'room:view', payload: snapshot })
        .success,
    ).toBe(true);
    expect(
      serverEventSchema.safeParse({ protocolVersion: 1, event: 'room:private', payload: snapshot })
        .success,
    ).toBe(false);
    expect(roomViewSchema.safeParse({ ...snapshot, privateAnswers: [] }).success).toBe(false);
  });
  it('rejeita fase desconhecida, janela inválida e modalidade incompatível', () => {
    expect(matchStageSchema.safeParse({ phase: 'unknown' }).success).toBe(false);
    expect(matchStageSchema.safeParse({ ...questionOpen, deadlineAt: 1000 }).success).toBe(false);
    expect(matchStageSchema.safeParse({ ...questionOpen, round: finalRound }).success).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...questionOpen,
        ownAnswer: { status: 'submitted', optionId: uuid(99) },
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...questionOpen,
        round: {
          roundId,
          mode: 'pressure',
          index: 5,
          variant: { status: 'pending', decisionId: 'D04' },
        },
      }).success,
    ).toBe(false);
  });
  it('a aposta não expõe enunciado e respeita opções e saldo do destinatário', () => {
    const selection = {
      phase: 'wager-selection',
      round: wager,
      questionId,
      category: 'geography',
      difficulty: 'easy',
      deadlineAt: 1000,
      allowedAmounts: [0, 25, 50],
      ownWager: { status: 'submitted', amount: 25 },
    };
    const snapshot = {
      ...room,
      state: { ...room.state, match: { ...match, wagerRules, stage: selection } },
    };
    expect(roomViewSchema.safeParse(snapshot).success).toBe(true);
    expect(roomViewSchema.safeParse({ ...snapshot, viewerId: player2 }).success).toBe(false);
    expect(matchStageSchema.safeParse({ ...selection, prompt: question.prompt }).success).toBe(
      false,
    );
    expect(
      matchStageSchema.safeParse({ ...selection, ownWager: { status: 'submitted', amount: 75 } })
        .success,
    ).toBe(false);
    expect(matchStageSchema.safeParse({ ...selection, allowedAmounts: [25, 50] }).success).toBe(
      false,
    );
  });
  it('mantém o turno individual da dinamite explicitamente experimental', () => {
    const dynamite = {
      ...questionOpen,
      round: {
        roundId,
        mode: 'pressure',
        index: 5,
        variant: { status: 'prototype', decisionId: 'D04', mode: 'dynamite' },
      },
      respondents: { kind: 'single-player', playerId: player1 },
    };
    expect(matchStageSchema.safeParse(dynamite).success).toBe(true);
    expect(
      matchStageSchema.safeParse({ ...dynamite, respondents: { kind: 'all-players' } }).success,
    ).toBe(false);
    expect(matchStageSchema.safeParse({ ...dynamite, answeredPlayerIds: [player2] }).success).toBe(
      false,
    );
  });
  it('não dá resposta própria a espectador ou adversário fora do turno', () => {
    const spectator = {
      playerId: player3,
      profile,
      role: 'spectator',
      isHost: false,
      connection: { status: 'connected' },
    };
    const snapshot = { ...room, viewerId: player3, members: [...room.members, spectator] };
    expect(roomViewSchema.safeParse(snapshot).success).toBe(false);
    expect(
      roomViewSchema.safeParse({
        ...snapshot,
        state: {
          ...room.state,
          match: { ...match, stage: { ...questionOpen, ownAnswer: { status: 'unavailable' } } },
        },
      }).success,
    ).toBe(true);
    expect(
      roomViewSchema.safeParse({
        ...room,
        state: {
          ...room.state,
          match: { ...match, stage: { ...questionOpen, answeredPlayerIds: [player1] } },
        },
      }).success,
    ).toBe(false);
  });
  it('rejeita membros repetidos, anfitriões incompatíveis, lotação e participantes alheios', () => {
    expect(
      roomViewSchema.safeParse({ ...room, members: [room.members[0], room.members[0]] }).success,
    ).toBe(false);
    expect(
      roomViewSchema.safeParse({
        ...room,
        members: room.members.map((member) => ({ ...member, isHost: true })),
      }).success,
    ).toBe(false);
    expect(roomViewSchema.safeParse({ ...room, viewerId: player3 }).success).toBe(false);
    expect(
      roomViewSchema.safeParse({
        ...room,
        state: { ...room.state, settings: { ...settings, maxPlayers: 2 } },
        members: [...room.members, { ...room.members[1], playerId: player3 }],
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...match,
        stage: {
          phase: 'instructions',
          round: classic,
          readyPlayerIds: [player3],
          deadlineAt: 1000,
        },
      }).success,
    ).toBe(false);
  });
});

describe('placar e regras confirmadas da final', () => {
  it('não resolve D01 a D06 por padrão', () => {
    expect(Object.keys(PENDING_DECISIONS)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06']);
    expect(
      Object.values(PENDING_DECISIONS).every((decision) => decision.status === 'in-consultation'),
    ).toBe(true);
    expect(matchStageSchema.safeParse({ ...finalOpen, timeoutPolicy: 'skip' }).success).toBe(false);
  });
  it('conserva saldo não negativo e mantém desempate separado da distribuição de vidas', () => {
    expect(
      rankingSchema.safeParse({
        status: 'resolved',
        entries: [...scoreboard].reverse().map((entry, index) => ({ ...entry, rank: index + 1 })),
      }).success,
    ).toBe(false);
    expect(scoreboardSchema.safeParse(scoreboard).success).toBe(true);
    expect(scoreboardSchema.safeParse([scoreboard[0], scoreboard[0]]).success).toBe(false);
    expect(
      scoreboardSchema.safeParse([{ ...scoreboard[0], points: -1 }, scoreboard[1]]).success,
    ).toBe(false);
    expect(
      rankingSchema.safeParse({
        status: 'resolved',
        entries: scoreboard.map((entry, index) => ({ ...entry, rank: index + 1 })),
      }).success,
    ).toBe(true);
    expect(
      rankingSchema.safeParse({
        status: 'resolved',
        entries: scoreboard.map((entry) => ({ ...entry, rank: 1 })),
      }).success,
    ).toBe(false);
    expect(
      matchViewSchema.safeParse({
        ...match,
        stage: {
          phase: 'ranking',
          ranking: {
            status: 'pending-tiebreak',
            decisionId: 'D06',
            scores: scoreboard.map((entry) => ({ ...entry, points: 999 })),
          },
        },
      }).success,
    ).toBe(false);
  });
  it.each(Array.from({ length: 12 }, (_, index) => index + 1))(
    'representa as vidas confirmadas da posição %s',
    (rank) => {
      const initialLives = rank === 1 ? 5 : rank === 2 ? 4 : rank === 3 ? 3 : 2;
      expect(
        finalistSchema.safeParse({
          playerId: player1,
          rank,
          initialLives,
          lives: 1,
          status: 'active',
        }).success,
      ).toBe(true);
      expect(
        finalistSchema.safeParse({
          playerId: player1,
          rank,
          initialLives,
          lives: 0,
          status: 'eliminated',
          eliminationOrder: 1,
        }).success,
      ).toBe(true);
      expect(
        finalistSchema.safeParse({
          playerId: player1,
          rank,
          initialLives,
          lives: 0,
          status: 'active',
        }).success,
      ).toBe(false);
      expect(
        finalistSchema.safeParse({
          playerId: player1,
          rank,
          initialLives: initialLives - 1,
          lives: 1,
          status: 'active',
        }).success,
      ).toBe(false);
    },
  );
  it('o líder continua ativo com uma vida após quatro perdas', () => {
    expect(CONFIRMED_FINAL_RULES.initialLivesByRank).toEqual([5, 4, 3, 2]);
    expect(finalistSchema.safeParse({ ...finalists[0], lives: 1 }).success).toBe(true);
    expect(finalistSchema.safeParse({ ...finalists[1], lives: 5 }).success).toBe(false);
    expect(finalistsSchema.safeParse([finalists[0], { ...finalists[1], rank: 1 }]).success).toBe(
      false,
    );
    expect(
      finalistsSchema.safeParse(
        finalists.map((player, index) => ({
          ...player,
          status: 'eliminated',
          lives: 0,
          eliminationOrder: index + 1,
        })),
      ).success,
    ).toBe(false);
  });
  it('não admite várias respostas, repasse da pergunta nem vários danos', () => {
    expect(
      matchStageSchema.safeParse({ ...finalOpen, answerPolicy: 'first-correct' }).success,
    ).toBe(false);
    expect(matchStageSchema.safeParse({ ...finalOpen, acceptedAnswers: [] }).success).toBe(false);
    const resolution = {
      phase: 'final-resolution',
      round: finalRound,
      finalists: [{ ...finalists[0], lives: 4 }, finalists[1]],
      reveal,
      resolution: { outcome: 'wrong-answer', playerId: player1, optionId: option2, damage: 1 },
      deadlineAt: 1000,
    };
    expect(matchStageSchema.safeParse(resolution).success).toBe(true);
    expect(
      matchStageSchema.safeParse({
        ...resolution,
        resolution: { ...resolution.resolution, damage: 2 },
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...resolution,
        resolution: { ...resolution.resolution, targetPlayerId: player2 },
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...resolution,
        resolution: { ...resolution.resolution, optionId: option1 },
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...resolution,
        finalists: [finalists[0], { ...finalists[1], lives: 3 }],
        resolution: {
          outcome: 'attack',
          playerId: player1,
          optionId: option1,
          targetPlayerId: player2,
          damage: 1,
        },
      }).success,
    ).toBe(true);
  });
  it('somente o primeiro acerto escolhe qualquer adversário ativo', () => {
    expect(matchStageSchema.safeParse(finalTarget).success).toBe(true);
    expect(
      matchStageSchema.safeParse({
        ...finalTarget,
        acceptedAnswer: { playerId: player1, optionId: option2 },
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({ ...finalTarget, eligibleTargetIds: [player1] }).success,
    ).toBe(false);
    expect(matchStageSchema.safeParse({ ...finalTarget, eligibleTargetIds: [] }).success).toBe(
      false,
    );
    const third = { playerId: player3, rank: 3, initialLives: 3, lives: 3, status: 'active' };
    expect(
      matchStageSchema.safeParse({
        ...finalTarget,
        finalists: [...finalists, third],
        eligibleTargetIds: [player2],
      }).success,
    ).toBe(false);
    expect(
      matchStageSchema.safeParse({
        ...finalTarget,
        finalists: [...finalists, third],
        eligibleTargetIds: [player2, player3],
      }).success,
    ).toBe(true);
  });
});

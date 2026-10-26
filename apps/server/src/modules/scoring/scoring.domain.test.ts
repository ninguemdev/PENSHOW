import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_FINAL_RULES,
  PENDING_DECISIONS,
  matchIdSchema,
  playerIdSchema,
  questionIdSchema,
  roundIdSchema,
  scoreboardSchema,
  scoreEffectSchema,
  type ScoreEntry,
} from '@penshow/shared';
import {
  freezeMatchRules,
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from './match-rules.js';
import {
  addCorrectAnswer,
  allowedWagerAmounts,
  createScoreboard,
  credit,
  debit,
  resolveQuestion,
  scoreboardChanges,
  sealWager,
  transferPoints,
  type AcceptedScoringAnswer,
  type QuestionScoreResolution,
  type ScoringContext,
  type ScoringHistory,
  type ScoringInput,
} from './scoring.domain.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const a = playerIdSchema.parse(uuid(1)),
  b = playerIdSchema.parse(uuid(2)),
  outsider = playerIdSchema.parse(uuid(3));
const matchId = matchIdSchema.parse(uuid(10));
const rules = freezeMatchRules(matchId);
const context: ScoringContext = {
  matchId,
  roundId: roundIdSchema.parse(uuid(20)),
  questionId: questionIdSchema.parse(uuid(30)),
  opensAt: 1000,
};
function board(first = 0, second = 0): ScoreEntry[] {
  const scores = createScoreboard([a, b]);
  scores[0]!.points = first;
  scores[1]!.points = second;
  return scores;
}
function answer(playerId = a, correct = true, elapsedMs = 1): AcceptedScoringAnswer {
  return { playerId, correct, receivedAt: context.opensAt + elapsedMs };
}
function run(input: ScoringInput, before = board()) {
  return resolveQuestion(rules, before, context, input);
}
const scoreOf = (scores: readonly ScoreEntry[], id = a) =>
  scores.find((entry) => entry.playerId === id)!;

describe('configuração experimental congelada por partida', () => {
  it('copia os parâmetros e congela objetos/arrays, mantendo a final confirmada separada', () => {
    const mutable = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    const frozen = freezeMatchRules(matchId, mutable);
    mutable.classic.correctPoints = 999;
    mutable.speed.bonusBands[0]!.points = 999;
    expect(frozen.parameters.classic.correctPoints).toBe(100);
    expect(frozen.parameters.speed.bonusBands[0]!.points).toBe(50);
    expect(frozen.parameters.theft).toMatchObject({
      correctPoints: 100,
      maximumTransfer: 100,
      policy: { status: 'confirmed', decisionId: 'D05', eligible: 'first-correct-only' },
    });
    expect(frozen.parameters.pressure).toMatchObject({
      turnDifficulties: ['medium', 'hard'],
      responseMs: 10_000,
      policy: { status: 'confirmed', decisionId: 'D04', mode: 'dynamite' },
    });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.parameters.speed.bonusBands)).toBe(true);
    expect(Object.isFrozen(frozen.parameters.speed.bonusBands[0])).toBe(true);
    expect(Reflect.set(frozen.parameters.classic, 'correctPoints', 800)).toBe(false);
    expect(frozen.confirmedFinal).toBe(CONFIRMED_FINAL_RULES);
    expect(frozen.confirmedFinal.initialLivesByRank).toEqual([5, 4, 3, 2]);
    expect(frozen.pendingDecisions).toBe(PENDING_DECISIONS);
    expect(frozen.pendingDecisions).toEqual({});
  });

  it('uma alteração explícita afeta a nova partida, conservando a configuração da anterior', () => {
    const custom = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    custom.classic.correctPoints = 175;
    custom.speed.correctPoints = 200;
    custom.speed.responseMs = 9000;
    custom.speed.bonusBands = [
      { beforeMs: 2000, points: 80 },
      { beforeMs: 9000, points: 0 },
    ];
    const changed = freezeMatchRules(matchId, custom);
    const input: ScoringInput = { mode: 'classic', answers: [answer()] };
    expect(scoreOf(resolveQuestion(changed, board(), context, input).after).points).toBe(175);
    expect(scoreOf(resolveQuestion(rules, board(), context, input).after).points).toBe(100);
    expect(changed.confirmedFinal.initialLivesByRank).toEqual([5, 4, 3, 2]);
    expect(
      scoreOf(
        resolveQuestion(changed, board(), context, {
          mode: 'speed',
          answers: [answer(a, true, 1999)],
        }).after,
      ).points,
    ).toBe(280);
    expect(
      scoreOf(
        resolveQuestion(changed, board(), context, {
          mode: 'speed',
          answers: [answer(a, true, 2000)],
        }).after,
      ).points,
    ).toBe(200);
    expect(() =>
      resolveQuestion(changed, board(), context, {
        mode: 'speed',
        answers: [answer(a, true, 9000)],
      }),
    ).toThrow('invalid-window');
  });

  it('recusa regras confirmadas injetadas, prazos/faixas inválidos, apostas incoerentes e políticas aprovadas por suposição', () => {
    const changes = [
      { final: { ...PROTOTYPE_PARAMETERS.final, initialLivesByRank: [4, 3, 2, 1] } },
      { status: 'confirmed' },
      { timings: { ...PROTOTYPE_PARAMETERS.timings, readingMs: 0 } },
      { speed: { ...PROTOTYPE_PARAMETERS.speed, bonusBands: [{ beforeMs: 5000, points: 0 }] } },
      {
        speed: {
          ...PROTOTYPE_PARAMETERS.speed,
          bonusBands: [
            { beforeMs: 10000, points: 25 },
            { beforeMs: 5000, points: 50 },
            { beforeMs: 15000, points: 0 },
          ],
        },
      },
      { wager: { ...PROTOTYPE_PARAMETERS.wager, allowedAmounts: [25, 50] } },
      { wager: { ...PROTOTYPE_PARAMETERS.wager, allowedAmounts: [0, 25, 25] } },
      {
        pressure: {
          ...PROTOTYPE_PARAMETERS.pressure,
          policy: { status: 'confirmed', mode: 'dynamite' },
        },
      },
      { final: { ...PROTOTYPE_PARAMETERS.final, reserveQuestions: 49 } },
    ];
    for (const patch of changes)
      expect(() => freezeMatchRules(matchId, { ...PROTOTYPE_PARAMETERS, ...patch })).toThrow(
        'Configuração experimental',
      );
  });
});

describe('aritmética e variação do placar', () => {
  it('cria saldo zero, preserva entradas e explica somente o débito efetivamente possível', () => {
    const scores = board(30);
    const initial = structuredClone(scores);
    expect(credit(scores[0]!, 100, 'correct-answer')).toMatchObject({
      entry: { points: 130 },
      effect: { kind: 'credit', amount: 100 },
    });
    expect(debit(scores[0]!, 150, 'pressure')).toMatchObject({
      entry: { points: 0 },
      effect: { kind: 'debit', amount: 30 },
    });
    expect(debit(board()[0]!, 150, 'pressure').effect.amount).toBe(0);
    expect(addCorrectAnswer(scores[0]!).correctAnswers).toBe(1);
    expect(scores).toEqual(initial);
    expect(() => createScoreboard([a, a])).toThrow('invalid-input');
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'recusa quantidade inválida %s',
    (invalid) => {
      expect(() => credit(board()[0]!, invalid, 'correct-answer')).toThrow();
      expect(() => debit(board()[0]!, invalid, 'pressure')).toThrow();
      expect(() => transferPoints(board(100, 100), a, b, invalid)).toThrow();
    },
  );

  it('falha antes de devolver saldo/correção não seguros e mantém a transferência atômica', () => {
    const scores = board(1, Number.MAX_SAFE_INTEGER);
    const initial = structuredClone(scores);
    expect(() => transferPoints(scores, a, b, 1)).toThrow('overflow');
    expect(scores).toEqual(initial);
    expect(() => credit(scores[1]!, 1, 'correct-answer')).toThrow('overflow');
    expect(() =>
      addCorrectAnswer({ ...scores[0]!, correctAnswers: Number.MAX_SAFE_INTEGER }),
    ).toThrow('overflow');
  });

  it('conserva pontos no roubo limitado a 30 e recusa alvo próprio/desconhecido', () => {
    const scores = board(100, 30),
      result = transferPoints(scores, b, a, 50);
    expect(result.scoreboard.map((entry) => entry.points)).toEqual([130, 0]);
    expect(result.effects.map((effect) => effect.amount)).toEqual([30, 30]);
    expect(result.scoreboard.reduce((sum, entry) => sum + entry.points, 0)).toBe(130);
    expect(() => transferPoints(scores, a, a, 50)).toThrow('invalid-target');
    expect(() => transferPoints(scores, outsider, a, 50)).toThrow('invalid-target');
    expect(transferPoints(board(100), b, a, 50).effects).toEqual([]);
  });

  it('calcula variações por identidade sem inventar desempate nem depender da ordem do placar', () => {
    const before = board(300, 40);
    const after = [
      { ...before[1]!, points: 0 },
      { ...before[0]!, points: 450, correctAnswers: 1 },
    ];
    expect(scoreboardChanges(before, after)).toEqual([
      {
        playerId: a,
        pointsBefore: 300,
        pointsAfter: 450,
        delta: 150,
        correctAnswersBefore: 0,
        correctAnswersAfter: 1,
      },
      {
        playerId: b,
        pointsBefore: 40,
        pointsAfter: 0,
        delta: -40,
        correctAnswersBefore: 0,
        correctAnswersAfter: 0,
      },
    ]);
    expect(() =>
      scoreboardChanges(before, [after[0]!, { ...after[1]!, playerId: outsider }]),
    ).toThrow('invalid-input');
  });
});

describe('resolução de perguntas no servidor', () => {
  it('clássico pontua o acerto uma vez por cálculo; erro e ausência não somam nem apagam saldo', () => {
    const before = board(200, 300),
      input: ScoringInput = { mode: 'classic', answers: [answer(a, true), answer(b, false, 2)] };
    const result = run(input, before);
    expect(result.after.map((entry) => entry.points)).toEqual([300, 300]);
    expect(result.after.map((entry) => entry.correctAnswers)).toEqual([1, 0]);
    expect(result.effects).toEqual([
      { kind: 'credit', playerId: a, amount: 100, reason: 'correct-answer' },
    ]);
    expect(run(input, before)).toEqual(result);
    expect(before).toEqual(board(200, 300));
    expect(run({ mode: 'classic', answers: [] }, before).after).toEqual(before);
  });

  it.each([
    [0, 150],
    [4999, 150],
    [5000, 125],
    [9999, 125],
    [10000, 100],
    [14999, 100],
  ])('velocidade em %s ms produz %s pontos', (elapsed, expected) => {
    const result = run({ mode: 'speed', answers: [answer(a, true, elapsed)] });
    expect(scoreOf(result.after).points).toBe(expected);
    expect(scoreOf(result.after).correctAnswers).toBe(1);
    expect(result.effects.reduce((sum, effect) => sum + effect.amount, 0)).toBe(expected);
  });

  it('erro rápido não ganha bônus e resposta exatamente no prazo ou antes da abertura é recusada', () => {
    expect(run({ mode: 'speed', answers: [answer(a, false, 2000)] }).effects).toEqual([]);
    expect(() => run({ mode: 'speed', answers: [answer(a, true, 15000)] })).toThrow(
      'invalid-window',
    );
    expect(() => run({ mode: 'speed', answers: [answer(a, true, -1)] })).toThrow('invalid-window');
    expect(() =>
      resolveQuestion(
        rules,
        board(),
        { ...context, opensAt: Number.MAX_SAFE_INTEGER },
        { mode: 'speed', answers: [] },
      ),
    ).toThrow('overflow');
  });

  it('selar aposta valida cobertura e valores oferecidos sem descontar antecipadamente', () => {
    const scores = board(500),
      initial = structuredClone(scores);
    const sealed = sealWager(rules, scores[0]!, 50);
    expect(sealed).toEqual({ playerId: a, amount: 50, pointsAtSelection: 500 });
    expect(Object.isFrozen(sealed)).toBe(true);
    expect(scores).toEqual(initial);
    expect(allowedWagerAmounts(rules, 24)).toEqual([0]);
    expect(allowedWagerAmounts(rules, 25)).toEqual([0, 25]);
    expect(() => sealWager(rules, board(25)[0]!, 50)).toThrow('invalid-wager');
    expect(() => sealWager(rules, scores[0]!, 75)).toThrow('invalid-wager');
  });

  it('aposta 50 acerta para 650 ou erra/ausenta para 450, sem dupla cobrança', () => {
    const scores = board(500),
      wager = sealWager(rules, scores[0]!, 50);
    const correct = run({ mode: 'wager', answers: [answer()], wagers: [wager] }, scores);
    expect(scoreOf(correct.after).points).toBe(650);
    expect(correct.effects).toEqual([
      { kind: 'credit', playerId: a, amount: 100, reason: 'correct-answer' },
      { kind: 'credit', playerId: a, amount: 50, reason: 'wager' },
    ]);
    for (const answers of [[answer(a, false)], []]) {
      const lost = run({ mode: 'wager', answers, wagers: [wager] }, scores);
      expect(scoreOf(lost.after).points).toBe(450);
      expect(lost.effects).toEqual([{ kind: 'debit', playerId: a, amount: 50, reason: 'wager' }]);
    }
    expect(scoreOf(run({ mode: 'wager', answers: [answer()], wagers: [] }).after).points).toBe(100);
    const allIn = board(25);
    expect(
      run({ mode: 'wager', answers: [], wagers: [sealWager(rules, allIn[0]!, 25)] }, allIn).effects,
    ).toEqual([{ kind: 'debit', playerId: a, amount: 25, reason: 'wager' }]);
  });

  it('rejeita aposta selada com saldo alterado, registro duplicado e aposta de não participante', () => {
    const wager = sealWager(rules, board(100)[0]!, 25);
    expect(() => run({ mode: 'wager', answers: [], wagers: [wager] }, board(75))).toThrow(
      'invalid-wager',
    );
    expect(() => run({ mode: 'wager', answers: [], wagers: [wager, wager] }, board(100))).toThrow(
      'invalid-wager',
    );
    expect(() =>
      run({ mode: 'wager', answers: [], wagers: [{ ...wager, playerId: outsider }] }, board(100)),
    ).toThrow('invalid-wager');
  });

  it('roubo considera o crédito do alvo antes da transferência e só o primeiro acerto rouba', () => {
    const result = run(
      { mode: 'theft', answers: [answer(a), answer(b, true, 2)], targetPlayerId: b },
      board(0, 240),
    );
    expect(result.after.map((entry) => entry.points)).toEqual([200, 240]);
    expect(result.after.map((entry) => entry.correctAnswers)).toEqual([1, 1]);
    expect(result.effects.slice(-2)).toEqual([
      { kind: 'debit', playerId: b, amount: 100, reason: 'theft' },
      { kind: 'credit', playerId: a, amount: 100, reason: 'theft' },
    ]);
    const smallTarget = run(
      { mode: 'theft', answers: [answer(a)], targetPlayerId: b },
      board(0, 30),
    );
    expect(smallTarget.after.map((entry) => entry.points)).toEqual([130, 0]);
    expect(smallTarget.effects.slice(-2).map((effect) => effect.amount)).toEqual([30, 30]);
  });

  it.each([
    [0, false, 0],
    [30, false, 30],
    [99, false, 99],
    [100, false, 100],
    [101, false, 100],
    [0, true, 100],
    [30, true, 100],
  ])('D05: saldo %i, alvo acerta=%s, transfere %i após os créditos', (balance, correct, amount) => {
    const result = run(
      { mode: 'theft', answers: [answer(a), answer(b, correct, 2)], targetPlayerId: b },
      board(0, balance),
    );
    expect(result.after.map((entry) => entry.points)).toEqual([
      100 + amount,
      balance + (correct ? 100 : 0) - amount,
    ]);
    expect(result.after.reduce((total, entry) => total + entry.points, 0)).toBe(
      balance + 100 + (correct ? 100 : 0),
    );
    expect(result.after.every((entry) => entry.points >= 0)).toBe(true);
    expect(
      result.effects.filter((effect) => effect.reason === 'theft').map((effect) => effect.amount),
    ).toEqual(amount ? [amount, amount] : []);
  });

  it('erro mais rápido não bloqueia o roubo e empate de timestamp usa a ordem dos recibos, não a do placar', () => {
    const result = run(
      { mode: 'theft', answers: [answer(b, false), answer(a, true, 2)], targetPlayerId: b },
      board(0, 30),
    );
    expect(scoreOf(result.after).points).toBe(130);
    const tied = run(
      { mode: 'theft', answers: [answer(b), answer(a)], targetPlayerId: a },
      board(100),
    );
    expect(scoreOf(tied.after, b).points).toBe(200);
    expect(scoreOf(tied.after, a).points).toBe(100);
    expect(() => run({ mode: 'theft', answers: [answer(a)], targetPlayerId: a })).toThrow(
      'invalid-target',
    );
    expect(() => run({ mode: 'theft', answers: [answer(a, false)], targetPlayerId: b })).toThrow(
      'invalid-target',
    );
    expect(
      scoreOf(run({ mode: 'theft', answers: [answer(a)], targetPlayerId: null }).after).points,
    ).toBe(100);
  });

  it('dinamite concede 300, limita a penalidade ao saldo e afeta somente o dono do turno', () => {
    expect(
      scoreOf(run({ mode: 'pressure', respondentId: a, answer: answer() }, board(1000, 100)).after)
        .points,
    ).toBe(1300);
    const wrong = run(
      { mode: 'pressure', respondentId: a, answer: answer(a, false) },
      board(30, 100),
    );
    expect(wrong.after.map((entry) => entry.points)).toEqual([0, 100]);
    expect(wrong.effects).toEqual([{ kind: 'debit', playerId: a, amount: 30, reason: 'pressure' }]);
    expect(scoreOf(run({ mode: 'pressure', respondentId: a, answer: null }).after).points).toBe(0);
    expect(() => run({ mode: 'pressure', respondentId: a, answer: answer(b) })).toThrow(
      'invalid-input',
    );
    expect(() => run({ mode: 'pressure', respondentId: outsider, answer: null })).toThrow(
      'invalid-input',
    );
  });

  it('rejeita contexto de outra partida, respostas repetidas/fora de ordem e campos vindos do cliente', () => {
    expect(() =>
      resolveQuestion(
        rules,
        board(),
        { ...context, matchId: matchIdSchema.parse(uuid(999)) },
        { mode: 'classic', answers: [] },
      ),
    ).toThrow('stale-context');
    expect(() => run({ mode: 'classic', answers: [answer(), answer()] })).toThrow('invalid-input');
    expect(() => run({ mode: 'classic', answers: [answer(outsider)] })).toThrow('invalid-input');
    expect(() =>
      run({ mode: 'classic', answers: [answer(a, true, 2), answer(b, true, 1)] }),
    ).toThrow('invalid-input');
    const forged = {
      mode: 'speed',
      answers: [{ ...answer(), clientAnsweredAt: 1000 }],
    } as unknown as ScoringInput;
    expect(() => run(forged)).toThrow('invalid-input');
  });
});

describe('exemplos completos do plano', () => {
  it('compõe máximos 600/900/900/900/600 = 3900, com 26 acertos e histórico explicativo', () => {
    let scores = board();
    const records: QuestionScoreResolution[] = [];
    const apply = (input: ScoringInput) => {
      const resolved = resolveQuestion(
        rules,
        scores,
        { ...context, questionId: questionIdSchema.parse(uuid(100 + records.length)) },
        input,
      );
      records.push(resolved);
      scores = resolved.after;
    };
    const deltas: number[] = [];
    for (const mode of ['classic', 'speed', 'wager', 'theft', 'pressure'] as const) {
      const before = scoreOf(scores).points;
      if (mode === 'pressure') {
        for (const respondentId of [a, b])
          for (let i = 0; i < 2; i++) apply({ mode, respondentId, answer: answer(respondentId) });
      } else
        for (let i = 0; i < 6; i++) {
          const answers = [answer(a), answer(b, true, 2)];
          if (mode === 'wager')
            apply({ mode, answers, wagers: scores.map((entry) => sealWager(rules, entry, 50)) });
          else if (mode === 'theft') apply({ mode, answers, targetPlayerId: b });
          else apply({ mode, answers });
        }
      deltas.push(scoreOf(scores).points - before);
    }
    expect(deltas).toEqual([600, 900, 900, 1200, 600]);
    expect(scoreOf(scores)).toMatchObject({ points: 4200, correctAnswers: 26 });
    expect(scoreOf(scores, b)).toMatchObject({ points: 3000, correctAnswers: 26 });
    const history: ScoringHistory = { matchId, rules, records };
    expect(JSON.parse(JSON.stringify(history))).toEqual(history);
    for (const record of records) {
      expect(scoreboardSchema.safeParse(record.after).success).toBe(true);
      for (const effect of record.effects)
        expect(scoreEffectSchema.safeParse(effect).success).toBe(true);
      for (const change of record.changes) {
        const explained = record.effects
          .filter((effect) => effect.playerId === change.playerId)
          .reduce(
            (sum, effect) => sum + (effect.kind === 'credit' ? effect.amount : -effect.amount),
            0,
          );
        expect(explained).toBe(change.delta);
      }
    }
    records.at(-1)!.after[0]!.points = 0;
    expect(records.at(-2)!.after[0]!.points).toBe(4200);
    expect(records[0]!.before).toEqual(board());
  });

  it('reproduz a trajetória 400 → 925 → 1375 → 1875 → 2025 sem zerar o placar', () => {
    let scores = board();
    const totals: number[] = [];
    const apply = (input: ScoringInput) => {
      scores = run(input, scores).after;
    };
    for (let i = 0; i < 6; i++)
      apply({ mode: 'classic', answers: [answer(a, i < 4), answer(b, true, 2)] });
    totals.push(scoreOf(scores).points);
    for (const [i, elapsed] of [1000, 1000, 7000, 12000, 13000, 14000].entries())
      apply({ mode: 'speed', answers: [answer(b, true, 0), answer(a, i < 4, elapsed)] });
    totals.push(scoreOf(scores).points);
    for (let i = 0; i < 6; i++)
      apply({
        mode: 'wager',
        answers: [answer(a, i < 4), answer(b, true, 2)],
        wagers: [sealWager(rules, scoreOf(scores), 25)],
      });
    totals.push(scoreOf(scores).points);
    for (let i = 0; i < 6; i++)
      apply({
        mode: 'theft',
        answers: [answer(a, [0, 1, 3, 4].includes(i)), answer(b, i !== 5, 2)],
        targetPlayerId: i < 2 ? b : i === 2 ? a : null,
      });
    totals.push(scoreOf(scores).points);
    apply({ mode: 'pressure', respondentId: a, answer: answer() });
    apply({ mode: 'pressure', respondentId: a, answer: answer(a, false) });
    totals.push(scoreOf(scores).points);
    expect(totals).toEqual([400, 925, 1375, 1875, 2025]);
    expect(scoreOf(scores).correctAnswers).toBe(17);
  });
});

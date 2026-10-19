import { describe, expect, it, vi } from 'vitest';
import {
  matchIdSchema,
  playerIdSchema,
  publicQuestionSchema,
  questionIdSchema,
  roundIdSchema,
} from '@penshow/shared';
import type { RandomSource } from '../../ports.js';
import { approvedQuestionSchema } from './editorial-question.schema.js';
import type { ApprovedQuestion, PreparedQuestion } from './question.js';
import type { QuestionRepository } from './question.repository.js';
import { canonicalQuestions, phaseAllocation, stockOf } from './question-pool.domain.js';
import { QuestionSelection } from './question-selection.js';
import {
  phaseDemand,
  SELECTION_PROPOSAL,
  type SelectionFormat,
  type SelectionMode,
} from './selection-policy.js';
import { advanceChoiceQueue, choiceQueue, nextChooser } from './theme-queue.domain.js';
import {
  freezeMatchRules,
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from '../scoring/match-rules.js';
import { createScoreboard, resolveQuestion } from '../scoring/scoring.domain.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const players = (count = 2) =>
  Array.from({ length: count }, (_, i) => playerIdSchema.parse(uuid(i + 1)));
const roundId = (n = 1) => roundIdSchema.parse(uuid(1000 + n));
const matchId = matchIdSchema.parse(uuid(2000));
function dependencies(seed = 1234) {
  let next = 10_000;
  let state = seed;
  return {
    ids: { next: vi.fn(() => uuid(next++)) },
    random: {
      integer: vi.fn((max: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % max;
      }),
    },
  };
}
function batch(category: string, easy = 6, medium = 4, hard = 2): ApprovedQuestion[] {
  return Object.entries({ easy, medium, hard }).flatMap(([difficulty, count]) =>
    Array.from({ length: count }, (_, i) =>
      approvedQuestionSchema.parse({
        id: `fixture:${category}:${difficulty}:${i}`,
        category,
        difficulty,
        status: 'approved',
        locale: 'pt-BR',
        type: 'multiple',
        prompt: `Pergunta sintética ${category} ${difficulty} ${i}?`,
        options: ['Alfa', 'Beta', 'Gama', 'Delta'].map((text, index) => ({
          id: `option-${index}`,
          text,
        })),
        correctOptionId: 'option-0',
        explanation: 'Explicação privada para teste.',
        source: {
          id: 'fixture',
          url: 'https://example.test/source',
          recordIndex: i,
          license: 'MIT',
        },
        review: {
          referenceUrl: 'https://example.test/fact',
          reviewedAt: '2026-10-19',
          checks: { factual: true, language: true, uniqueAnswer: true },
        },
      }),
    ),
  );
}
function repository(questions: ApprovedQuestion[]): QuestionRepository {
  return {
    list: vi.fn(() => structuredClone(questions)),
    availability: () => {
      throw new Error('Use o estoque real, não o resumo.');
    },
  };
}
function options(
  questions: ApprovedQuestion[],
  format: SelectionFormat = 'classic-prototype',
  count = 2,
) {
  return {
    matchId,
    players: players(count),
    format,
    enabledCategories: [...new Set(questions.map((q) => q.category))],
  };
}
function ready(
  questions: ApprovedQuestion[],
  format: SelectionFormat = 'classic-prototype',
  count = 2,
  seed = 1234,
) {
  const deps = dependencies(seed);
  const repo = repository(questions);
  const result = QuestionSelection.create(repo, deps, options(questions, format, count));
  if (result.status !== 'ready') throw new Error(result.message);
  return { selection: result.selection, deps, repo };
}
function open(selection: QuestionSelection, n = 1, mode: SelectionMode = 'classic', now = 1000) {
  const view = selection.openRound(roundId(n), mode, now);
  if (view.status !== 'choosing') throw new Error('Esperada escolha de tema.');
  return view;
}
function drain(selection: QuestionSelection, n = 1): PreparedQuestion[] {
  const result: PreparedQuestion[] = [];
  for (;;) {
    const current = selection.currentQuestion(roundId(n));
    if (!current) return result;
    result.push(current);
    selection.advanceQuestion(roundId(n), current.publicQuestion.questionId);
  }
}
function scoringPhases(selection: QuestionSelection) {
  const shown: PreparedQuestion[] = [];
  const choosers = [];
  for (const [i, mode] of SELECTION_PROPOSAL.modes.entries()) {
    const view = open(selection, i + 1, mode);
    choosers.push(view.chooserPlayerId);
    selection.chooseCategory(view.roundId, view.chooserPlayerId, view.categories[0]!, 1000);
    shown.push(...drain(selection, i + 1));
  }
  return { shown, choosers };
}

describe('seleção privada de perguntas', () => {
  it('usa a mesma configuração congelada para estoque, prazo, opções e crédito por acerto', () => {
    const data = ['geography', 'history', 'arts'].flatMap((category) => batch(category));
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.classic.questions = { easy: 1, medium: 1, hard: 0 };
    parameters.classic.correctPoints = 175;
    parameters.timings.categoryChoiceMs = 7000;
    parameters.selection.maximumCategoryOptions = 2;
    const rules = freezeMatchRules(matchId, parameters);
    const config = { ...options(data), rules };
    const start = QuestionSelection.create(repository(data), dependencies(), config);
    if (start.status !== 'ready') throw new Error();
    const selection = start.selection;
    const view = open(selection);
    expect(view.categories).toHaveLength(2);
    expect(view.deadlineAt).toBe(8000);
    selection.chooseCategory(view.roundId, view.chooserPlayerId, view.categories[0]!, 1000);
    const questions = drain(selection);
    expect(questions).toHaveLength(2);
    let scoreboard = createScoreboard(config.players);
    for (const question of questions)
      scoreboard = resolveQuestion(
        rules,
        scoreboard,
        {
          matchId,
          roundId: view.roundId,
          questionId: question.publicQuestion.questionId,
          opensAt: 1000,
        },
        {
          mode: 'classic',
          answers: [{ playerId: config.players[0]!, correct: true, receivedAt: 1001 }],
        },
      ).after;
    expect(scoreboard[0]!.points).toBe(350);
    expect(SELECTION_PROPOSAL.demands.classic).toEqual({ easy: 3, medium: 3, hard: 0 });
    expect(() =>
      QuestionSelection.create(repository(data), dependencies(), {
        ...config,
        categoryChoiceMs: 10000,
      }),
    ).toThrow('invalid-config');
    expect(() =>
      QuestionSelection.create(repository(data), dependencies(), {
        ...config,
        matchId: matchIdSchema.parse(uuid(3333)),
      }),
    ).toThrow('invalid-config');
  });

  it('oferece só a mistura correta, até quatro temas, sem contar dificuldade substituta', () => {
    const data = ['arts', 'geography', 'history', 'sports', 'science'].flatMap((c) => batch(c));
    data.push(...batch('insufficient', 20, 2, 20));
    const { selection } = ready(data);
    const view = open(selection);
    expect(view.categories).toHaveLength(4);
    expect(new Set(view.categories).size).toBe(4);
    expect(view.categories).not.toContain('insufficient');
    selection.chooseCategory(view.roundId, view.chooserPlayerId, view.categories[0]!, 1000);
    const questions = drain(selection);
    expect(questions).toHaveLength(6);
    expect(questions.filter((q) => q.publicQuestion.difficulty === 'easy')).toHaveLength(3);
    expect(questions.filter((q) => q.publicQuestion.difficulty === 'medium')).toHaveLength(3);
    expect(selection.history()).toHaveLength(6);
  });

  it('admite menos de quatro temas e bloqueia mistura incompleta apesar de muitos registros', () => {
    const { selection } = ready(batch('geography'));
    expect(open(selection).categories).toEqual(['geography']);
    const data = batch('geography', 100, 2, 100);
    expect(QuestionSelection.create(repository(data), dependencies(), options(data))).toMatchObject(
      { status: 'blocked', reason: 'insufficient-content' },
    );
  });

  it('filtra temas habilitados e mantém um snapshot local do catálogo, sem nova leitura', () => {
    const data = [...batch('geography'), ...batch('history')];
    const deps = dependencies();
    const repo = repository(data);
    const config = { ...options(data), enabledCategories: ['geography'] };
    const start = QuestionSelection.create(repo, deps, config);
    if (start.status !== 'ready') throw new Error();
    config.enabledCategories[0] = 'history';
    data.splice(0);
    const view = open(start.selection);
    expect(view.categories).toEqual(['geography']);
    start.selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    expect(drain(start.selection)).toHaveLength(6);
    expect(repo.list).toHaveBeenCalledTimes(1);
  });

  it('usa RNG injetado com resultado reproduzível mesmo se a ordem de entrada mudar', () => {
    const data = ['arts', 'geography', 'history', 'sports', 'science'].flatMap((c) => batch(c));
    const a = ready(data, 'classic-prototype', 2, 42);
    const b = ready([...data].reverse(), 'classic-prototype', 2, 42);
    const av = open(a.selection),
      bv = open(b.selection);
    expect(av).toEqual(bv);
    a.selection.chooseCategory(av.roundId, av.chooserPlayerId, av.categories[0]!, 1000);
    b.selection.chooseCategory(bv.roundId, bv.chooserPlayerId, bv.categories[0]!, 1000);
    expect(drain(a.selection)).toEqual(drain(b.selection));
    const c = ready(data, 'classic-prototype', 2, 57);
    expect(open(c.selection)).not.toEqual(av);
  });

  it('reabrir fase e consultar pergunta preserva enunciado, IDs, alternativas e prazo', () => {
    const { selection, deps } = ready(batch('geography'));
    const view = open(selection);
    const calls = deps.random.integer.mock.calls.length;
    expect(selection.openRound(view.roundId, 'classic', 5000)).toEqual(view);
    expect(deps.random.integer).toHaveBeenCalledTimes(calls);
    selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    const current = selection.currentQuestion(view.roundId)!;
    const generated = deps.ids.next.mock.calls.length;
    const draws = deps.random.integer.mock.calls.length;
    expect(selection.currentQuestion(view.roundId)).toEqual(current);
    expect(selection.openRound(view.roundId, 'classic', 99999).status).toBe('selected');
    expect(deps.ids.next).toHaveBeenCalledTimes(generated);
    expect(deps.random.integer).toHaveBeenCalledTimes(draws);
    current.publicQuestion.options[0]!.text = 'Alteração externa';
    (current.editorialOptionByPublicId as unknown as Map<string, string>).clear();
    expect(selection.currentQuestion(view.roundId)!.publicQuestion.options[0]!.text).not.toBe(
      'Alteração externa',
    );
    expect(selection.currentQuestion(view.roundId)!.editorialOptionByPublicId.size).toBe(4);
  });

  it('embaralha e prepara IDs opacos sem expor fonte, resposta, explicação ou IDs editoriais', () => {
    const data = batch('geography');
    const { selection } = ready(data);
    const view = open(selection);
    selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    const prepared = selection.currentQuestion(view.roundId)!;
    expect(publicQuestionSchema.safeParse(prepared.publicQuestion).success).toBe(true);
    expect(
      prepared.publicQuestion.options.find((o) => o.optionId === prepared.correctOptionId)?.text,
    ).toBe('Alfa');
    expect(prepared.editorialOptionByPublicId.get(prepared.correctOptionId)).toBe('option-0');
    const text = JSON.stringify(prepared.publicQuestion);
    for (const secret of [
      'correctOptionId',
      'editorialQuestionId',
      'source',
      'review',
      'Explicação privada',
      prepared.editorialQuestionId,
      'option-0',
    ])
      expect(text).not.toContain(secret);
    const all = drain(selection);
    expect(all.some((q) => q.publicQuestion.options[0]!.text !== 'Alfa')).toBe(true);
    const ids = all.flatMap((q) => [
      q.publicQuestion.questionId,
      ...q.publicQuestion.options.map((o) => o.optionId),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não completa o orçamento de quatro alternativas com perguntas booleanas', () => {
    const data = batch('geography');
    for (const q of data) {
      q.type = 'boolean';
      q.options = [
        { id: 'yes', text: 'Verdadeiro' },
        { id: 'no', text: 'Falso' },
      ];
      q.correctOptionId = 'no';
    }
    expect(QuestionSelection.create(repository(data), dependencies(), options(data))).toMatchObject(
      { status: 'blocked' },
    );
    const mixed = ready([
      ...batch('geography'),
      ...data.map((q) => ({ ...q, id: `boolean:${q.id}` })),
    ]);
    const view = open(mixed.selection);
    mixed.selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    expect(drain(mixed.selection).every((q) => q.publicQuestion.type === 'multiple')).toBe(true);
  });

  it('reenvio não avança a fila duas vezes e avanço repetido não pula a pergunta seguinte', () => {
    const { selection } = ready(batch('geography'));
    const view = open(selection);
    const chosen = selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    const queue = selection.choiceQueueForRematch();
    expect(
      selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 99999),
    ).toEqual(chosen);
    expect(selection.choiceQueueForRematch()).toEqual(queue);
    const first = selection.currentQuestion(view.roundId)!;
    const result = selection.advanceQuestion(view.roundId, first.publicQuestion.questionId);
    expect(selection.advanceQuestion(view.roundId, first.publicQuestion.questionId)).toEqual(
      result,
    );
    const second = selection.currentQuestion(view.roundId)!;
    selection.advanceQuestion(view.roundId, first.publicQuestion.questionId);
    expect(selection.currentQuestion(view.roundId)).toEqual(second);
    expect(selection.history()).toHaveLength(2);
    drain(selection);
    expect(selection.openRound(view.roundId, 'classic', 1000).status).toBe('complete');
    expect(selection.currentQuestion(view.roundId)).toBeNull();
  });

  it('rejeita jogador/tema/contexto inválidos e não abre outra fase antes de concluir a atual', () => {
    const { selection } = ready(batch('geography'));
    const view = open(selection);
    const other = players().find((id) => id !== view.chooserPlayerId)!;
    const queue = selection.choiceQueueForRematch();
    expect(() => selection.chooseCategory(view.roundId, other, 'geography', 1000)).toThrow(
      'forbidden',
    );
    expect(() =>
      selection.chooseCategory(view.roundId, view.chooserPlayerId, 'history', 1000),
    ).toThrow('invalid-category');
    expect(() =>
      selection.chooseCategory(roundId(99), view.chooserPlayerId, 'geography', 1000),
    ).toThrow('stale-context');
    expect(() => selection.openRound(roundId(2), 'speed', 1000)).toThrow('invalid-state');
    expect(() => selection.openRound(view.roundId, 'speed', 1000)).toThrow('stale-context');
    expect(() => selection.currentQuestion(view.roundId)).toThrow('invalid-state');
    expect(() =>
      selection.advanceQuestion(view.roundId, questionIdSchema.parse(uuid(9999))),
    ).toThrow('stale-context');
    expect(selection.choiceQueueForRematch()).toEqual(queue);
    expect(selection.history()).toEqual([]);
  });

  it('prazo exato recusa escolha e sorteia apenas entre os temas oferecidos, uma única vez', () => {
    const { selection, deps } = ready([...batch('geography'), ...batch('history')]);
    const view = open(selection);
    expect(selection.expireCategoryChoice(view.roundId, view.deadlineAt - 1)).toEqual({
      status: 'ignored',
    });
    expect(() =>
      selection.chooseCategory(
        view.roundId,
        view.chooserPlayerId,
        view.categories[0]!,
        view.deadlineAt,
      ),
    ).toThrow('deadline-expired');
    const expired = selection.expireCategoryChoice(view.roundId, view.deadlineAt);
    expect(expired).toMatchObject({
      status: 'selected',
      selectedBy: 'timeout',
      category: expect.stringMatching(/^(geography|history)$/u),
    });
    const draws = deps.random.integer.mock.calls.length;
    expect(selection.expireCategoryChoice(view.roundId, view.deadlineAt + 1)).toEqual({
      status: 'ignored',
    });
    expect(selection.expireCategoryChoice(roundId(99), view.deadlineAt)).toEqual({
      status: 'ignored',
    });
    expect(deps.random.integer).toHaveBeenCalledTimes(draws);
  });

  it('aceita escolha imediatamente antes do prazo', () => {
    const { selection } = ready(batch('geography'));
    const view = open(selection);
    expect(
      selection.chooseCategory(
        view.roundId,
        view.chooserPlayerId,
        'geography',
        view.deadlineAt - 1,
      ),
    ).toMatchObject({ selectedBy: 'player' });
  });

  it('deduplica paráfrases editoriais e grafias normalizadas antes de contar estoque', () => {
    const data = batch('geography', 2, 3, 0);
    const copy = structuredClone(data[0]!);
    copy.id = 'zz:duplicate';
    copy.prompt = `  ${copy.prompt.toUpperCase().replace('?', '!!!')}  `;
    expect(
      QuestionSelection.create(repository([...data, copy]), dependencies(), options(data)),
    ).toMatchObject({ status: 'blocked' });
    copy.prompt = 'Outra forma de perguntar exatamente o mesmo fato?';
    const config = { ...options(data), equivalentQuestionIds: [[data[0]!.id, copy.id]] };
    expect(
      QuestionSelection.create(repository([...data, copy]), dependencies(), config),
    ).toMatchObject({ status: 'blocked' });
  });

  it('fecha grupos transitivos entre fontes/temas, com representante estável e estoque conservador', () => {
    const [a, b, c] = batch('geography', 3, 0, 0) as [
      ApprovedQuestion,
      ApprovedQuestion,
      ApprovedQuestion,
    ];
    a.id = 'a';
    b.id = 'b';
    c.id = 'c';
    b.prompt = a.prompt;
    c.category = 'history';
    c.difficulty = 'hard';
    expect(canonicalQuestions([c, b, a], [['b', 'c']])).toEqual([a]);
    expect(stockOf(canonicalQuestions([a, b, c], [['c', 'b']]))).toEqual({
      geography: { easy: 1, medium: 0, hard: 0 },
    });
    expect(() => canonicalQuestions([a], [['a', 'unknown']])).toThrow('invalid-catalog');
    expect(() => canonicalQuestions([a, a], [])).toThrow('invalid-catalog');
  });

  it('recusa conteúdo sem revisão/idioma, configuração inválida e portas de sorteio/IDs inválidas', () => {
    const data = batch('geography');
    const invalid = { ...data[0]!, status: 'needs-review' } as unknown as ApprovedQuestion;
    expect(() => ready([invalid, ...data.slice(1)])).toThrow('invalid-catalog');
    expect(() =>
      ready([{ ...data[0]!, locale: 'en' } as unknown as ApprovedQuestion, ...data.slice(1)]),
    ).toThrow('invalid-catalog');
    expect(() => ready(data, 'classic-prototype', 13)).toThrow('invalid-config');
    expect(() =>
      QuestionSelection.create(repository(data), dependencies(), {
        ...options(data),
        players: [players()[0]!, players()[0]!],
      }),
    ).toThrow('invalid-config');
    expect(() =>
      QuestionSelection.create(repository(data), dependencies(), {
        ...options(data),
        categoryChoiceMs: 0,
      }),
    ).toThrow('invalid-config');
    const deps = dependencies();
    deps.random.integer.mockImplementation((max) => max);
    expect(() => QuestionSelection.create(repository(data), deps, options(data))).toThrow(
      'invalid-random',
    );
    const { selection, deps: invalidIds } = ready(data);
    const view = open(selection);
    selection.chooseCategory(view.roundId, view.chooserPlayerId, 'geography', 1000);
    invalidIds.ids.next.mockReturnValue(uuid(7000));
    expect(() => selection.currentQuestion(view.roundId)).toThrow('invalid-id');
    expect(selection.history()).toEqual([]);
  });

  it('trata slugs iguais a nomes herdados de Object sem corromper o estoque', () => {
    const { selection } = ready(batch('constructor'));
    expect(open(selection).categories).toEqual(['constructor']);
  });
});

describe('formato completo, reserva e final', () => {
  it('adapta reserva e ordem dos ciclos da dinamite aos parâmetros sem alterar o padrão', () => {
    const data = batch('geography', 14, 17, 7);
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.final.reserveQuestions = 10;
    parameters.pressure.turnDifficulties = ['hard', 'medium'];
    const start = QuestionSelection.create(repository(data), dependencies(), {
      ...options(data, 'full-prototype'),
      rules: freezeMatchRules(matchId, parameters),
    });
    if (start.status !== 'ready') throw new Error();
    const selection = start.selection;
    const shown = scoringPhases(selection).shown;
    expect(shown.slice(24).map((q) => q.publicQuestion.difficulty)).toEqual([
      'hard',
      'hard',
      'medium',
      'medium',
    ]);
    expect(selection.availability().finalReserve.geography).toEqual({
      easy: 5,
      medium: 5,
      hard: 0,
    });
    expect(SELECTION_PROPOSAL.finalReserve).toEqual({ easy: 25, medium: 25, hard: 0 });
    selection.startFinal(roundId(6));
    for (let i = 0; i < 10; i++) {
      const question = selection.currentFinalQuestion(roundId(6));
      if (!('publicQuestion' in question)) throw new Error();
      expect(question.publicQuestion.difficulty).toBe(i % 2 ? 'medium' : 'easy');
      selection.advanceFinalQuestion(roundId(6), question.publicQuestion.questionId);
    }
    expect(selection.currentFinalQuestion(roundId(6))).toMatchObject({ status: 'interrupted' });
  });

  it('não aprova formato completo só porque existe um total alto ou um clássico viável', () => {
    const initial = ['geography', 'history', 'sports', 'arts', 'science', 'pop'].flatMap((c) =>
      batch(c),
    );
    expect(
      QuestionSelection.create(
        repository(initial),
        dependencies(),
        options(initial, 'full-prototype'),
      ),
    ).toMatchObject({ status: 'blocked' });
    const noPressureCategory = ['geography', 'history', 'sports'].flatMap((c) =>
      batch(c, 100, 100, 1),
    );
    expect(
      QuestionSelection.create(
        repository(noPressureCategory),
        dependencies(),
        options(noPressureCategory, 'full-prototype', 2),
      ),
    ).toMatchObject({ status: 'blocked' });
  });

  it('reserva exatamente 50 sem consumo anterior, não repete nas fases e interrompe sem vencedor ao acabar', () => {
    const data = batch('geography', 34, 37, 7);
    const { selection } = ready(data, 'full-prototype');
    expect(selection.availability().finalReserve).toEqual({
      geography: { easy: 25, medium: 25, hard: 0 },
    });
    expect(() => selection.startFinal(roundId(6))).toThrow('invalid-state');
    const before = scoringPhases(selection).shown;
    expect(before).toHaveLength(28);
    expect(new Set(before.map((q) => q.editorialQuestionId)).size).toBe(28);
    expect(selection.availability().finalReserve.geography).toEqual({
      easy: 25,
      medium: 25,
      hard: 0,
    });
    expect(selection.availability().regular).toEqual({});
    selection.startFinal(roundId(6));
    const final: PreparedQuestion[] = [];
    for (let i = 0; i < 50; i++) {
      const question = selection.currentFinalQuestion(roundId(6));
      if (!('publicQuestion' in question)) throw new Error();
      expect(question.publicQuestion.difficulty).toBe(i % 2 ? 'medium' : 'easy');
      expect(before.some((q) => q.editorialQuestionId === question.editorialQuestionId)).toBe(
        false,
      );
      final.push(question);
      selection.advanceFinalQuestion(roundId(6), question.publicQuestion.questionId);
    }
    expect(selection.availability().finalReserve).toEqual({});
    expect(new Set(selection.history()).size).toBe(78);
    const stopped = selection.currentFinalQuestion(roundId(6));
    expect(stopped).toMatchObject({
      status: 'interrupted',
      reason: 'content-exhausted',
      returnToLobby: true,
    });
    expect(stopped).not.toHaveProperty('winner');
    expect(selection.status()).toEqual(stopped);
    expect(selection.currentFinalQuestion(roundId(6))).toEqual(stopped);
    expect(final).toHaveLength(50);
  });

  it('considera dois turnos por pessoa, com ciclo médio seguido de difícil, inclusive doze jogadores', () => {
    expect(phaseDemand('pressure', 12)).toEqual({ easy: 0, medium: 12, hard: 12 });
    const { selection } = ready(batch('geography', 34, 47, 17), 'full-prototype', 12);
    const shown = scoringPhases(selection).shown;
    expect(shown).toHaveLength(48);
    expect(shown.slice(24, 36).every((q) => q.publicQuestion.difficulty === 'medium')).toBe(true);
    expect(shown.slice(36).every((q) => q.publicQuestion.difficulty === 'hard')).toBe(true);
    expect(selection.availability().finalReserve.geography).toEqual({
      easy: 25,
      medium: 25,
      hard: 0,
    });
  });

  it('busca inéditas depois da reserva e mantém pergunta atual estável e avanço idempotente na final', () => {
    const { selection, deps } = ready(batch('geography', 35, 38, 8), 'full-prototype');
    scoringPhases(selection);
    selection.startFinal(roundId(6));
    let first: PreparedQuestion | undefined;
    for (let i = 0; i < 52; i++) {
      const q = selection.currentFinalQuestion(roundId(6));
      if (!('publicQuestion' in q)) throw new Error();
      if (!first) first = q;
      const draws = deps.random.integer.mock.calls.length;
      const generated = deps.ids.next.mock.calls.length;
      expect(selection.currentFinalQuestion(roundId(6))).toEqual(q);
      expect(selection.startFinal(roundId(6))).toEqual({ status: 'ready', roundId: roundId(6) });
      expect(deps.random.integer).toHaveBeenCalledTimes(draws);
      expect(deps.ids.next).toHaveBeenCalledTimes(generated);
      if (i) selection.advanceFinalQuestion(roundId(6), first.publicQuestion.questionId);
      expect(selection.currentFinalQuestion(roundId(6))).toEqual(q);
      selection.advanceFinalQuestion(roundId(6), q.publicQuestion.questionId);
    }
    expect(selection.history()).toHaveLength(80);
    // There is still a hard question; the final cannot silently switch difficulty.
    expect(selection.availability().regular.geography?.hard).toBe(1);
    expect(selection.currentFinalQuestion(roundId(6))).toMatchObject({ status: 'interrupted' });
  });

  it('alterna temas na final e distribui a reserva quando o estoque permite ciclos completos', () => {
    const { selection } = ready(
      ['geography', 'history', 'sports', 'arts', 'science'].flatMap((c) => batch(c, 30, 35, 10)),
      'full-prototype',
    );
    const counts = Object.values(selection.availability().finalReserve).map(
      (c) => c.easy + c.medium,
    );
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(50);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    scoringPhases(selection);
    selection.startFinal(roundId(6));
    const categories: string[] = [];
    for (let i = 0; i < 20; i++) {
      const q = selection.currentFinalQuestion(roundId(6));
      if (!('publicQuestion' in q)) throw new Error();
      categories.push(q.publicQuestion.category);
      selection.advanceFinalQuestion(roundId(6), q.publicQuestion.questionId);
    }
    for (let i = 0; i < 20; i += 5) expect(new Set(categories.slice(i, i + 5)).size).toBe(5);
  });

  it('evita o tema anterior quando outro é viável e rejeita callbacks de fases antigas', () => {
    const { selection } = ready(
      [...batch('geography', 40, 40, 20), ...batch('history', 40, 40, 20)],
      'full-prototype',
    );
    const first = open(selection);
    const category = first.categories[0]!;
    selection.chooseCategory(first.roundId, first.chooserPlayerId, category, 1000);
    drain(selection);
    const second = open(selection, 2, 'speed');
    expect(second.categories).not.toContain(category);
    expect(selection.expireCategoryChoice(first.roundId, 99999)).toEqual({ status: 'ignored' });
    expect(selection.openRound(first.roundId, 'classic', 99999).status).toBe('complete');
    expect(() => selection.currentQuestion(first.roundId)).toThrow('stale-context');
  });

  it('não oferece tema que deixaria a dinamite sem estoque futuro, mesmo que a fase atual caiba', () => {
    const data = [...batch('scarce', 40, 4, 4), ...batch('other', 40, 35, 5)];
    const { selection } = ready(data, 'full-prototype', 4);
    const scarce = selection.availability().regular.scarce!;
    expect(scarce.easy).toBeGreaterThanOrEqual(3);
    expect(scarce.medium).toBeGreaterThanOrEqual(3);
    expect(open(selection).categories).toEqual(['other']);
    expect(scoringPhases(selection).shown).toHaveLength(32);
  });

  it('confere a busca de estoque contra enumeração completa de distribuições pequenas', () => {
    const demands = [
      { easy: 1, medium: 1, hard: 0 },
      { easy: 0, medium: 1, hard: 1 },
      { easy: 2, medium: 0, hard: 0 },
    ];
    const reserve = { easy: 1, medium: 1, hard: 0 };
    const rng = dependencies(15).random;
    const outcomes = new Set<boolean>();
    for (let sample = 0; sample < 150; sample++) {
      const stock = {
        a: { easy: rng.integer(6), medium: rng.integer(5), hard: rng.integer(3) },
        b: { easy: rng.integer(6), medium: rng.integer(5), hard: rng.integer(3) },
      };
      // Eight possible assignments, assessed by their total consumption per bucket.
      const expected = Array.from({ length: 8 }, (_, mask) => {
        const consumed = [
          { easy: 0, medium: 0, hard: 0 },
          { easy: 0, medium: 0, hard: 0 },
        ];
        demands.forEach((demand, index) => {
          const target = consumed[(mask >> index) & 1]!;
          for (const difficulty of ['easy', 'medium', 'hard'] as const)
            target[difficulty] += demand[difficulty];
        });
        return (['easy', 'medium', 'hard'] as const).every(
          (difficulty) =>
            consumed[0]![difficulty] <= stock.a[difficulty] &&
            consumed[1]![difficulty] <= stock.b[difficulty] &&
            stock.a[difficulty] +
              stock.b[difficulty] -
              consumed[0]![difficulty] -
              consumed[1]![difficulty] >=
              reserve[difficulty],
        );
      }).some(Boolean);
      outcomes.add(expected);
      expect(phaseAllocation(stock, demands, reserve) !== null).toBe(expected);
    }
    expect(outcomes.size).toBe(2);
  });
});

describe('fila de escolha de temas', () => {
  it('continua na revanche com mais de cinco pessoas e não usa ordem de entrada', () => {
    const data = batch('geography', 34, 43, 13);
    const { selection, deps } = ready(data, 'full-prototype', 8);
    const initialQueue = selection.choiceQueueForRematch();
    const first = scoringPhases(selection).choosers;
    expect(new Set(first).size).toBe(5);
    expect(first).toEqual(initialQueue.pending.slice(0, 5));
    const previous = selection.choiceQueueForRematch();
    expect(previous.pending).toHaveLength(3);
    const rematch = QuestionSelection.create(repository(data), deps, {
      ...options(data, 'full-prototype', 8),
      matchId: matchIdSchema.parse(uuid(2001)),
      previousChoiceQueue: previous,
    });
    if (rematch.status !== 'ready') throw new Error();
    const second = scoringPhases(rematch.selection).choosers;
    expect(new Set([...first, ...second.slice(0, 3)]).size).toBe(8);
    expect(second.slice(0, 3)).toEqual(previous.pending);
    const random: RandomSource = { integer: (max) => max - 1 };
    expect(choiceQueue(players(8), random)).toEqual(choiceQueue([...players(8)].reverse(), random));
  });

  it('remove quem saiu e insere recém-chegados antes de repetir os já atendidos', () => {
    const random: RandomSource = { integer: () => 0 };
    let queue = choiceQueue(players(3), random);
    const first = nextChooser(queue);
    queue = advanceChoiceQueue(queue);
    const roster = [...players(3).filter((id) => id !== queue.pending[0]), players(4)[3]!];
    const reconciled = choiceQueue(roster, random, queue);
    expect(reconciled.pending).not.toContain(first);
    expect(reconciled.pending).toContain(players(4)[3]);
    expect(reconciled.served).toContain(first);
    const copy = structuredClone(reconciled);
    advanceChoiceQueue(reconciled);
    expect(reconciled).toEqual(copy);
  });
});

import assert from 'node:assert/strict';
import type { ScoringMode } from '../../packages/shared/src/schemas/settings.js';
import {
  matchIdSchema,
  playerIdSchema,
  roundIdSchema,
} from '../../packages/shared/src/schemas/identifiers.js';
import { QuestionSelection } from '../../apps/server/src/modules/questions/question-selection.js';
import type { QuestionRepository } from '../../apps/server/src/modules/questions/question.repository.js';
import type {
  ApprovedQuestion,
  PreparedQuestion,
} from '../../apps/server/src/modules/questions/question.js';
import { normalizeQuestionText } from '../../apps/server/src/modules/questions/editorial-question.schema.js';
import {
  stockOf,
  type Stock,
} from '../../apps/server/src/modules/questions/question-pool.domain.js';
import {
  demandSize,
  phaseDemand,
  selectionPolicy,
} from '../../apps/server/src/modules/questions/selection-policy.js';
import {
  freezeMatchRules,
  PROTOTYPE_PARAMETERS,
  type DeepReadonly,
  type PrototypeParameters,
} from '../../apps/server/src/modules/scoring/match-rules.js';
import { sha256 } from '../../apps/server/src/modules/questions/catalog-format.js';

export const STOCK_SEEDS = [27, 20261020] as const;
export const STOCK_CHOICES = ['first', 'last', 'timeout'] as const;
type Choice = (typeof STOCK_CHOICES)[number];
const uuid = (n: number) => `27000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function stockDependencies(seed: number) {
  let serial = 10000;
  let state = seed >>> 0;
  return {
    ids: { next: () => uuid(serial++) },
    random: {
      integer(max: number) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % max;
      },
    },
  };
}
export function stockOptions(
  playerCount: number,
  enabledCategories: string[],
  parameters: DeepReadonly<PrototypeParameters> = PROTOTYPE_PARAMETERS,
) {
  const matchId = matchIdSchema.parse(uuid(1));
  return {
    matchId,
    players: Array.from({ length: playerCount }, (_, i) => playerIdSchema.parse(uuid(i + 100))),
    enabledCategories,
    format: 'full-prototype' as const,
    rules: freezeMatchRules(matchId, parameters),
  };
}
const total = (stock: Stock) => Object.values(stock).reduce((sum, row) => sum + demandSize(row), 0);

/** Exercise the real selector against published content, including reserve and exhaustion. */
export function simulateQuestionStock(
  repository: QuestionRepository,
  playerCount: number,
  seed: number,
  choice: Choice,
  modes?: readonly ScoringMode[],
) {
  const questions = repository.list();
  const categories = [...new Set(questions.map((q) => q.category))].sort();
  const policy = selectionPolicy(PROTOTYPE_PARAMETERS);
  const start = QuestionSelection.create(repository, stockDependencies(seed), {
    ...stockOptions(playerCount, categories),
    ...(modes ? { format: 'classic', modes } : {}),
  });
  assert.equal(start.status, 'ready', `${playerCount} pessoas: estoque insuficiente`);
  const selection = start.selection;
  const afterReserve = selection.availability();
  assert.equal(total(afterReserve.finalReserve), 50);
  assert.equal(total(afterReserve.regular), questions.length - 50);
  const editorialIds = new Set<string>();
  const publicIds = new Set<string>();
  const prompts = new Set<string>();
  const used: string[] = [];
  function record(question: PreparedQuestion) {
    assert.ok(!editorialIds.has(question.editorialQuestionId), 'Repetição de ID editorial');
    assert.ok(!publicIds.has(question.publicQuestion.questionId), 'Repetição de ID público');
    const key = normalizeQuestionText(question.publicQuestion.prompt);
    assert.ok(!prompts.has(key), 'Repetição de enunciado');
    editorialIds.add(question.editorialQuestionId);
    publicIds.add(question.publicQuestion.questionId);
    prompts.add(key);
    used.push(question.editorialQuestionId);
  }
  const phases = (modes ?? policy.modes).map((mode, index) => {
    const roundId = roundIdSchema.parse(uuid(index + 1000));
    const offer = selection.openRound(roundId, mode, 1000);
    assert.equal(offer.status, 'choosing');
    if (offer.status !== 'choosing') throw new Error('Fase sem temas');
    assert.ok(offer.categories.length > 0);
    const selected =
      choice === 'timeout'
        ? selection.expireCategoryChoice(roundId, offer.deadlineAt)
        : selection.chooseCategory(
            roundId,
            offer.chooserPlayerId,
            choice === 'last' ? offer.categories.at(-1)! : offer.categories[0]!,
            1001,
          );
    assert.equal(selected.status, 'selected');
    if (selected.status !== 'selected') throw new Error('Tema não selecionado');
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (;;) {
      const question = selection.currentQuestion(roundId);
      if (!question) break;
      record(question);
      counts[question.publicQuestion.difficulty]++;
      selection.advanceQuestion(roundId, question.publicQuestion.questionId);
    }
    assert.deepEqual(counts, phaseDemand(mode, playerCount));
    assert.deepEqual(selection.availability().finalReserve, afterReserve.finalReserve);
    return {
      mode,
      offeredCategories: offer.categories,
      selectedCategory: selected.category,
      questions: counts,
    };
  });
  const regularQuestions = used.length;
  const afterScoring = selection.availability();
  const finalId = roundIdSchema.parse(uuid(2000));
  assert.equal(selection.startFinal(finalId).status, 'ready');
  const finalQuestions: ApprovedQuestion[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  let afterProtectedFinal: ReturnType<typeof selection.availability> | undefined;
  for (let n = 0; n <= questions.length; n++) {
    const question = selection.currentFinalQuestion(finalId);
    if ('status' in question) {
      assert.equal(question.status, 'interrupted');
      break;
    }
    record(question);
    assert.equal(question.publicQuestion.difficulty, n % 2 === 0 ? 'easy' : 'medium');
    finalQuestions.push(byId.get(question.editorialQuestionId)!);
    selection.advanceFinalQuestion(finalId, question.publicQuestion.questionId);
    if (n === 49) {
      afterProtectedFinal = selection.availability();
      assert.equal(total(afterProtectedFinal.finalReserve), 0);
      assert.deepEqual(stockOf(finalQuestions), afterReserve.finalReserve);
    }
  }
  assert.ok(afterProtectedFinal, 'Reserva da final não foi integralmente exercitada');
  assert.equal(selection.status().status, 'interrupted', 'Exaustão sem interrupção explícita');
  assert.deepEqual(selection.history(), used);
  return {
    playerCount,
    seed,
    choice,
    status: 'passed' as const,
    afterReserve,
    phases,
    regularQuestions,
    afterScoring,
    protectedFinalQuestions: 50,
    afterProtectedFinal,
    finalQuestionsUntilExhaustion: finalQuestions.length,
    uniqueQuestions: editorialIds.size,
    repeatedQuestions: used.length - editorialIds.size,
    historySha256: sha256(JSON.stringify(used)),
    remaining: selection.availability(),
    exhaustion: 'content-exhausted' as const,
  };
}

/** Check every nonempty subset, because the total count can hide a category/difficulty shortage. */
export function categoryConfigurations(repository: QuestionRepository) {
  const categories = [...new Set(repository.list().map((q) => q.category))].sort();
  assert.equal(categories.length, 6, 'A matriz T27 exige os seis temas editoriais');
  return Array.from({ length: 11 }, (_, i) => {
    const playerCount = i + 2;
    const configurations = Array.from({ length: 63 }, (_, index) => {
      const enabledCategories = categories.filter((_, bit) => ((index + 1) & (1 << bit)) !== 0);
      const start = QuestionSelection.create(
        repository,
        stockDependencies(27),
        stockOptions(playerCount, enabledCategories),
      );
      return {
        enabledCategories,
        status: start.status,
        ...(start.status === 'blocked' ? { reason: start.reason } : {}),
      };
    });
    return { playerCount, configurations };
  });
}

import assert from 'node:assert/strict';
import { matchIdSchema, roundIdSchema } from '../../packages/shared/src/index.js';
import type { ScoringMode } from '../../packages/shared/src/schemas/settings.js';
import { QuestionSelection } from '../../apps/server/src/modules/questions/question-selection.js';
import { stockOf } from '../../apps/server/src/modules/questions/question-pool.domain.js';
import type {
  ApprovedQuestion,
  PreparedQuestion,
} from '../../apps/server/src/modules/questions/question.js';
import {
  catalogAvailability,
  sha256,
} from '../../apps/server/src/modules/questions/catalog-format.js';
import { stockDependencies, stockOptions } from './question-stock.js';
import {
  freezeMatchRules,
  PROTOTYPE_PARAMETERS,
} from '../../apps/server/src/modules/scoring/match-rules.js';

/** Content-only experiment. A 50-question final is an explicit scenario, not a gameplay limit. */
export function simulateConsecutiveStock(
  questions: readonly ApprovedQuestion[],
  options: {
    playerCount: number;
    seed: number;
    categories: string[];
    modes: readonly ScoringMode[];
  },
) {
  const { playerCount, seed, categories, modes } = options;
  const used = new Set<string>();
  const history: string[] = [];
  const matches = [];
  const dependencies = stockDependencies(seed);
  const finalBudget = PROTOTYPE_PARAMETERS.final.reserveQuestions;
  for (;;) {
    const remaining = questions.filter((q) => !used.has(q.id) && categories.includes(q.category));
    const repository = {
      list: () => [...remaining],
      availability: () => catalogAvailability(remaining),
    };
    const matchId = matchIdSchema.parse(dependencies.ids.next());
    const start = QuestionSelection.create(repository, dependencies, {
      ...stockOptions(playerCount, categories),
      matchId,
      rules: freezeMatchRules(matchId, PROTOTYPE_PARAMETERS),
      format: 'classic',
      modes,
    });
    if (start.status === 'blocked') {
      return {
        ...options,
        finalQuestionsPerMatch: finalBudget,
        consecutiveMatches: matches.length,
        matches,
        uniqueQuestions: used.size,
        historySha256: sha256(JSON.stringify(history)),
        remaining: stockOf(remaining),
        stop: { status: start.status, reason: start.reason },
      };
    }
    const selection = start.selection;
    let regular = 0;
    function consume(q: PreparedQuestion) {
      assert(!used.has(q.editorialQuestionId), 'Repetição entre partidas.');
      used.add(q.editorialQuestionId);
      history.push(q.editorialQuestionId);
    }
    for (const mode of modes) {
      const roundId = roundIdSchema.parse(dependencies.ids.next());
      const offer = selection.openRound(roundId, mode, 1000);
      assert.equal(offer.status, 'choosing');
      if (offer.status !== 'choosing') throw new Error('Fase sem oferta de temas.');
      assert.equal(selection.expireCategoryChoice(roundId, offer.deadlineAt).status, 'selected');
      for (;;) {
        const q = selection.currentQuestion(roundId);
        if (!q) break;
        consume(q);
        regular++;
        selection.advanceQuestion(roundId, q.publicQuestion.questionId);
      }
    }
    const finalId = roundIdSchema.parse(dependencies.ids.next());
    assert.equal(selection.startFinal(finalId).status, 'ready');
    for (let i = 0; i < finalBudget; i++) {
      const q = selection.currentFinalQuestion(finalId);
      if ('status' in q) throw new Error('Reserva da final insuficiente.');
      consume(q);
      selection.advanceFinalQuestion(finalId, q.publicQuestion.questionId);
    }
    assert(regular > 0);
    matches.push({ regularQuestions: regular, finalQuestions: finalBudget });
  }
}

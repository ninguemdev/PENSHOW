import { beforeAll, describe, expect, it } from 'vitest';
import { LocalQuestionRepository } from './local-question.repository.js';
import { QuestionSelection } from '../modules/questions/question-selection.js';
import { PROTOTYPE_PARAMETERS, prototypeParametersSchema } from '../modules/scoring/match-rules.js';
import {
  simulateQuestionStock,
  STOCK_CHOICES,
  STOCK_SEEDS,
  stockDependencies,
  stockOptions,
} from '../../../../scripts/lib/question-stock.js';

const repository = new LocalQuestionRepository();
beforeAll(() => repository.load());
const categories = () => Object.keys(repository.availability()).sort();

describe('estoque publicado para o orçamento completo — T27', () => {
  it('oferece seis temas com pelo menos 50 revisadas e a distribuição mínima por dificuldade', () => {
    expect(categories()).toHaveLength(6);
    expect(repository.list().length).toBeGreaterThanOrEqual(300);
    for (const stock of Object.values(repository.availability())) {
      expect(stock.total).toBeGreaterThanOrEqual(50);
      expect(stock.easy).toBeGreaterThanOrEqual(15);
      expect(stock.medium).toBeGreaterThanOrEqual(20);
      expect(stock.hard).toBeGreaterThanOrEqual(15);
    }
  });
  it.each([2, 4, 8, 12])(
    '%i pessoas: escolhas extremas e timeout conservam a reserva e nunca repetem conteúdo',
    (count) => {
      for (const seed of STOCK_SEEDS) {
        for (const choice of STOCK_CHOICES) {
          const result = simulateQuestionStock(repository, count, seed, choice);
          expect(result.status).toBe('passed');
          expect(result.regularQuestions).toBe(24 + 2 * count);
          expect(result.protectedFinalQuestions).toBe(50);
          expect(result.repeatedQuestions).toBe(0);
          expect(result.finalQuestionsUntilExhaustion).toBeGreaterThanOrEqual(50);
          expect(result.exhaustion).toBe('content-exhausted');
        }
      }
    },
  );
  it('reproduz o mesmo percurso para a mesma semente e muda o histórico com outra semente', () => {
    const first = simulateQuestionStock(repository, 12, 27, 'first');
    expect(simulateQuestionStock(repository, 12, 27, 'first')).toEqual(first);
    expect(simulateQuestionStock(repository, 12, 20261020, 'first').historySha256).not.toBe(
      first.historySha256,
    );
  });
  it('recusa dois temas, dinamite maior que o estoque e ausência de difíceis sem converter dificuldade', () => {
    const start = (enabled: string[], parameters = PROTOTYPE_PARAMETERS) =>
      QuestionSelection.create(
        repository,
        stockDependencies(27),
        stockOptions(12, enabled, parameters),
      );
    expect(start(categories().slice(0, 2)).status).toBe('blocked');
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.pressure.turnDifficulties = ['medium', 'hard', 'medium', 'hard'];
    expect(start(categories(), parameters).status).toBe('blocked');
    const noHard = {
      list: () => repository.list().filter((q) => q.difficulty !== 'hard'),
      availability: () => repository.availability(),
    };
    expect(
      QuestionSelection.create(noHard, stockDependencies(27), stockOptions(12, categories()))
        .status,
    ).toBe('blocked');
  });
});

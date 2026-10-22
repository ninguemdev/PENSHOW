import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalQuestionRepository } from './local-question.repository.js';
import { simulateConsecutiveStock } from '../../../../scripts/lib/consecutive-stock.js';
import { classicPlanMatrix } from '../../../../scripts/lib/classic-plan-matrix.js';
import { publishedCatalogSchema } from '../modules/questions/catalog-format.js';

const repository = new LocalQuestionRepository();
beforeAll(() => repository.load());
const modes = classicPlanMatrix()[0]!.rounds.map((round) => round.mode);
const options = () => ({
  playerCount: 12,
  seed: 33,
  categories: Object.keys(repository.availability()),
  modes,
});

describe('capacidade consecutiva do catálogo atual — T33', () => {
  it('consome conteúdo real em partidas sucessivas e encerra por insuficiência', () => {
    const result = simulateConsecutiveStock(repository.list(), options());
    expect(result.consecutiveMatches).toBeGreaterThan(1);
    expect(result.uniqueQuestions).toBe(
      result.matches.reduce((n, m) => n + m.regularQuestions + m.finalQuestions, 0),
    );
    const remaining = Object.values(result.remaining).reduce(
      (n, row) => n + row.easy + row.medium + row.hard,
      0,
    );
    expect(remaining + result.uniqueQuestions).toBe(repository.list().length);
    expect(result.stop.status).toBe('blocked');
    expect(simulateConsecutiveStock(repository.list(), options())).toEqual(result);
    expect(
      simulateConsecutiveStock(repository.list(), { ...options(), seed: 20261022 }).historySha256,
    ).not.toBe(result.historySha256);
  });
  it('recusa um tema sem reserva suficiente e não converte dificuldades', () => {
    const limited = repository
      .list()
      .filter((q) => q.category === 'history')
      .slice(0, 16);
    const result = simulateConsecutiveStock(limited, {
      ...options(),
      categories: ['history'],
    });
    expect(result.consecutiveMatches).toBe(0);
    expect(result.uniqueQuestions).toBe(0);
    expect(
      result.remaining.history!.easy +
        result.remaining.history!.medium +
        result.remaining.history!.hard,
    ).toBe(limited.length);
    expect(
      simulateConsecutiveStock(
        repository.list().filter((q) => q.difficulty !== 'hard'),
        options(),
      ).consecutiveMatches,
    ).toBe(0);
  });
  it('o snapshot histórico preserva as 300 anteriores e a publicação atual inclui o novo lote', async () => {
    const baseline = publishedCatalogSchema.parse(
      JSON.parse(
        await readFile(
          new URL('../../../../data/editorial-baselines/t27-catalog.json', import.meta.url),
          'utf8',
        ),
      ),
    );
    expect(repository.list().length).toBeGreaterThanOrEqual(baseline.questions.length + 36);
    for (const question of baseline.questions)
      expect(repository.list().find((q) => q.id === question.id)).toEqual(question);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { runGroupPilot } from '../../../../scripts/lib/group-pilot.js';
import { LocalQuestionRepository } from '../platform/local-question.repository.js';

const questions = new LocalQuestionRepository();
beforeAll(() => questions.load());

describe('relatório local de grupo', () => {
  it('reproduz o percurso e conserva duração, pontos e oportunidades sem exportar gabaritos', async () => {
    const options = { playerCount: 2, seed: 32 };
    const run = await runGroupPilot(questions, options);
    expect(await runGroupPilot(questions, options)).toEqual(run);
    expect(run.completed).toBe(true);
    expect(run.rounds).toHaveLength(4);
    expect(run.rounds.every((round) => round.completed)).toBe(true);
    expect(
      run.rounds.reduce((ms, round) => ms + round.virtualDurationMs, 0) +
        run.final!.virtualDurationMs,
    ).toBe(run.virtualDurationMs);
    for (const round of run.rounds) {
      expect(round.correct + round.wrong + round.absent).toBe(round.opportunities);
      const delta = round.players.reduce(
        (total, row) => total + row.pointsAfter - row.pointsBefore,
        0,
      );
      const effects = round.effects;
      expect(delta).toBe(
        effects.correctPoints +
          effects.speedBonus +
          effects.wagerWon -
          effects.wagerLost -
          effects.pressurePenalty,
      );
    }
    expect(run.final!.questionsWithoutDamage).toBe(0);
    expect(run.final!.initialLives.map((row) => row.lives)).toEqual([5, 4]);
    const report = JSON.stringify(run);
    for (const privateField of [
      'correctOptionId',
      'questionId',
      'optionId',
      'token',
      'connectionId',
    ])
      expect(report).not.toContain(privateField);
  }, 30_000);

  it.each(['no-final-answer', 'no-final-target', 'tied-scoring'] as const)(
    'registra %s com as políticas confirmadas, sem fabricar pausas antigas',
    async (scenario) => {
      const run = await runGroupPilot(questions, { playerCount: 2, seed: 32, scenario });
      expect(run.terminalPhase).toBe('podium');
      expect(run.completed).toBe(true);
      expect(run.final!.winner).not.toBeNull();
      expect(run.final!.questionsWithoutDamage).toBe(0);
      if (scenario === 'tied-scoring')
        expect(run.final!.initialLives.map((row) => row.lives)).toEqual([5, 5]);
      if (scenario === 'no-final-answer')
        expect(run.final!.resolutions.every((row) => row.outcome === 'no-answer')).toBe(true);
    },
    30000,
  );
});

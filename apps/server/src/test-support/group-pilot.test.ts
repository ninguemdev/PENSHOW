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

  it.each([
    ['no-final-answer', 'final-no-answer-pending'],
    ['no-final-target', 'final-no-target-pending'],
    ['tied-scoring', 'ranking'],
  ] as const)(
    'registra %s como pausa sem fabricar conclusão ou dano',
    async (scenario, phase) => {
      const run = await runGroupPilot(questions, { playerCount: 2, seed: 32, scenario });
      expect(run.terminalPhase).toBe(phase);
      expect(run.completed).toBe(false);
      if (scenario === 'tied-scoring') {
        expect(run.final).toBeNull();
        expect(run.tiedGroups).toEqual([['P1', 'P2']]);
        expect(run.rounds.every((round) => round.players.every((row) => row.tiedAfter))).toBe(true);
      } else {
        expect(run.final!.questionsWithoutDamage).toBe(1);
        expect(run.final!.resolvedQuestions).toBe(0);
        expect(run.final!.winner).toBeNull();
      }
    },
    30_000,
  );
});

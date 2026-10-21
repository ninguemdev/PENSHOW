import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { LocalQuestionRepository } from '../apps/server/src/platform/local-question.repository.js';
import {
  publishedCatalogSchema,
  sha256,
  stableJson,
} from '../apps/server/src/modules/questions/catalog-format.js';
import {
  PILOT_VARIANTS,
  pilotParameters,
  runGroupPilot,
  type GroupPilotRun,
} from './lib/group-pilot.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1)
  throw new Error('Use pilot:simulate [--check].');
const catalogFile = new URL('../data/questions/published/catalog.json', import.meta.url);
const target = new URL('../data/publication-reports/t32-group-pilot.json', import.meta.url);
const catalog = publishedCatalogSchema.parse(JSON.parse(await readFile(catalogFile, 'utf8')));
const repository = new LocalQuestionRepository(catalogFile);
await repository.load();
const runs: GroupPilotRun[] = [];
const playerCounts = [2, 4, 8, 12];
const seeds = Array.from({ length: 8 }, (_, index) => 32 + index);
for (const playerCount of playerCounts) {
  const baseline: GroupPilotRun[] = [];
  for (const seed of seeds) {
    const run = await runGroupPilot(repository, { playerCount, seed });
    baseline.push(run);
    runs.push(run);
  }
  const complete = baseline.find((run) => run.completed);
  console.log(
    `Piloto ${playerCount}: ${baseline.filter((run) => run.completed).length}/${baseline.length} baselines chegaram ao pódio.`,
  );
  assert(
    complete,
    `Nenhum percurso completo para ${playerCount} jogadores; revise a matriz sem ocultar empates.`,
  );
  for (const variant of PILOT_VARIANTS.filter((variant) => variant !== 'baseline')) {
    const mode = variant.split('-')[0];
    const includesMode = (run: GroupPilotRun) => run.rounds.some((round) => round.mode === mode);
    const reference =
      baseline.find((run) => run.completed && includesMode(run)) ?? baseline.find(includesMode);
    assert(reference, `Modalidade ${mode} ausente da matriz de ${playerCount} jogadores.`);
    const comparison = await runGroupPilot(repository, {
      playerCount,
      seed: reference.seed,
      variant,
    });
    const scoringReceipts = (run: GroupPilotRun) =>
      run.rounds.map((round) => ({
        mode: round.mode,
        questions: round.questions,
        responses: round.responses,
        correct: round.correct,
      }));
    assert.deepEqual(
      scoringReceipts(comparison),
      scoringReceipts(reference),
      'Comparação alterou as respostas prescritas.',
    );
    runs.push(comparison);
  }
  for (const scenario of ['no-final-answer', 'no-final-target', 'tied-scoring'] as const) {
    const run = await runGroupPilot(repository, { playerCount, seed: complete.seed, scenario });
    assert.equal(
      run.terminalPhase,
      {
        'no-final-answer': 'final-no-answer-pending',
        'no-final-target': 'final-no-target-pending',
        'tied-scoring': 'ranking',
      }[scenario],
    );
    if (run.final) assert.equal(run.final.questionsWithoutDamage, 1);
    runs.push(run);
  }
  console.log(`Piloto ${playerCount}: comparações e pausas registradas.`);
}
const summary = playerCounts.map((playerCount) => {
  const baseline = runs.filter(
    (run) =>
      run.playerCount === playerCount && run.variant === 'baseline' && run.scenario === 'mixed',
  );
  const completed = baseline.filter((run) => run.completed);
  const durations = completed.map((run) => run.virtualDurationMs);
  return {
    playerCount,
    baselineRuns: baseline.length,
    completed: completed.length,
    pendingTiebreak: baseline.filter((run) => run.terminalPhase === 'ranking').length,
    otherStops: baseline.filter((run) => !run.completed && run.terminalPhase !== 'ranking').length,
    completedVirtualDurationMs: { min: Math.min(...durations), max: Math.max(...durations) },
    initialLeaderWins: completed.filter((run) => run.final?.winnerInitialRank === 1).length,
    comparisons: runs
      .filter((run) => run.playerCount === playerCount && run.variant !== 'baseline')
      .map((run) => {
        const original = baseline.find((entry) => entry.seed === run.seed)!;
        return {
          seed: run.seed,
          variant: run.variant,
          baselineTerminalPhase: original.terminalPhase,
          terminalPhase: run.terminalPhase,
          changedFinalScores: run.rounds
            .at(-1)!
            .players.filter(
              (row) =>
                original.rounds.at(-1)!.players.find((entry) => entry.player === row.player)
                  ?.pointsAfter !== row.pointsAfter,
            ).length,
          changedFinalRanks: run.rounds
            .at(-1)!
            .players.filter(
              (row) =>
                original.rounds.at(-1)!.players.find((entry) => entry.player === row.player)
                  ?.rankAfter !== row.rankAfter,
            ).length,
          virtualDurationDeltaMs: run.virtualDurationMs - original.virtualDurationMs,
          changedInitialLives:
            run.final && original.final
              ? run.final.initialLives.filter(
                  (entry) =>
                    original.final!.initialLives.find((row) => row.player === entry.player)
                      ?.lives !== entry.lives,
                ).length
              : null,
          changedWinner:
            run.completed && original.completed
              ? run.final!.winner !== original.final!.winner
              : null,
        };
      }),
  };
});
assert.deepEqual(
  new Set(runs.flatMap((run) => run.rounds.map((round) => round.mode))),
  new Set(['classic', 'speed', 'wager', 'theft', 'pressure']),
);
const report = {
  schemaVersion: 1,
  task: 'T32',
  scope:
    'Piloto mecânico experimental local; jogadores roteirizados e relógio virtual. Não são sessões humanas, medição de latência ou avaliação de conforto/equilíbrio percebido.',
  pendingDecisions: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'],
  methodology: {
    seeds,
    playerCounts,
    instructionsAndCategories:
      'Aguarda o prazo completo; temas selecionados pela política oficial de expiração.',
    accuracy:
      'Probabilidade prescrita de 0,9 para P1 até 0,4 para o último; amostras SHA-256 por seed, fase, pergunta e jogador.',
    absence: 'Probabilidade prescrita de 0,05 por oportunidade nas fases de pontuação.',
    delays:
      'Resposta entre 500 ms e prazo menos 500 ms; escolha de aposta/alvo de roubo em 1 s; alvo da final em 1,5 s. Sem latência de rede.',
    final:
      'Só a primeira resposta; probabilidade prescrita de acerto 0,7, sem ausência no cenário misto. Seeds pares miram melhor classificação inicial; ímpares miram menos vidas.',
    pairedRuns:
      'Baseline completo de cada tamanho que inclua a modalidade alterada, ou primeiro baseline com essa modalidade se nenhum deles concluir; mesmos samples e sorteio, uma alteração de pontuação por execução. Mudanças de saldo/alvo/classificação podem alterar o percurso.',
    incompleteRuns:
      'Mantidas no relatório; duração até a pausa, excluída do intervalo de partidas completas. Sem resolver D02/D03/D06 artificialmente.',
    safetyGuard:
      '2000 transições; falha se alcançado. Não representa limite de duração da partida.',
  },
  catalogSha256: catalog.manifest.contentSha256,
  configurations: PILOT_VARIANTS.map((variant) => ({
    variant,
    parameters: pilotParameters(variant),
    parametersSha256: sha256(stableJson(pilotParameters(variant))),
  })),
  summary,
  runs,
};
const bytes = stableJson(report);
if (args.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== bytes)
    throw new Error('Relatório T32 divergente; execute pilot:simulate.');
} else await writeFile(target, bytes);
console.log(
  JSON.stringify(
    { simulations: runs.length, summary, report: 'data/publication-reports/t32-group-pilot.json' },
    null,
    2,
  ),
);

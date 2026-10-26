import assert from 'node:assert/strict';
import { combatBotInput } from '../../apps/server/src/test-support/combat-bot.js';
import { createHash } from 'node:crypto';
import {
  defaultAvatar,
  playerIdSchema,
  type PlayerId,
  type Scoreboard,
} from '../../packages/shared/src/index.js';
import { createTestRuntime } from '../../apps/server/src/test-support/runtime.js';
import { stockDependencies } from './question-stock.js';
import { RoomService } from '../../apps/server/src/modules/rooms/room.service.js';
import { MatchService, matchContext } from '../../apps/server/src/modules/matches/match.service.js';
import {
  currentPressureTurn,
  currentRound,
  matchTimer,
  type MatchInput,
  type MatchState,
} from '../../apps/server/src/modules/matches/match.domain.js';
import type { QuestionRepository } from '../../apps/server/src/modules/questions/question.repository.js';
import {
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from '../../apps/server/src/modules/scoring/match-rules.js';

export const PILOT_VARIANTS = [
  'baseline',
  'pressure-200-100',
  'speed-25-10-0',
  'wager-limit-25',
  'theft-limit-25',
] as const;
export type PilotVariant = (typeof PILOT_VARIANTS)[number];
export type PilotScenario = 'mixed' | 'no-final-answer' | 'no-final-target' | 'tied-scoring';

export function pilotParameters(variant: PilotVariant) {
  const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
  if (variant === 'pressure-200-100') {
    parameters.pressure.correctPoints = 200;
    parameters.pressure.wrongPenalty = 100;
    parameters.pressure.policy.status = 'prototype';
  } else if (variant === 'speed-25-10-0') {
    parameters.speed.bonusBands.forEach((band, index) => {
      band.points = [25, 10, 0][index]!;
    });
  } else if (variant === 'wager-limit-25') parameters.wager.allowedAmounts = [0, 25];
  else if (variant === 'theft-limit-25') {
    parameters.theft.maximumTransfer = 25;
    parameters.theft.policy.status = 'prototype';
  }
  return prototypeParametersSchema.parse(parameters);
}

// Behavioral samples do not consume the game's RNG. Paired runs keep the same
// intended answers/delays, even when balances, eligible targets or ties change.
function sample(seed: number, key: string) {
  return createHash('sha256').update(`${seed}:${key}`).digest().readUInt32BE(0) / 2 ** 32;
}
function ranks(scores: Scoreboard) {
  return scores.map((row) => ({
    ...row,
    // The current D06 policy compares points only. Equal scores share a rank.
    rank: 1 + scores.filter((other) => other.points > row.points).length,
    tied: scores.filter((other) => other.points === row.points).length > 1,
  }));
}

/** Local mechanical pilot: real services/catalog, virtual time, scripted players. */
export async function runGroupPilot(
  questions: QuestionRepository,
  options: {
    playerCount: number;
    seed: number;
    variant?: PilotVariant;
    scenario?: PilotScenario;
  },
) {
  const { playerCount, seed, variant = 'baseline', scenario = 'mixed' } = options;
  assert([2, 4, 8, 12].includes(playerCount));
  assert(Number.isSafeInteger(seed) && seed >= 0);
  const { runtime, time } = createTestRuntime();
  Object.assign(runtime, stockDependencies(seed));
  const parameters = pilotParameters(variant);
  const errors: string[] = [];
  const matches = new MatchService({
    runtime,
    questions,
    parameters,
    onError: () => errors.push('match'),
  });
  const rooms = new RoomService({
    runtime,
    quiz: matches,
    onError: () => errors.push('room'),
  });
  const actors = Array.from({ length: playerCount }, (_, index) => ({
    playerId: playerIdSchema.parse(
      `32000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    connectionId: `pilot-${index + 1}`,
  }));
  const label = (id: PlayerId) => `P${actors.findIndex((actor) => actor.playerId === id) + 1}`;
  const phaseMs: Record<string, number> = {};
  const roundMs = new Map<string, number>();
  const roundResponses = new Map<string, number>();
  const opened = new Set<string>();
  const questionIds = new Set<string>();
  let finalOpened = 0;
  try {
    const entry = await rooms.create(
      actors[0]!,
      { nickname: 'Piloto 1', avatar: defaultAvatar() },
      {
        format: 'classic',
        maxPlayers: playerCount,
        enabledCategories: [...new Set(questions.list().map((question) => question.category))],
      },
    );
    for (const [index, actor] of actors.entries())
      if (index > 0)
        await rooms.join(actor, entry.code, {
          nickname: `Piloto ${index + 1}`,
          avatar: defaultAvatar(),
        });
    const room = rooms.registry.byId(entry.roomId)!;
    let latest: MatchState | null = null;
    const refresh = () => {
      const phase = room.snapshot().phase;
      assert(phase.status === 'match' && phase.game);
      latest = phase.game.state;
    };
    const state = (): MatchState => {
      assert(latest);
      return latest;
    };
    await rooms.start(actors[0]!, room.id);
    refresh();
    const startedAt = time.now();
    const execute = async (playerId: PlayerId, command: MatchInput) => {
      await matches.execute(
        room,
        actors.find((actor) => actor.playerId === playerId)!,
        command,
      );
      refresh();
    };
    const advance = async (target: number) => {
      const before = state();
      const phase = before.final?.stage.phase ?? before.stage.phase;
      const round = before.final?.round ?? currentRound(before);
      const delta = target - time.now();
      assert(delta >= 0);
      phaseMs[phase] = (phaseMs[phase] ?? 0) + delta;
      roundMs.set(round.roundId, (roundMs.get(round.roundId) ?? 0) + delta);
      // Every call stops at/before the current timer; no intermediate phase is skipped.
      const timer = matchTimer(before);
      assert(timer && target <= timer.deadlineAt);
      await time.advanceTo(target);
      refresh();
    };
    const deadline = async () => {
      const timer = matchTimer(state());
      assert(timer, 'A fase deveria ter um prazo.');
      await advance(timer.deadlineAt);
    };
    const registerQuestion = (id: string) => {
      assert(!questionIds.has(id), 'Pergunta repetida no piloto.');
      questionIds.add(id);
    };

    for (let guard = 0; guard < 5000; guard++) {
      const before = state();
      const stage = before.final?.stage ?? before.stage;
      if (!matchTimer(before)) break;
      if (stage.phase === 'final-tiebreak') {
        const tie = stage.tiebreak;
        if (tie.phase === 'instructions') {
          for (const id of tie.combat.fighters.map((f) => f.playerId))
            await execute(id, { kind: 'ready', ...matchContext(state()) });
        } else if (tie.phase === 'combat') {
          for (const f of tie.combat.fighters.filter((f) => f.status === 'fighting'))
            await matches.input(
              room,
              actors.find((a) => a.playerId === f.playerId)!,
              matchContext(state()),
              combatBotInput(tie, f.playerId, time.now()),
            );
          await deadline();
        } else if (tie.phase === 'questions') {
          const available = tie.questions.filter((q) => !q.outcome && time.now() >= q.opensAt);
          if (!available.length) await deadline();
          else
            for (const q of available)
              await execute(q.playerId, {
                kind: 'tiebreak-answer',
                ...matchContext(state()),
                tiebreakId: tie.tiebreakId,
                bout: tie.bout,
                generation: tie.generation,
                questionId: q.question.publicQuestion.questionId,
                optionId:
                  q.playerId === tie.combat.fighters[0]!.playerId
                    ? q.question.correctOptionId
                    : q.question.publicQuestion.options.find(
                        (o) => o.optionId !== q.question.correctOptionId,
                      )!.optionId,
              });
        } else await deadline();
        assert(guard < 4999, 'Limite de segurança do piloto atingido.');
        continue;
      }
      if (stage.phase === 'wager-selection') {
        await advance(time.now() + 1000);
        for (const [index, actor] of actors.entries()) {
          const score = state().scoreboard.find((row) => row.playerId === actor.playerId)!;
          const key = `${before.roundIndex}:${before.history.length}:${index}:wager`;
          const desired =
            scenario === 'tied-scoring' ? 0 : [0, 25, 50][Math.floor(sample(seed, key) * 3)]!;
          const amount = parameters.wager.allowedAmounts
            .filter((value) => value <= score.points && value <= desired)
            .at(-1)!;
          await execute(actor.playerId, {
            kind: 'wager',
            ...matchContext(state()),
            questionId: stage.question.publicQuestion.questionId,
            amount,
          });
        }
        if (state().stage.phase === 'wager-selection') await deadline();
      } else if (stage.phase === 'question-open') {
        const id = stage.question.publicQuestion.questionId;
        assert(!opened.has(id));
        opened.add(id);
        registerQuestion(id);
        const turn = currentPressureTurn(before);
        const eligible = actors.filter((actor) => !turn || actor.playerId === turn.playerId);
        const submissions = eligible
          .map((actor) => {
            const index = actors.indexOf(actor);
            const key = `${before.roundIndex}:${before.history.length}:${index}`;
            const accuracy = 0.9 - (0.5 * index) / (playerCount - 1);
            return {
              actor,
              absent: scenario !== 'tied-scoring' && sample(seed, `${key}:absent`) < 0.05,
              correct: scenario !== 'tied-scoring' && sample(seed, `${key}:correct`) < accuracy,
              at:
                stage.opensAt +
                500 +
                Math.floor(
                  sample(seed, `${key}:delay`) * (stage.deadlineAt - stage.opensAt - 1000),
                ),
            };
          })
          .filter((submission) => !submission.absent)
          .sort((a, b) => a.at - b.at);
        for (const submission of submissions) {
          await advance(submission.at);
          await execute(submission.actor.playerId, {
            kind: 'answer',
            ...matchContext(state()),
            questionId: id,
            optionId: submission.correct
              ? stage.question.correctOptionId
              : stage.question.publicQuestion.options.find(
                  (option) => option.optionId !== stage.question.correctOptionId,
                )!.optionId,
          });
          const roundId = currentRound(before).roundId;
          roundResponses.set(roundId, (roundResponses.get(roundId) ?? 0) + 1);
        }
        if (state().stage.phase === 'question-open') await deadline();
      } else if (stage.phase === 'theft-target-selection') {
        await advance(time.now() + 1000);
        const target = state()
          .scoreboard.filter((row) => stage.eligibleTargetIds.includes(row.playerId))
          .sort((a, b) => b.points - a.points)[0]!;
        await execute(stage.attackerPlayerId, {
          kind: 'target',
          ...matchContext(state()),
          questionId: stage.question.publicQuestion.questionId,
          targetPlayerId: target.playerId,
        });
      } else if (stage.phase === 'final-question-open') {
        registerQuestion(stage.question.publicQuestion.questionId);
        finalOpened++;
        if (scenario === 'no-final-answer') {
          await deadline();
          continue;
        }
        const submissions = before
          .final!.finalists.filter((row) => row.status === 'active')
          .map((row) => ({
            row,
            at:
              stage.opensAt +
              500 +
              Math.floor(sample(seed, `final:${finalOpened}:${row.playerId}:delay`) * 14000),
            correct:
              scenario === 'no-final-target' ||
              sample(seed, `final:${finalOpened}:${row.playerId}:correct`) < 0.7,
          }))
          .sort((a, b) => a.at - b.at);
        const first = submissions[0]!;
        await advance(first.at);
        await execute(first.row.playerId, {
          kind: 'answer',
          ...matchContext(state()),
          questionId: stage.question.publicQuestion.questionId,
          optionId: first.correct
            ? stage.question.correctOptionId
            : stage.question.publicQuestion.options.find(
                (option) => option.optionId !== stage.question.correctOptionId,
              )!.optionId,
        });
      } else if (stage.phase === 'final-target-selection') {
        if (scenario === 'no-final-target') {
          await deadline();
          continue;
        }
        await advance(time.now() + 1500);
        const eligible = before.final!.finalists.filter(
          (row) => row.status === 'active' && row.playerId !== stage.accepted.playerId,
        );
        // Both policies are scripts, not observations of player preferences.
        eligible.sort((a, b) =>
          seed % 2 === 0 ? a.rank - b.rank : a.lives - b.lives || a.rank - b.rank,
        );
        await execute(stage.accepted.playerId, {
          kind: 'target',
          ...matchContext(state()),
          questionId: stage.question.publicQuestion.questionId,
          targetPlayerId: eligible[0]!.playerId,
        });
      } else await deadline();
      assert(guard < 4999, 'Limite de segurança do piloto atingido.');
    }
    assert.deepEqual(errors, [], 'Falha assíncrona dos serviços.');
    const last = state();
    const terminalPhase = last.final?.stage.phase ?? last.stage.phase;
    assert(
      [
        'podium',
        'ranking',
        'final-no-answer-pending',
        'final-no-target-pending',
        'interrupted',
      ].includes(terminalPhase),
      `Piloto parou em ${terminalPhase}.`,
    );
    const rounds = last.rounds.map((round) => {
      const history = last.history.filter((record) => record.context.roundId === round.roundId);
      const before = history[0]?.before ?? last.scoreboard;
      const after = history.at(-1)?.after ?? before;
      const initialRanks = ranks(before);
      const opportunities = history.length * (round.mode === 'pressure' ? 1 : playerCount);
      const responses = roundResponses.get(round.roundId) ?? 0;
      const correct = history.reduce((sum, record) => sum + record.correctPlayerIds.length, 0);
      const effects = history.flatMap((record) => record.effects);
      const total = (reason: (typeof effects)[number]['reason'], kind: 'credit' | 'debit') =>
        effects
          .filter((effect) => effect.reason === reason && effect.kind === kind)
          .reduce((sum, effect) => sum + effect.amount, 0);
      assert.equal(total('theft', 'credit'), total('theft', 'debit'));
      return {
        index: round.index,
        mode: round.mode,
        completed:
          history.length ===
          (round.mode === 'pressure'
            ? parameters.pressure.turnDifficulties.length * playerCount
            : Object.values(parameters[round.mode].questions).reduce(
                (sum, count) => sum + count,
                0,
              )),
        virtualDurationMs: roundMs.get(round.roundId) ?? 0,
        questions: history.length,
        opportunities,
        responses,
        correct,
        wrong: responses - correct,
        absent: opportunities - responses,
        effects: {
          correctPoints: total('correct-answer', 'credit'),
          speedBonus: total('speed-bonus', 'credit'),
          wagerWon: total('wager', 'credit'),
          wagerLost: total('wager', 'debit'),
          stolen: total('theft', 'credit'),
          pressurePenalty: total('pressure', 'debit'),
        },
        players: ranks(after).map((row) => {
          const start = initialRanks.find((entry) => entry.playerId === row.playerId)!;
          return {
            player: label(row.playerId),
            pointsBefore: start.points,
            pointsAfter: row.points,
            correct: row.correctAnswers - start.correctAnswers,
            rankBefore: start.rank,
            rankAfter: row.rank,
            tiedBefore: start.tied,
            tiedAfter: row.tied,
          };
        }),
      };
    });
    const final = last.final;
    const winner =
      terminalPhase === 'podium'
        ? (final!.finalists.find((row) => row.status === 'active') ??
          final!.finalists.find(
            (row) => row.playerId === final!.tiebreakResults?.at(-1)?.standings[0],
          ) ??
          null)
        : null;
    const totalDuration = time.now() - startedAt;
    assert.equal(
      Object.values(phaseMs).reduce((sum, ms) => sum + ms, 0),
      totalDuration,
    );
    if (final)
      for (const record of final.history) {
        assert.equal(record.resolution.damage, 1);
        assert.equal(
          record.before.reduce((sum, row) => sum + row.lives, 0) -
            record.after.reduce((sum, row) => sum + row.lives, 0),
          record.resolution.outcome === 'no-answer' ? record.resolution.playerIds.length : 1,
        );
      }
    return {
      playerCount,
      seed,
      variant,
      scenario,
      targetPolicy: seed % 2 === 0 ? 'best-initial-rank' : 'fewest-lives',
      terminalPhase,
      completed: terminalPhase === 'podium',
      virtualDurationMs: totalDuration,
      phaseMs,
      rounds,
      tiedGroups:
        last.finalEntry?.status === 'pending-tiebreak'
          ? last.finalEntry.groups
              .filter((group) => group.length > 1)
              .map((group) => group.map(label))
          : [],
      final: final
        ? {
            virtualDurationMs: roundMs.get(final.round.roundId) ?? 0,
            openedQuestions: finalOpened,
            resolvedQuestions: final.history.length,
            questionsWithoutDamage: finalOpened - final.history.length,
            initialLives: final.finalists.map((row) => ({
              player: label(row.playerId),
              rank: row.rank,
              lives: row.initialLives,
            })),
            resolutions: final.history.map((record) => ({
              author: record.accepted ? label(record.accepted.playerId) : 'all',
              outcome: record.resolution.outcome,
              victim:
                record.resolution.outcome === 'no-answer'
                  ? 'all'
                  : label(
                      record.resolution.outcome === 'attack'
                        ? record.resolution.targetPlayerId
                        : (record.accepted?.playerId ?? record.before[0]!.playerId),
                    ),
              damage: record.resolution.damage,
            })),
            winner: winner ? label(winner.playerId) : null,
            winnerInitialRank: winner?.rank ?? null,
          }
        : null,
    };
  } finally {
    await rooms.dispose();
    await time.dispose();
  }
}

export type GroupPilotRun = Awaited<ReturnType<typeof runGroupPilot>>;

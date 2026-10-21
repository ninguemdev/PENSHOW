import { afterEach, describe, expect, it } from 'vitest';
import { matchViewSchema, roomViewSchema, type RoomView } from '@penshow/shared';
import { createTestRuntime } from '../../test-support/runtime.js';
import { players, profile, repository } from '../../test-support/match.js';
import { RoomService } from '../rooms/room.service.js';
import { buildPlayerView } from '../views/build-player-view.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { MatchService, matchContext } from './match.service.js';
import { currentPressureTurn, matchTimer } from './match.domain.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup(choices: number[] = [0, 0, 0, 0], stock = 60) {
  const { runtime, time } = createTestRuntime();
  runtime.random = { integer: () => 0 };
  const views: RoomView[] = [];
  const matches = new MatchService({ runtime, questions: repository(true, stock) });
  const rooms = new RoomService({
    runtime,
    quiz: matches,
    onChange: (after) => {
      for (const member of after.members) {
        const view = buildPlayerView(after, member.playerId, time.now());
        if (view) views.push(roomViewSchema.parse(view));
      }
    },
  });
  cleanups.push(async () => {
    await rooms.dispose();
    await time.dispose();
  });
  const actors = players.map((playerId, index) => ({ playerId, connectionId: `socket-${index}` }));
  const entry = await rooms.create(actors[0]!, profile, {
    format: 'classic',
    maxPlayers: 2,
    enabledCategories: ['history'],
  });
  await rooms.join(actors[1]!, entry.code, { ...profile, nickname: 'Bia' });
  runtime.random = { integer: () => choices.shift() ?? 0 };
  const room = rooms.registry.byId(entry.roomId)!;
  const game = () => {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game;
  };
  const start = () => rooms.start(actors[0]!, room.id);
  const advance = () => time.advanceTo(matchTimer(game().state)!.deadlineAt);
  async function playScoring(tied = false) {
    const roundIds = new Set<string>();
    const questionIds = new Set<string>();
    const transitions: number[] = [];
    for (
      let guard = 0;
      guard < 300 &&
      !game().state.final &&
      !['prototype-complete', 'ranking'].includes(game().state.stage.phase);
      guard++
    ) {
      const state = game().state,
        stage = state.stage;
      roundIds.add(state.rounds[state.roundIndex]!.roundId);
      if (stage.phase === 'question-open') {
        expect(questionIds.has(stage.question.publicQuestion.questionId)).toBe(false);
        questionIds.add(stage.question.publicQuestion.questionId);
        const turn = currentPressureTurn(state);
        for (const actor of actors.filter((actor) => !turn || turn.playerId === actor.playerId))
          await matches.execute(room, actor, {
            kind: 'answer',
            ...matchContext(state),
            questionId: stage.question.publicQuestion.questionId,
            optionId:
              !tied && actor === actors[0]
                ? stage.question.correctOptionId
                : stage.question.publicQuestion.options.find(
                    (option) => option.optionId !== stage.question.correctOptionId,
                  )!.optionId,
          });
      } else if (stage.phase === 'round-results') {
        transitions.push(state.scoreboard[0]!.points);
        await advance();
        if (!game().state.final && game().state.stage.phase === 'instructions')
          expect(game().state.scoreboard).toEqual(state.scoreboard);
      } else await advance();
    }
    expect(roundIds.size).toBe(4);
    expect(transitions).toHaveLength(4);
    return { questionIds, transitions };
  }
  return { runtime, time, matches, rooms, actors, room, game, views, start, advance, playScoring };
}

describe('modo clássico integrado', () => {
  it.each([
    [0, 0, 0, 0],
    [3, 2, 1, 0],
    [4, 3, 2, 1],
    [0, 1, 0, 1],
    [0, 3, 2, 1],
  ])('encadeia cinco fases, conserva placar e chega ao pódio: %j', async (...choices) => {
    const s = await setup([...choices]);
    await s.start();
    const initial = s.game().state;
    expect(initial.finalRound).toMatchObject({ index: 5, mode: 'final' });
    expect(initial.scoreboard.every((row) => row.points === 0)).toBe(true);
    const reserve = QuestionSelection.resume(s.game().selection, s.runtime).availability()
      .finalReserve;
    const played = await s.playScoring();
    const qualified = s.game().state;
    expect(qualified.roster.matchId).toBe(initial.roster.matchId);
    expect(qualified.rounds).toEqual(initial.rounds);
    expect(qualified.finalEntry).toMatchObject({ scope: 'full-match', status: 'ready' });
    expect(qualified.final?.stage.phase).toBe('final-instructions');
    expect(qualified.final?.finalists.map((row) => row.initialLives)).toEqual([5, 4]);
    expect(
      QuestionSelection.resume(s.game().selection, s.runtime).availability().finalReserve,
    ).toEqual(reserve);
    for (let guard = 0; guard < 40 && s.game().state.final?.stage.phase !== 'podium'; guard++) {
      const state = s.game().state,
        stage = state.final!.stage;
      if (stage.phase === 'final-question-open') {
        expect(played.questionIds.has(stage.question.publicQuestion.questionId)).toBe(false);
        played.questionIds.add(stage.question.publicQuestion.questionId);
        await s.matches.execute(s.room, s.actors[0]!, {
          kind: 'answer',
          ...matchContext(state),
          questionId: stage.question.publicQuestion.questionId,
          optionId: stage.question.correctOptionId,
        });
      } else if (stage.phase === 'final-target-selection') {
        await s.matches.execute(s.room, s.actors[0]!, {
          kind: 'target',
          ...matchContext(state),
          questionId: stage.question.publicQuestion.questionId,
          targetPlayerId: s.actors[1]!.playerId,
        });
      } else await s.advance();
    }
    expect(s.game().state.final?.stage.phase).toBe('podium');
    expect(s.game().state.finalEntry).toEqual(qualified.finalEntry);
    const last = s.views.at(-1)!;
    if (last.state.status !== 'match') throw new Error();
    const view = matchViewSchema.parse(last.state.match);
    expect(view.progress).toMatchObject({ roundNumber: 5, roundCount: 5 });
    expect(view.roundSummaries?.map((row) => row.round)).toEqual(initial.rounds);
    expect(view.plan).toEqual([...initial.rounds, initial.finalRound]);
    expect(
      s.views
        .filter((view) => view.state.status === 'match')
        .every(
          (view) =>
            view.state.status === 'match' &&
            JSON.stringify(view.state.match.plan) ===
              JSON.stringify(last.state.status === 'match' && last.state.match.plan),
        ),
    ).toBe(true);
    const oldTimer = matchTimer(qualified)!;
    await s.rooms.returnToLobby(s.actors[0]!, s.room.id, initial.roster.matchId, {
      requireFinished: true,
    });
    expect(s.room.snapshot().themeChoiceQueue).toBeDefined();
    await s.start();
    expect(s.game().state.roster.matchId).not.toBe(initial.roster.matchId);
    expect(s.game().state.rounds.map((round) => round.roundId)).not.toEqual(
      initial.rounds.map((round) => round.roundId),
    );
    expect(s.game().state.scoreboard.every((score) => score.points === 0)).toBe(true);
    expect(matchTimer(s.game().state)).not.toEqual(oldTimer);
    await expect(
      s.matches.execute(s.room, s.actors[0]!, { kind: 'ready', ...matchContext(initial) }),
    ).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
  });

  it('mantém empate explícito antes da conversão, sem inventar uma decisão D06', async () => {
    const s = await setup();
    await s.start();
    await s.playScoring(true);
    expect(s.game().state.final).toBeNull();
    expect(s.game().state.finalEntry).toMatchObject({
      scope: 'full-match',
      status: 'pending-tiebreak',
      next: { kind: 'decision-required' },
    });
    expect(matchTimer(s.game().state)).toBeNull();
    expect(s.views.at(-1)?.state.status).toBe('match');
  });

  it('bloqueia estoque insuficiente antes de sair do lobby', async () => {
    const s = await setup([], 3);
    await expect(s.start()).rejects.toMatchObject({ code: 'INSUFFICIENT_QUESTIONS' });
    expect(s.room.snapshot().phase.status).toBe('lobby');
  });

  it('inícios concorrentes não refazem o sorteio e sala vazia espera na transição', async () => {
    const s = await setup();
    const starts = await Promise.allSettled([s.start(), s.start()]);
    expect(starts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const initial = s.game().state;
    for (let guard = 0; guard < 60 && s.game().state.stage.phase !== 'round-results'; guard++)
      await s.advance();
    const before = s.game().state;
    expect(before.stage.phase).toBe('round-results');
    for (const actor of s.actors) await s.rooms.disconnect(actor);
    await s.advance();
    expect(s.game().suspended).toBe(true);
    expect(s.game().state.roundIndex).toBe(0);
    expect(s.game().state.history).toEqual(before.history);
    await s.rooms.reconnect(s.actors[1]!);
    await s.time.advanceTo(s.time.now());
    expect(s.game().suspended).toBeUndefined();
    expect(s.game().state.roundIndex).toBe(1);
    expect(s.game().state.stage.phase).toBe('instructions');
    expect(s.game().state.rounds).toEqual(initial.rounds);
    expect(s.game().state.finalRound).toEqual(initial.finalRound);
    expect(s.game().state.scoreboard).toEqual(before.scoreboard);
    await expect(
      s.matches.execute(s.room, s.actors[1]!, { kind: 'ready', ...matchContext(before) }),
    ).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
  });

  it('aposta abre com zero, resiste à troca de conexão e mantém sorteio e prazo', async () => {
    const s = await setup([0, 1, 0, 1]);
    await s.start();
    expect(s.game().state.rounds[0]!.mode).toBe('wager');
    const initial = s.game().state;
    await s.rooms.disconnect(s.actors[0]!);
    const replacement = { ...s.actors[0]!, connectionId: 'replacement' };
    await s.rooms.reconnect(replacement);
    expect(s.game().state.rounds).toEqual(initial.rounds);
    expect(matchTimer(s.game().state)).toEqual(matchTimer(initial));
    await expect(
      s.matches.execute(s.room, s.actors[0]!, { kind: 'ready', ...matchContext(initial) }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    for (let guard = 0; guard < 5 && s.game().state.stage.phase !== 'wager-selection'; guard++)
      await s.advance();
    const state = s.game().state;
    if (state.stage.phase !== 'wager-selection') throw new Error('Aposta esperada.');
    await s.matches.execute(s.room, replacement, {
      kind: 'wager',
      ...matchContext(state),
      questionId: state.stage.question.publicQuestion.questionId,
      amount: 0,
    });
    await expect(
      s.matches.execute(s.room, s.actors[1]!, {
        kind: 'wager',
        ...matchContext(state),
        questionId: state.stage.question.publicQuestion.questionId,
        amount: 25,
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(s.game().state.scoreboard.every((score) => score.points === 0)).toBe(true);
  });
});

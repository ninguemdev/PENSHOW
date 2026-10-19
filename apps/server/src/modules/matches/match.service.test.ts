import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  matchViewSchema,
  playerIdSchema,
  roomViewSchema,
  roundIdSchema,
  type RoomView,
} from '@penshow/shared';
import type { ScheduledTask } from '../../ports.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { RoomService, type RoomActor } from '../rooms/room.service.js';
import { buildPlayerView } from '../views/build-player-view.js';
import { prototypeParametersSchema, PROTOTYPE_PARAMETERS } from '../scoring/match-rules.js';
import { MatchService, matchContext } from './match.service.js';
import { matchTimer } from './match.domain.js';
import { StrategyRegistry, classicStrategy } from './match-strategy.js';
import { players, profile, repository, roster, uuid } from '../../test-support/match.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function setup(
  options: {
    strategies?: StrategyRegistry;
    observerFails?: () => boolean;
    isCurrentActor?: (actor: RoomActor) => boolean;
  } = {},
) {
  const { runtime, time } = createTestRuntime(
    1000,
    Array.from({ length: 2000 }, () => 0),
  );
  const scheduled: { deadline: number; task: ScheduledTask; cancel: ReturnType<typeof vi.fn> }[] =
    [];
  const order: string[] = [],
    views: RoomView[] = [],
    errors = vi.fn();
  runtime.scheduler = {
    scheduleAt: (deadline, task) => {
      order.push('schedule');
      const cancel = vi.fn(time.scheduleAt(deadline, task));
      scheduled.push({ deadline, task, cancel });
      return () => {
        order.push('cancel');
        cancel();
      };
    },
    dispose: () => time.dispose(),
  };
  const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
  const matches = new MatchService({
    runtime,
    questions: repository(),
    parameters,
    onError: errors,
    ...options,
  });
  const rooms = new RoomService({
    runtime,
    quiz: matches,
    onError: errors,
    onChange: (after) => {
      order.push('publish');
      if (options.observerFails?.()) throw new Error('Falha no observador.');
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
  const entry = await rooms.create(actors[0]!, profile, roster.settings);
  await rooms.join(actors[1]!, entry.code, { ...profile, nickname: 'Bia' });
  const room = rooms.registry.byId(entry.roomId)!;
  await rooms.start(actors[0]!, room.id);
  function game() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game;
  }
  async function ready() {
    for (const actor of actors)
      await matches.execute(room, actor, { kind: 'ready', ...matchContext(game().state) });
  }
  async function choose() {
    const stage = game().state.stage;
    if (stage.phase !== 'category-selection') throw new Error('Tema esperado.');
    const actor = actors.find((item) => item.playerId === stage.offer.chooserPlayerId)!;
    return matches.execute(room, actor, {
      kind: 'choose-category',
      ...matchContext(game().state),
      category: stage.offer.categories[0]!,
    });
  }
  async function advance() {
    await time.advanceTo(matchTimer(game().state)!.deadlineAt);
  }
  async function open() {
    await ready();
    await choose();
    await advance();
  }
  function answer(index = 0, correct = true) {
    const state = game().state,
      stage = state.stage;
    if (stage.phase !== 'question-open' && stage.phase !== 'reveal')
      throw new Error('Pergunta esperada.');
    return matches.execute(room, actors[index]!, {
      kind: 'answer',
      ...matchContext(state),
      questionId: stage.question.publicQuestion.questionId,
      optionId: correct
        ? stage.question.correctOptionId
        : stage.question.publicQuestion.options.find(
            (option) => option.optionId !== stage.question.correctOptionId,
          )!.optionId,
    });
  }
  return {
    runtime,
    time,
    scheduled,
    order,
    views,
    errors,
    parameters,
    matches,
    rooms,
    actors,
    room,
    game,
    ready,
    choose,
    advance,
    open,
    answer,
  };
}

describe('serviço de partida na fila da sala', () => {
  it('repetir prontidão não muda versão, timer ou fotografia', async () => {
    const s = await setup();
    const command = { kind: 'ready' as const, ...matchContext(s.game().state) };
    await s.matches.execute(s.room, s.actors[0]!, command);
    const before = s.room.snapshot(),
      count = s.views.length,
      timers = s.scheduled.length;
    await s.matches.execute(s.room, s.actors[0]!, command);
    expect(s.room.snapshot()).toEqual(before);
    expect(s.views).toHaveLength(count);
    expect(s.scheduled).toHaveLength(timers);
  });
  it('mede o recebimento na fila e recusa resposta no prazo exato', async () => {
    const s = await setup();
    await s.open();
    const deadline = matchTimer(s.game().state)!.deadlineAt;
    const now = vi.spyOn(s.runtime.clock, 'now');
    now.mockReturnValue(deadline - 1);
    await s.answer(0);
    now.mockReturnValue(deadline);
    await expect(s.answer(1)).rejects.toMatchObject({ code: 'DEADLINE_EXPIRED' });
    await s.advance();
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
  });
  it('recusa iniciar sem estoque suficiente antes de criar o agregado', () => {
    const { runtime } = createTestRuntime();
    const matches = new MatchService({ runtime, questions: { ...repository(), list: () => [] } });
    expect(() => matches.validateStart(roster)).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_QUESTIONS' }),
    );
  });
  it('percorre seis perguntas do seletor e termina só o protótipo clássico', async () => {
    const s = await setup();
    await s.open();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const stage = s.game().state.stage;
      expect(stage.phase).toBe('question-open');
      if (stage.phase !== 'question-open') throw new Error();
      seen.add(stage.question.editorialQuestionId);
      await s.answer(0);
      await s.answer(1, false);
      expect(s.game().state.stage.phase).toBe('reveal');
      await s.advance();
      if (i < 5) await s.advance();
    }
    expect(seen.size).toBe(6);
    expect(s.game().state.stage.phase).toBe('round-results');
    await s.advance();
    expect(s.game().state.stage.phase).toBe('prototype-complete');
    expect(s.game().state.history).toHaveLength(6);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([600, 0]);
    expect(matchTimer(s.game().state)).toBeNull();
    expect(s.time.pendingCount).toBe(1); // Only the room max-age timer remains.
    expect(s.views.at(-1)?.state).toMatchObject({
      status: 'match',
      match: { stage: { phase: 'prototype-complete' } },
    });
  });
  it('publica após confirmação e agendamento, com elenco e parâmetros isolados', async () => {
    const s = await setup();
    s.order.length = 0;
    await s.ready();
    expect(s.order.indexOf('cancel')).toBeLessThan(s.order.indexOf('schedule'));
    expect(s.order.lastIndexOf('schedule')).toBeLessThan(s.order.lastIndexOf('publish'));
    expect(s.views.at(-1)?.stateVersion).toBe(s.room.snapshot().stateVersion);
    s.parameters.classic.correctPoints = 999;
    s.parameters.timings.readingMs = 999;
    expect(s.game().state.rules.parameters.classic.correctPoints).toBe(100);
    expect(s.game().state.rules.parameters.timings.readingMs).toBe(3000);
    const copy = s.game();
    copy.state.roster.players[0]!.profile.nickname = 'Outro';
    expect(s.game().state.roster.players[0]!.profile.nickname).toBe('Ana');
    await expect(
      s.room.runExclusive((tx) => {
        if (tx.state.phase.status === 'match' && tx.state.phase.game) {
          tx.state.phase.game.state.rounds[0]!.roundId = roundIdSchema.parse(uuid(999));
          tx.touch();
        }
      }),
    ).rejects.toThrow('imutáveis');
  });
  it('avança por ausência, escolhe tema no prazo e calcula zero sem respostas', async () => {
    const s = await setup();
    await s.advance();
    expect(s.game().state.stage.phase).toBe('category-selection');
    await s.advance();
    expect(s.game().state.stage.phase).toBe('question-reading');
    await s.advance();
    expect(s.game().state.stage.phase).toBe('question-open');
    await s.advance();
    expect(s.game().state.stage.phase).toBe('reveal');
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([0, 0]);
  });
  it('serializa respostas simultâneas e não credita comando repetido', async () => {
    const s = await setup();
    await s.open();
    const results = await Promise.allSettled([s.answer(0), s.answer(0), s.answer(1)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(s.game().state.history).toHaveLength(1);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    const before = s.room.snapshot();
    await expect(s.answer(0)).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    expect(s.room.snapshot()).toEqual(before);
  });
  it('descarta callback cancelado de pergunta anterior e de partida anterior', async () => {
    const s = await setup();
    await s.open();
    const oldTimer = matchTimer(s.game().state)!;
    const old = s.scheduled.findLast((task) => task.deadline === oldTimer.deadlineAt)!;
    await s.answer(0);
    await s.answer(1);
    await s.advance();
    await s.advance();
    expect(old.cancel).toHaveBeenCalled();
    const before = s.room.snapshot();
    await old.task();
    expect(s.room.snapshot()).toEqual(before);
    const oldMatch = s.game().state.roster.matchId;
    await s.rooms.returnToLobby(s.actors[0]!, s.room.id, oldMatch);
    await s.rooms.start(s.actors[0]!, s.room.id);
    const next = s.room.snapshot();
    await old.task();
    expect(s.game().state.roster.matchId).not.toBe(oldMatch);
    expect(s.room.snapshot()).toEqual(next);
  });
  it.each(['lobby', 'closed'] as const)('cancela timer ao sair para %s', async (destination) => {
    const s = await setup();
    const timer = matchTimer(s.game().state)!;
    const scheduled = s.scheduled.findLast((task) => task.deadline === timer.deadlineAt)!;
    if (destination === 'lobby')
      await s.rooms.returnToLobby(s.actors[0]!, s.room.id, s.game().state.roster.matchId);
    else await s.rooms.close(s.room.id);
    expect(scheduled.cancel).toHaveBeenCalledTimes(1);
    const before = s.room.snapshot();
    await scheduled.task();
    expect(s.room.snapshot()).toEqual(before);
    expect(s.time.pendingCount).toBe(destination === 'closed' ? 0 : 1);
  });
  it('não confirma seleção parcialmente processada quando a preparação falha', async () => {
    const s = await setup();
    await s.ready();
    const before = s.room.snapshot(),
      original = QuestionSelection.prototype.currentQuestion;
    const prepare = vi
      .spyOn(QuestionSelection.prototype, 'currentQuestion')
      .mockImplementationOnce(function (this: QuestionSelection, roundId) {
        original.call(this, roundId);
        throw new Error('Falha após consumir a pergunta no rascunho.');
      });
    await expect(s.choose()).rejects.toThrow('Falha após consumir');
    expect(s.room.snapshot()).toEqual(before);
    await s.choose();
    expect(s.game().state.stage.phase).toBe('question-reading');
    expect(QuestionSelection.resume(s.game().selection, s.runtime).history()).toHaveLength(1);
    expect(prepare).toHaveBeenCalledTimes(2);
  });
  it('reverte falha na última resposta e aceita nova tentativa sem duplicar pontos', async () => {
    let fail = true;
    const resolve = vi.fn((...args: Parameters<typeof classicStrategy.resolve>) => {
      const result = classicStrategy.resolve(...args);
      if (fail) throw new Error('Falha após calcular.');
      return result;
    });
    const s = await setup({ strategies: new StrategyRegistry([{ mode: 'classic', resolve }]) });
    await s.open();
    await s.answer(0);
    const before = s.room.snapshot();
    await expect(s.answer(1)).rejects.toThrow('Falha após calcular');
    expect(s.room.snapshot()).toEqual(before);
    fail = false;
    await s.answer(1);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    expect(s.game().state.history).toHaveLength(1);
  });
  it('repete timer após falha transitória e recupera a fila sem reaplicar placar', async () => {
    const resolve = vi.fn(classicStrategy.resolve).mockImplementationOnce(() => {
      throw new Error('Falha transitória.');
    });
    const s = await setup({ strategies: new StrategyRegistry([{ mode: 'classic', resolve }]) });
    await s.open();
    await s.answer(0);
    const deadline = matchTimer(s.game().state)!.deadlineAt;
    await s.advance();
    expect(s.game().state.stage.phase).toBe('question-open');
    expect(s.game().state.history).toHaveLength(0);
    expect(s.errors).toHaveBeenCalledTimes(1);
    await s.time.advanceTo(deadline + 1000);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
    expect(s.game().state.history).toHaveLength(1);
  });
  it('falha de publicação não desfaz a confirmação e presença não renova prazo', async () => {
    let fail = false;
    const s = await setup({ observerFails: () => fail });
    await s.open();
    const timer = matchTimer(s.game().state)!,
      before = s.scheduled.length;
    await s.rooms.reconnect(s.actors[0]!);
    expect(s.scheduled.length).toBe(before + 1); // Room lifecycle only; no new match timer.
    expect(matchTimer(s.game().state)).toEqual(timer);
    await s.answer(0);
    fail = true;
    await s.answer(1);
    expect(s.errors).toHaveBeenCalledTimes(1);
    expect(s.game().state.history).toHaveLength(1);
    fail = false;
    await s.advance();
    expect(s.game().state.stage.phase).toBe('question-reading');
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
  });
  it('revalida conexão na fila e proíbe espectador, inclusive nas visões', async () => {
    let current = true;
    const s = await setup({ isCurrentActor: () => current });
    await s.open();
    const spectator = { playerId: playerIdSchema.parse(uuid(99)), connectionId: 'spectator' };
    await s.rooms.join(spectator, s.room.code, { ...profile, nickname: 'Cris' });
    await expect(
      s.matches.execute(s.room, spectator, { kind: 'ready', ...matchContext(s.game().state) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const spectatorView = buildPlayerView(s.room.snapshot(), spectator.playerId, s.time.now())!;
    expect(spectatorView.state).toMatchObject({
      status: 'match',
      match: { stage: { ownAnswer: { status: 'unavailable' } } },
    });
    const blocker = s.room.runExclusive(() => {
      current = false;
    });
    const action = s.answer(0);
    await blocker;
    await expect(action).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(s.game().state.stage).toMatchObject({ answers: [] });
  });
  it('projeta leitura sem opções, respostas sem gabarito e revelação sem campos privados', async () => {
    const s = await setup();
    await s.ready();
    await s.choose();
    let view = buildPlayerView(s.room.snapshot(), players[0]!, s.time.now())!;
    expect(JSON.stringify(view)).not.toMatch(
      /correctOptionId|explanation|editorial|options|checkpoint|source|receivedAt/,
    );
    await s.advance();
    await s.answer(0);
    view = buildPlayerView(s.room.snapshot(), players[1]!, s.time.now())!;
    expect(view.state).toMatchObject({
      status: 'match',
      match: { stage: { ownAnswer: { status: 'pending' } } },
    });
    expect(JSON.stringify(view)).not.toMatch(/correctOptionId|explanation|editorial|receivedAt/);
    await s.answer(1);
    view = buildPlayerView(s.room.snapshot(), players[1]!, s.time.now())!;
    expect(view.state).toMatchObject({ status: 'match', match: { stage: { phase: 'reveal' } } });
    expect(JSON.stringify(view)).not.toMatch(/editorial|receivedAt|fixture|recordIndex/);
    if (view.state.status === 'match')
      expect(matchViewSchema.safeParse(view.state.match).success).toBe(true);
  });
});

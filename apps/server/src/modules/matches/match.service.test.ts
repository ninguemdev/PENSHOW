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
import { contentInterruption } from '../questions/selection-policy.js';
import { RoomService, type RoomActor } from '../rooms/room.service.js';
import { buildPlayerView } from '../views/build-player-view.js';
import { prototypeParametersSchema, PROTOTYPE_PARAMETERS } from '../scoring/match-rules.js';
import { MatchService, matchContext } from './match.service.js';
import { matchTimer } from './match.domain.js';
import { currentPressureTurn } from './match.domain.js';
import { StrategyRegistry, classicStrategy, theftStrategy } from './match-strategy.js';
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
    mode?: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure';
    playerCount?: number;
    questionStock?: number;
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
    questions: repository(
      options.mode !== undefined && options.mode !== 'classic',
      Math.max(3, options.playerCount ?? 2, options.questionStock ?? 0),
    ),
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
  const actors = Array.from({ length: options.playerCount ?? 2 }, (_, index) => ({
    playerId: playerIdSchema.parse(uuid(index + 1)),
    connectionId: `socket-${index}`,
  }));
  const entry = await rooms.create(actors[0]!, profile, {
    ...roster.settings,
    maxPlayers: Math.max(3, actors.length),
  });
  for (const actor of actors.slice(1))
    await rooms.join(actor, entry.code, { ...profile, nickname: 'Bia' });
  const room = rooms.registry.byId(entry.roomId)!;
  await rooms.start(actors[0]!, room.id, options.mode);
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
    if (game().state.stage.phase === 'wager-selection') await advance();
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
  function wager(index: number, amount: number) {
    const state = game().state;
    if (state.stage.phase !== 'wager-selection') throw new Error('Aposta esperada.');
    return matches.execute(room, actors[index]!, {
      kind: 'wager',
      ...matchContext(state),
      questionId: state.stage.question.publicQuestion.questionId,
      amount,
    });
  }
  function target(actor: number, target: number) {
    const state = game().state;
    if (!('question' in state.stage)) throw new Error('Pergunta esperada.');
    return matches.execute(room, actors[actor]!, {
      kind: 'target',
      ...matchContext(state),
      questionId: state.stage.question.publicQuestion.questionId,
      targetPlayerId: actors[target]!.playerId,
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
    wager,
    target,
  };
}

async function qualified(questionStock = 12) {
  const s = await setup({ questionStock });
  await s.open();
  for (let i = 0; i < 6; i++) {
    await s.answer(0);
    await s.answer(1, false);
    await s.advance();
    if (i < 5) await s.advance();
  }
  await s.advance();
  return s;
}

async function finishClassic(s: Awaited<ReturnType<typeof setup>>, actors = s.actors) {
  for (const actor of actors)
    await s.matches.execute(s.room, actor, { kind: 'ready', ...matchContext(s.game().state) });
  const offer = s.game().state.stage;
  if (offer.phase !== 'category-selection') throw new Error();
  await s.matches.execute(
    s.room,
    actors.find((actor) => actor.playerId === offer.offer.chooserPlayerId)!,
    {
      kind: 'choose-category',
      ...matchContext(s.game().state),
      category: offer.offer.categories[0]!,
    },
  );
  for (let question = 0; question < 6; question++) {
    await s.advance();
    const stage = s.game().state.stage;
    if (stage.phase !== 'question-open') throw new Error();
    for (const [index, actor] of actors.entries()) {
      await s.matches.execute(s.room, actor, {
        kind: 'answer',
        ...matchContext(s.game().state),
        questionId: stage.question.publicQuestion.questionId,
        optionId:
          question >= index
            ? stage.question.correctOptionId
            : stage.question.publicQuestion.options.find(
                (option) => option.optionId !== stage.question.correctOptionId,
              )!.optionId,
      });
    }
    await s.advance();
  }
  await s.advance();
}

async function finishFinal(
  s: Awaited<ReturnType<typeof setup>>,
  actors = s.actors,
  winnerIndex = actors.length - 1,
) {
  await s.matches.startFinal(s.room, actors[0]!, s.game().state.roster.matchId);
  for (const actor of actors)
    await s.matches.execute(s.room, actor, { kind: 'ready', ...matchContext(s.game().state) });
  let oldTargetTimer: (typeof s.scheduled)[number] | undefined;
  const winner = actors[winnerIndex]!;
  // Eliminate second, third, ... and first last, independently of the score order.
  const victims = [...actors.slice(1), actors[0]!].filter((actor) => actor !== winner);
  for (const victim of victims) {
    while (
      s.game().state.final!.finalists.find((player) => player.playerId === victim.playerId)!.lives >
      0
    ) {
      await s.advance();
      const state = s.game().state;
      const open = state.final!.stage;
      if (open.phase !== 'final-question-open') throw new Error();
      await s.matches.execute(s.room, winner, {
        kind: 'answer',
        ...matchContext(state),
        questionId: open.question.publicQuestion.questionId,
        optionId: open.question.correctOptionId,
      });
      const targetTimer = matchTimer(s.game().state)!;
      oldTargetTimer = s.scheduled.findLast((task) => task.deadline === targetTimer.deadlineAt)!;
      await s.matches.execute(s.room, winner, {
        kind: 'target',
        ...matchContext(s.game().state),
        questionId: open.question.publicQuestion.questionId,
        targetPlayerId: victim.playerId,
      });
      await s.advance();
    }
  }
  return oldTargetTimer!;
}

describe('pódio, histórico e revanche', () => {
  it('quarto colocado vence pelas vidas; pódio segue eliminações e resumo conserva o placar histórico', async () => {
    const s = await setup({ playerCount: 4, questionStock: 32 });
    await finishClassic(s);
    const before = s.game().state;
    expect(before.finalEntry).toMatchObject({ status: 'ready' });
    await finishFinal(s);
    const view = buildPlayerView(s.room.snapshot(), s.actors[3]!.playerId, s.time.now())!;
    if (view.state.status !== 'match' || view.state.match.stage.phase !== 'podium')
      throw new Error();
    expect(view.state.match.stage.standings).toEqual([
      s.actors[3]!.playerId,
      s.actors[0]!.playerId,
      s.actors[2]!.playerId,
      s.actors[1]!.playerId,
    ]);
    expect(view.state.match.stage.finalists[3]).toMatchObject({
      rank: 4,
      initialLives: 2,
      lives: 2,
      status: 'active',
    });
    expect(view.state.match.scoreboard).toEqual(before.scoreboard);
    expect(view.state.match.roundSummaries).toEqual([
      {
        round: before.rounds[0],
        status: 'completed',
        questionsPlayed: 6,
        players: before.scoreboard.map((score) => ({
          playerId: score.playerId,
          pointsBefore: 0,
          pointsAfter: score.points,
          pointsDelta: score.points,
          correctAnswers: score.correctAnswers,
        })),
      },
    ]);
    expect(JSON.stringify(view)).not.toMatch(
      /receivedAt|editorial|checkpoint|source|themeChoiceQueue|leftMatch/,
    );
  });

  it('duas partidas na mesma sala: promove espectador, retira quem saiu, continua fila e rejeita comandos/timers antigos', async () => {
    const s = await setup({ playerCount: 4, questionStock: 32 });
    await finishClassic(s);
    const firstQueue = QuestionSelection.resume(
      s.game().selection,
      s.runtime,
    ).choiceQueueForRematch();
    const newcomer = { playerId: playerIdSchema.parse(uuid(90)), connectionId: 'socket-newcomer' };
    await s.rooms.join(newcomer, s.room.code, { ...profile, nickname: 'Nova' });
    expect(s.room.snapshot().members.at(-1)?.role).toBe('spectator');
    const oldTimer = await finishFinal(s);
    const oldState = s.game().state;
    const oldRecord = oldState.final!.history.at(-1)!;
    await s.rooms.leave(s.actors[1]!, s.room.id);
    await s.rooms.returnToLobby(s.actors[0]!, s.room.id, oldState.roster.matchId, {
      requireFinished: true,
    });
    const lobby = s.room.snapshot();
    expect(lobby.phase).toEqual({ status: 'lobby' });
    expect(lobby.themeChoiceQueue).toEqual(firstQueue);
    expect(lobby.members.find((member) => member.playerId === newcomer.playerId)?.role).toBe(
      'player',
    );
    expect(lobby.members.some((member) => member.playerId === s.actors[1]!.playerId)).toBe(false);
    expect(s.rooms.registry.roomOf(s.actors[1]!.playerId)).toBeUndefined();
    expect(lobby.members[0]?.profile).toEqual(oldState.roster.players[0]?.profile);
    expect(oldTimer.cancel).toHaveBeenCalled();
    const actors = [s.actors[0]!, s.actors[2]!, s.actors[3]!, newcomer];
    await s.rooms.start(actors[0]!, s.room.id);
    const fresh = s.game().state;
    expect(fresh.roster.matchId).not.toBe(oldState.roster.matchId);
    expect(fresh.rounds[0]!.roundId).not.toBe(oldState.rounds[0]!.roundId);
    expect(fresh.history).toEqual([]);
    expect(fresh.final).toBeNull();
    expect(fresh.finalEntry).toBeNull();
    expect(fresh.wagers).toEqual([]);
    expect(
      fresh.scoreboard.every((score) => score.points === 0 && score.correctAnswers === 0),
    ).toBe(true);
    const queue = QuestionSelection.resume(s.game().selection, s.runtime).choiceQueueForRematch();
    expect(queue.pending[0]).toBe(firstQueue.pending.find((id) => id !== s.actors[1]!.playerId));
    expect([...queue.pending, ...queue.served]).toContain(newcomer.playerId);
    expect([...queue.pending, ...queue.served]).not.toContain(s.actors[1]!.playerId);
    const snapshot = s.room.snapshot();
    await oldTimer.task();
    await expect(
      s.matches.execute(s.room, actors[0]!, {
        kind: 'answer',
        matchId: oldState.roster.matchId,
        roundId: oldState.final!.round.roundId,
        questionId: oldRecord.questionId,
        optionId: oldRecord.accepted.optionId,
      }),
    ).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    await expect(
      s.rooms.returnToLobby(actors[0]!, s.room.id, oldState.roster.matchId, {
        requireFinished: true,
      }),
    ).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    expect(s.room.snapshot()).toEqual(snapshot);
    await finishClassic(s, actors);
    await finishFinal(s, actors);
    expect(s.game().state.final!.stage.phase).toBe('podium');
    expect(s.room.id).toBe(lobby.roomId);
    expect(s.errors).not.toHaveBeenCalled();
  });

  it('interrupção sem vencedor preserva histórico e dano confirmado, sem pódio', async () => {
    const s = await qualified();
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    await s.ready();
    await s.advance();
    const open = s.game().state.final!.stage;
    if (open.phase !== 'final-question-open') throw new Error();
    await s.matches.execute(s.room, s.actors[0]!, {
      kind: 'answer',
      ...matchContext(s.game().state),
      questionId: open.question.publicQuestion.questionId,
      optionId: open.question.publicQuestion.options.find(
        (option) => option.optionId !== open.question.correctOptionId,
      )!.optionId,
    });
    vi.spyOn(QuestionSelection.prototype, 'currentFinalQuestion').mockReturnValue(
      contentInterruption(),
    );
    await s.advance();
    const view = buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now())!;
    if (view.state.status !== 'match') throw new Error();
    expect(view.state.match.stage).toEqual({
      phase: 'interrupted',
      reason: 'insufficient-questions',
    });
    expect(view.state.match.roundSummaries?.[0]).toMatchObject({
      status: 'completed',
      questionsPlayed: 6,
    });
    expect(s.game().state.final!.finalists[0]!.lives).toBe(4);
    expect(JSON.stringify(view)).not.toContain('standings');
  });
});
type Setup = Awaited<ReturnType<typeof setup>>;
function finalAnswer(s: Setup, index = 0, correct = true) {
  const state = s.game().state,
    stage = state.final?.stage;
  if (!stage || !('question' in stage)) throw new Error();
  return s.matches.execute(s.room, s.actors[index]!, {
    kind: 'answer',
    ...matchContext(state),
    questionId: stage.question.publicQuestion.questionId,
    optionId: stage.question.publicQuestion.options.find(
      (option) => (option.optionId === stage.question.correctOptionId) === correct,
    )!.optionId,
  });
}
function finalTarget(s: Setup, actor = 0, target = 1) {
  const state = s.game().state,
    stage = state.final?.stage;
  if (!stage || !('question' in stage)) throw new Error();
  return s.matches.execute(s.room, s.actors[actor]!, {
    kind: 'target',
    ...matchContext(state),
    questionId: stage.question.publicQuestion.questionId,
    targetPlayerId: s.actors[target]!.playerId,
  });
}
async function finalOpen(s: Setup) {
  await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
  await s.ready();
  await s.advance();
}

describe('serviço de partida na fila da sala', () => {
  it.each(['before', 'at'] as const)(
    '12 jogadores: alvo %s do prazo, queda e callbacks antigos conservam uma única resolução',
    async (when) => {
      const s = await setup({ mode: 'theft', playerCount: 12 });
      await s.open();
      await Promise.all(s.actors.map((_, index) => s.answer(index)));
      const timer = matchTimer(s.game().state)!;
      const callback = s.scheduled.findLast((entry) => entry.deadline === timer.deadlineAt)!;
      const now = vi
        .spyOn(s.runtime.clock, 'now')
        .mockReturnValue(timer.deadlineAt - (when === 'before' ? 1 : 0));
      let results;
      try {
        results = await Promise.allSettled([
          s.target(0, 1),
          s.target(0, 2),
          s.rooms.disconnect(s.actors[0]!),
          callback.task(),
        ]);
      } finally {
        now.mockRestore();
      }
      if (when === 'before') expect(results[0]?.status).toBe('fulfilled');
      else
        expect(results[0]).toMatchObject({
          status: 'rejected',
          reason: { code: 'DEADLINE_EXPIRED' },
        });
      expect(s.game().state.stage.phase).toBe('reveal');
      expect(s.game().state.history).toHaveLength(1);
      const scores = s.game().state.scoreboard;
      expect(scores.reduce((sum, score) => sum + score.points, 0)).toBe(1200);
      await callback.task();
      expect(s.game().state.scoreboard).toEqual(scores);
      await s.rooms.close(s.room.id);
      const closed = s.room.snapshot();
      expect(s.time.pendingCount).toBe(0);
      await callback.task();
      expect(s.room.snapshot()).toEqual(closed);
    },
  );
  it.each(['classic', 'speed', 'wager', 'theft', 'pressure'] as const)(
    '%s: sala vazia resolve só a pergunta atual, aguarda e retoma sem dano/placar duplicados',
    async (mode) => {
      const s = await setup({ mode });
      await s.open();
      const deadline = matchTimer(s.game().state)!.deadlineAt;
      const old = s.scheduled.findLast((task) => task.deadline === deadline)!;
      for (const actor of s.actors) await s.rooms.disconnect(actor);
      const emptySince = s.room.snapshot().emptySince!;
      await s.time.advanceTo(deadline);
      expect(s.game().state.stage.phase).toBe('reveal');
      expect(s.game().state.history).toHaveLength(1);
      const scores = s.game().state.scoreboard;
      await s.advance();
      expect(s.game().suspended).toBe(true);
      await s.time.advanceTo(emptySince + 119999);
      expect(s.game().state.history).toHaveLength(1);
      expect(QuestionSelection.resume(s.game().selection, s.runtime).history()).toHaveLength(1);
      const reconnect = { ...s.actors[0]!, connectionId: 'returned' };
      await s.rooms.reconnect(reconnect);
      const waiting = buildPlayerView(s.room.snapshot(), reconnect.playerId, s.time.now())!;
      expect(waiting.state).toMatchObject({ status: 'match', match: { waitingForPlayers: true } });
      await s.time.advanceTo(s.time.now());
      expect(s.game().suspended).toBeUndefined();
      expect(s.game().state.stage.phase).toBe(
        mode === 'wager' ? 'wager-selection' : 'question-reading',
      );
      expect(s.game().state.scoreboard).toEqual(scores);
      const snapshot = s.room.snapshot();
      await old.task();
      expect(s.room.snapshot()).toEqual(snapshot);
      await expect(
        s.matches.execute(s.room, s.actors[0]!, { kind: 'ready', ...matchContext(s.game().state) }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(s.errors).not.toHaveBeenCalled();
    },
  );
  it.each(['instructions', 'category-selection', 'wager-selection'] as const)(
    '%s: prazo termina sem expor outra pergunta e retorno executa só o passo pendente',
    async (phase) => {
      const s = await setup({ mode: phase === 'wager-selection' ? 'wager' : 'classic' });
      if (phase !== 'instructions') await s.ready();
      if (phase === 'wager-selection') {
        await s.choose();
        await s.wager(0, 0);
      }
      const stage = s.game().state.stage;
      for (const actor of s.actors) await s.rooms.disconnect(actor);
      await s.advance();
      expect(s.game().suspended).toBe(true);
      expect(s.game().state.stage).toEqual(stage);
      const history = QuestionSelection.resume(s.game().selection, s.runtime).history();
      expect(history).toHaveLength(phase === 'wager-selection' ? 1 : 0);
      await s.rooms.reconnect(s.actors[0]!);
      await s.time.advanceTo(s.time.now());
      expect(s.game().suspended).toBeUndefined();
      expect(s.game().state.stage.phase).toBe(
        phase === 'instructions' ? 'category-selection' : 'question-reading',
      );
      if (phase === 'wager-selection')
        expect(s.game().state.wagers).toMatchObject([
          { playerId: s.actors[0]!.playerId, amount: 0 },
        ]);
    },
  );
  it('retorno antes de fechar a janela conserva abertura, prazo e resposta já recebida', async () => {
    const s = await setup();
    await s.open();
    await s.answer(0);
    const original = s.game().state.stage;
    for (const actor of s.actors) await s.rooms.disconnect(actor);
    await s.time.advanceTo(matchTimer(s.game().state)!.deadlineAt - 1);
    await s.rooms.reconnect(s.actors[0]!);
    expect(s.game().state.stage).toEqual(original);
    await s.advance();
    expect(s.game().state.scoreboard.map((score) => score.points)).toEqual([100, 0]);
    expect(s.game().state.history).toHaveLength(1);
  });
  it('final: instruções vazias aguardam retorno e ausência de alvo conserva D03 sem restaurar ataque', async () => {
    const s = await qualified();
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    for (const actor of s.actors) await s.rooms.disconnect(actor);
    await s.advance();
    expect(s.game().suspended).toBe(true);
    expect(s.game().state.final!.stage.phase).toBe('final-instructions');
    await s.rooms.reconnect(s.actors[0]!);
    await s.time.advanceTo(s.time.now());
    await s.advance();
    const open = s.game().state.final!.stage;
    if (open.phase !== 'final-question-open') throw new Error();
    await s.matches.execute(s.room, s.actors[0]!, {
      kind: 'answer',
      ...matchContext(s.game().state),
      questionId: open.question.publicQuestion.questionId,
      optionId: open.question.correctOptionId,
    });
    await s.rooms.disconnect(s.actors[0]!);
    await s.advance();
    expect(s.game().state.final!.stage.phase).toBe('final-no-target-pending');
    await s.rooms.reconnect(s.actors[0]!);
    expect(s.game().state.final!.finalists.map((player) => player.lives)).toEqual([5, 4]);
    expect(s.game().state.final!.stage.phase).toBe('final-no-target-pending');
    expect(s.game().state.final!.history).toEqual([]);
  });
  it('na final vazia, resolução conserva dano e aguarda próxima pergunta; D02/D03 não viram fallback', async () => {
    const s = await qualified();
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    await s.ready();
    await s.advance();
    const open = s.game().state.final!.stage;
    if (open.phase !== 'final-question-open') throw new Error();
    await s.matches.execute(s.room, s.actors[0]!, {
      kind: 'answer',
      ...matchContext(s.game().state),
      questionId: open.question.publicQuestion.questionId,
      optionId: open.question.publicQuestion.options.find(
        (option) => option.optionId !== open.question.correctOptionId,
      )!.optionId,
    });
    for (const actor of s.actors) await s.rooms.disconnect(actor);
    await s.advance();
    expect(s.game().suspended).toBe(true);
    expect(s.game().state.final!.history).toHaveLength(1);
    expect(s.game().state.final!.finalists[0]!.lives).toBe(4);
    await s.rooms.reconnect(s.actors[0]!);
    await s.time.advanceTo(s.time.now());
    expect(s.game().state.final!.stage.phase).toBe('final-question-reading');
    expect(s.game().state.final!.finalists[0]!.lives).toBe(4);
    for (const actor of s.actors) await s.rooms.disconnect(actor);
    await s.advance();
    await s.advance();
    expect(s.game().state.final!.stage.phase).toBe('final-no-answer-pending');
    expect(s.game().state.final!.history).toHaveLength(1);
  });
  it('final: valida início, preserva conversão e não reinicia vidas com outro ID de ação', async () => {
    const s = await qualified();
    const entry = structuredClone(s.game().state.finalEntry);
    await expect(
      s.matches.startFinal(s.room, s.actors[1]!, s.game().state.roster.matchId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    const before = s.room.snapshot();
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    expect(s.room.snapshot()).toEqual(before);
    expect(s.game().state.finalEntry).toEqual(entry);
    await expect(
      s.rooms.returnToLobby(s.actors[0]!, s.room.id, s.game().state.roster.matchId, {
        requireFinished: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    await s.ready();
    await s.advance();
    await finalAnswer(s, 0, false);
    await s.rooms.disconnect(s.actors[0]!);
    await s.rooms.reconnect(s.actors[0]!);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([4, 4]);
    await s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([4, 4]);
    expect(s.errors).not.toHaveBeenCalled();
  });
  it('final: primeiro erro concorrente fecha as tentativas e timer antigo não aplica outro dano', async () => {
    const s = await qualified();
    await finalOpen(s);
    const old = s.scheduled.at(-1)!;
    const results = await Promise.allSettled([finalAnswer(s, 0, false), finalAnswer(s, 1, true)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([4, 4]);
    await old.task();
    expect(s.game().state.final?.history).toHaveLength(1);
    expect(s.game().state.scoreboard.map((row) => row.points)).toEqual([600, 0]);
    expect(s.errors).not.toHaveBeenCalled();
  });
  it('final: dois acertos concorrentes, alvo ausente e ataque repetido geram somente uma perda', async () => {
    const s = await qualified();
    await finalOpen(s);
    const results = await Promise.allSettled([finalAnswer(s), finalAnswer(s, 1)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    await expect(finalTarget(s, 1, 0)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await s.rooms.disconnect(s.actors[1]!);
    const attacks = await Promise.allSettled([finalTarget(s), finalTarget(s)]);
    expect(attacks.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([5, 3]);
    expect(s.game().state.final?.history).toHaveLength(1);
    expect(s.errors).not.toHaveBeenCalled();
  });
  it.each(['D02', 'D03'] as const)(
    'final: %s pendente suspende sem dano ou campeão e permite encerrar teste',
    async (decision) => {
      const s = await qualified();
      await finalOpen(s);
      if (decision === 'D03') await finalAnswer(s);
      await s.advance();
      expect(s.game().state.final?.stage.phase).toBe(
        decision === 'D02' ? 'final-no-answer-pending' : 'final-no-target-pending',
      );
      expect(matchTimer(s.game().state)).toBeNull();
      expect(s.game().state.final?.history).toHaveLength(0);
      expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([5, 4]);
      await s.rooms.returnToLobby(s.actors[0]!, s.room.id, s.game().state.roster.matchId, {
        requireFinished: true,
      });
      expect(s.room.snapshot().phase.status).toBe('lobby');
      expect(s.errors).not.toHaveBeenCalled();
    },
  );
  it('final: quatro ataques eliminam o segundo e encerram pelo único sobrevivente, com perguntas inéditas', async () => {
    const s = await qualified();
    await finalOpen(s);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const stage = s.game().state.final!.stage;
      if (stage.phase !== 'final-question-open') throw new Error();
      seen.add(stage.question.editorialQuestionId);
      await finalAnswer(s);
      await finalTarget(s);
      await s.advance();
      if (i < 3) await s.advance();
    }
    expect(seen.size).toBe(4);
    expect(s.game().state.final?.stage.phase).toBe('podium');
    expect(s.game().state.final?.finalists).toMatchObject([
      { status: 'active', lives: 5 },
      { status: 'eliminated', lives: 0, eliminationOrder: 1 },
    ]);
    expect(s.views.at(-1)?.state).toMatchObject({
      status: 'match',
      match: {
        progress: { questionCount: null },
        stage: { phase: 'podium', standings: s.actors.map((actor) => actor.playerId) },
      },
    });
    expect(s.game().state.scoreboard.map((row) => row.points)).toEqual([600, 0]);
    expect(s.errors).not.toHaveBeenCalled();
  });
  it('final: estoque insuficiente mantém o encerramento intacto, sem final parcial', async () => {
    const s = await qualified(3),
      before = s.room.snapshot();
    await expect(
      s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_QUESTIONS' });
    expect(s.room.snapshot()).toEqual(before);
  });
  it('final: falha ao preparar a próxima pergunta mantém a perda confirmada e retoma sem duplicá-la', async () => {
    const s = await qualified();
    await finalOpen(s);
    await finalAnswer(s, 0, false);
    vi.spyOn(QuestionSelection.prototype, 'currentFinalQuestion').mockImplementationOnce(() => {
      throw new Error('Falha de preparação.');
    });
    await s.advance();
    expect(s.game().state.final?.stage.phase).toBe('final-resolution');
    expect(s.game().state.final?.history).toHaveLength(1);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([4, 4]);
    await s.time.advanceTo(s.time.now() + 1000);
    expect(s.game().state.final?.stage.phase).toBe('final-question-reading');
    expect(s.game().state.final?.history).toHaveLength(1);
    expect(s.game().state.final?.finalists.map((player) => player.lives)).toEqual([4, 4]);
    expect(s.errors).toHaveBeenCalledOnce();
  });
  it.each([2, 4, 12])(
    'dinamite: %i participantes recebem dois turnos e perguntas inéditas em ciclos inversos',
    async (count) => {
      const s = await setup({ mode: 'pressure', playerCount: count });
      const order = s.game().state.pressureOrder;
      expect(new Set(order).size).toBe(count);
      expect(order).not.toEqual(s.actors.map((actor) => actor.playerId));
      await s.open();
      const seen = new Set<string>(),
        owners: string[] = [];
      for (let turn = 0; turn < count * 2; turn++) {
        const state = s.game().state,
          stage = state.stage,
          owner = currentPressureTurn(state)!;
        if (stage.phase !== 'question-open') throw new Error();
        expect(stage.deadlineAt - stage.opensAt).toBe(10_000);
        expect(stage.question.publicQuestion.difficulty).toBe(turn < count ? 'medium' : 'hard');
        owners.push(owner.playerId);
        seen.add(stage.question.editorialQuestionId);
        const actor = s.actors.findIndex((actor) => actor.playerId === owner.playerId);
        const other = (actor + 1) % count;
        await expect(s.answer(other)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        const ownView = buildPlayerView(s.room.snapshot(), owner.playerId, s.time.now());
        expect(JSON.stringify(ownView)).not.toMatch(
          /"correctOptionId"|"pressureOrder"|"explanation"/,
        );
        expect(ownView?.state).toMatchObject({
          status: 'match',
          match: {
            pressureTurn: { playerId: owner.playerId, turnNumber: turn + 1 },
            stage: {
              respondents: { kind: 'single-player', playerId: owner.playerId },
              ownAnswer: { status: 'pending' },
            },
          },
        });
        const results = await Promise.allSettled([s.answer(actor), s.answer(actor)]);
        expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
        expect(s.game().state.history).toHaveLength(turn + 1);
        await s.advance();
        if (turn + 1 < count * 2) await s.advance();
      }
      expect(owners).toEqual([...order, ...[...order].reverse()]);
      expect(seen.size).toBe(count * 2);
      expect(s.game().state.stage.phase).toBe('round-results');
      await s.advance();
      expect(s.game().state.stage.phase).toBe('prototype-complete');
      expect(
        s
          .game()
          .state.scoreboard.every((score) => score.points === 600 && score.correctAnswers === 2),
      ).toBe(true);
      expect(s.errors).not.toHaveBeenCalled();
    },
    15_000,
  );
  it('dinamite: ausência em dois ciclos preserva todos os turnos e saldo zero', async () => {
    const s = await setup({ mode: 'pressure' });
    await s.open();
    await s.rooms.disconnect(s.actors[1]!);
    for (let i = 0; i < 4; i++) {
      await s.advance();
      expect(s.game().state.stage.phase).toBe('reveal');
      expect(s.game().state.history).toHaveLength(i + 1);
      expect(
        buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now())?.state,
      ).toMatchObject({ status: 'match', match: { pressureTurn: { outcome: 'exploded' } } });
      await s.advance();
      if (i < 3) await s.advance();
    }
    expect(s.game().state.scoreboard.map((score) => score.points)).toEqual([0, 0]);
    expect(s.game().state.roster.players).toHaveLength(2);
    await s.rooms.reconnect(s.actors[1]!);
    expect(s.game().state.history).toHaveLength(4);
    expect(s.errors).not.toHaveBeenCalled();
  });
  it('roubo: seis perguntas inéditas, acertos, erro rápido, timeout e escolhas concorrentes', async () => {
    const s = await setup({ mode: 'theft' });
    await s.open();
    const seen = new Set<string>();
    const plans = [
      { order: [0, 1], correct: [true, true], attacker: 0 },
      { order: [0, 1], correct: [false, true], attacker: 1 },
      { order: [0, 1], correct: [false, false], attacker: null },
      { order: [0, 1], correct: [true, true], attacker: null },
      { order: [1, 0], correct: [true, true], attacker: 1 },
      { order: [0, 1], correct: [true, false], attacker: 0 },
    ];
    for (const [index, plan] of plans.entries()) {
      const stage = s.game().state.stage;
      if (stage.phase !== 'question-open') throw new Error();
      seen.add(stage.question.editorialQuestionId);
      await s.answer(plan.order[0]!, plan.correct[plan.order[0]!]!);
      expect(s.game().state.stage.phase).toBe('question-open');
      const pendingView = buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now());
      expect(JSON.stringify(pendingView)).not.toMatch(
        /"attackerPlayerId"|"theftResult"|"correctOptionId"/,
      );
      await s.answer(plan.order[1]!, plan.correct[plan.order[1]!]!);
      if (plan.attacker !== null) {
        expect(s.game().state.stage.phase).toBe('theft-target-selection');
        const results = await Promise.allSettled([
          s.target(plan.attacker, 1 - plan.attacker),
          s.target(plan.attacker, 1 - plan.attacker),
        ]);
        expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
      } else if (s.game().state.stage.phase === 'theft-target-selection') await s.advance();
      expect(s.game().state.history).toHaveLength(index + 1);
      await s.advance();
      if (index < 5) await s.advance();
    }
    await s.advance();
    expect(seen.size).toBe(6);
    expect(s.game().state.stage.phase).toBe('prototype-complete');
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([400, 400]);
    expect(s.game().state.scoreboard.map((entry) => entry.correctAnswers)).toEqual([4, 4]);
  });
  it('roubo: reconexão preserva autor e prazo; falha de transferência mantém créditos sem duplicar', async () => {
    const settleTarget = vi.fn(theftStrategy.settleTarget!).mockImplementationOnce(() => {
      throw new Error('Falha injetada');
    });
    const s = await setup({
      mode: 'theft',
      strategies: new StrategyRegistry([{ ...theftStrategy, settleTarget }]),
    });
    await s.open();
    await Promise.all([s.answer(0), s.answer(1)]);
    const before = s.game();
    const oldTimer = matchTimer(before.state)!;
    await s.rooms.disconnect(s.actors[0]!);
    s.actors[0] = { ...s.actors[0]!, connectionId: 'theft-replacement' };
    await s.rooms.reconnect(s.actors[0]);
    expect(matchTimer(s.game().state)).toEqual(oldTimer);
    expect(
      buildPlayerView(s.room.snapshot(), s.actors[0].playerId, s.time.now())?.state,
    ).toMatchObject({
      status: 'match',
      match: { stage: { phase: 'theft-target-selection', attackerPlayerId: s.actors[0].playerId } },
    });
    await expect(s.target(1, 0)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(s.target(0, 1)).rejects.toThrow('Falha injetada');
    expect(s.game()).toEqual(before);
    await s.target(0, 1);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([150, 50]);
    expect(s.game().state.history).toHaveLength(1);
    await s.scheduled.find((entry) => entry.deadline === oldTimer.deadlineAt)!.task();
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([150, 50]);
  });
  it('aposta: reconexão recupera escolha, repetição é no-op e prazo não muda', async () => {
    const s = await setup({ mode: 'wager' });
    await s.ready();
    await s.choose();
    const timer = matchTimer(s.game().state)!;
    await expect(s.wager(0, 25)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    await s.wager(0, 0);
    const sealedTimer = matchTimer(s.game().state);
    const version = s.room.snapshot().stateVersion;
    await s.wager(0, 0);
    expect(s.room.snapshot().stateVersion).toBe(version);
    await expect(s.wager(0, 25)).rejects.toMatchObject({ code: 'ACTION_CONFLICT' });
    await s.rooms.disconnect(s.actors[0]!);
    s.actors[0] = { ...s.actors[0]!, connectionId: 'wager-replacement' };
    await s.rooms.reconnect(s.actors[0]);
    expect(
      buildPlayerView(s.room.snapshot(), s.actors[0].playerId, s.time.now())?.state,
    ).toMatchObject({
      status: 'match',
      match: { stage: { phase: 'wager-selection', ownWager: { status: 'submitted', amount: 0 } } },
    });
    expect(matchTimer(s.game().state)).toEqual(sealedTimer);
    const now = vi.spyOn(s.runtime.clock, 'now').mockReturnValue(timer.deadlineAt);
    await expect(s.wager(1, 0)).rejects.toMatchObject({ code: 'DEADLINE_EXPIRED' });
    now.mockRestore();
    await s.advance();
    await s.advance();
    await s.answer(0);
    await s.answer(1);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    expect(s.game().state.history).toHaveLength(1);
  });
  it('aposta: serializa escolhas concorrentes sem desconto antecipado', async () => {
    const s = await setup({ mode: 'wager' });
    await s.open();
    await s.answer(0);
    await s.answer(1);
    await s.advance();
    const before = s.game().state.scoreboard;
    const results = await Promise.allSettled([s.wager(0, 50), s.wager(0, 25)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1]).toMatchObject({ reason: { code: 'ACTION_CONFLICT' } });
    expect(s.game().state.wagers).toMatchObject([
      { playerId: s.actors[0]!.playerId, amount: 50, pointsAtSelection: 100 },
    ]);
    expect(s.game().state.scoreboard).toEqual(before);
  });
  it('aposta: seis perguntas inéditas, ganhos e perdas/ausência até saldo zero', async () => {
    const s = await setup({ mode: 'wager' });
    await s.ready();
    await s.choose();
    const seen = new Set<string>(),
      difficulties: string[] = [];
    for (let index = 0; index < 6; index++) {
      const stage = s.game().state.stage;
      if (stage.phase !== 'wager-selection') throw new Error();
      seen.add(stage.question.editorialQuestionId);
      difficulties.push(stage.question.publicQuestion.difficulty);
      const before = s.game().state.scoreboard;
      if (index > 0) {
        await s.wager(0, 50);
        await s.wager(1, index < 3 ? 50 : 0);
      }
      expect(s.game().state.scoreboard).toEqual(before);
      for (const actor of s.actors) {
        const publicView = buildPlayerView(s.room.snapshot(), actor.playerId, s.time.now());
        expect(publicView?.state).toMatchObject({
          status: 'match',
          match: { stage: { phase: 'wager-selection' } },
        });
        expect(JSON.stringify(publicView)).not.toMatch(
          /"prompt"|"options"|"wagers"|"pointsAtSelection"/,
        );
      }
      await s.advance();
      await s.advance();
      await s.answer(0);
      if (index === 2) await s.advance();
      else await s.answer(1, index === 0);
      expect(s.game().state.history).toHaveLength(index + 1);
      await s.advance();
    }
    await s.advance();
    expect(s.game().state.stage.phase).toBe('prototype-complete');
    expect(seen.size).toBe(6);
    expect(difficulties.sort()).toEqual(['easy', 'easy', 'hard', 'hard', 'medium', 'medium']);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([850, 0]);
    expect(s.game().state.scoreboard.map((entry) => entry.correctAnswers)).toEqual([6, 1]);
    expect(matchTimer(s.game().state)).toBeNull();
  });
  it.each([
    [4999, 150],
    [5000, 125],
    [9999, 125],
    [10000, 100],
    [14999, 100],
    [15000, 0],
  ])(
    'velocidade: recebimento em %i ms vale %i, sem depender de prioridade',
    async (elapsed, points) => {
      const s = await setup({ mode: 'speed' });
      await s.open();
      const stage = s.game().state.stage;
      if (stage.phase !== 'question-open') throw new Error();
      const now = vi.spyOn(s.runtime.clock, 'now').mockReturnValue(stage.opensAt + elapsed);
      if (elapsed === 15000) {
        await expect(s.answer(0)).rejects.toMatchObject({ code: 'DEADLINE_EXPIRED' });
        now.mockRestore();
        await s.advance();
      } else {
        await s.answer(0);
        await s.answer(1);
        now.mockRestore();
      }
      expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([points, points]);
      expect(s.game().state.history).toHaveLength(1);
      expect(s.views.at(-1)?.state).toMatchObject({
        status: 'match',
        match: {
          stage: { phase: 'reveal' },
          speedRules: {
            correctPoints: 100,
            responseMs: 15000,
            bonusBands: [
              { beforeMs: 5000, points: 50 },
              { beforeMs: 10000, points: 25 },
              { beforeMs: 15000, points: 0 },
            ],
          },
        },
      });
    },
  );
  it('velocidade: erro em 2 s vale zero e reconexão preserva resposta, prazo e pontos únicos', async () => {
    const s = await setup({ mode: 'speed' });
    await s.open();
    const deadline = matchTimer(s.game().state)!.deadlineAt;
    await s.time.advanceTo(s.time.now() + 2000);
    await s.answer(0, false);
    const state = s.room.snapshot();
    const oldActor = s.actors[0]!;
    await s.rooms.disconnect(oldActor);
    s.actors[0] = { ...oldActor, connectionId: 'replacement-speed' };
    await s.rooms.reconnect(s.actors[0]);
    const own = buildPlayerView(s.room.snapshot(), oldActor.playerId, s.time.now());
    expect(own?.state).toMatchObject({
      status: 'match',
      match: {
        stage: {
          phase: 'question-open',
          deadlineAt: deadline,
          ownAnswer: { status: 'submitted' },
        },
      },
    });
    expect(state.phase.status).toBe('match');
    await expect(s.answer(0)).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
    await s.answer(1);
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([0, 150]);
    expect(s.game().state.history).toHaveLength(1);
  });
  it('velocidade: seis perguntas inéditas, dificuldades próprias e parâmetros congelados', async () => {
    const s = await setup({ mode: 'speed' });
    s.parameters.speed.correctPoints = 999;
    s.parameters.speed.bonusBands[0]!.points = 999;
    await s.open();
    const seen = new Set<string>();
    const difficulties: string[] = [];
    for (let i = 0; i < 6; i++) {
      const stage = s.game().state.stage;
      if (stage.phase !== 'question-open') throw new Error();
      seen.add(stage.question.editorialQuestionId);
      difficulties.push(stage.question.publicQuestion.difficulty);
      await s.answer(0);
      await s.answer(1, false);
      await s.advance();
      if (i < 5) await s.advance();
    }
    await s.advance();
    expect(seen.size).toBe(6);
    expect(difficulties.sort()).toEqual(['easy', 'easy', 'hard', 'medium', 'medium', 'medium']);
    expect(s.game().state.stage.phase).toBe('prototype-complete');
    expect(s.game().state.scoreboard.map((entry) => entry.points)).toEqual([900, 0]);
    expect(s.game().state.history).toHaveLength(6);
    expect(matchTimer(s.game().state)).toBeNull();
  });
  it('velocidade: bloqueia estoque sem a pergunta difícil antes de sair do lobby', () => {
    const { runtime } = createTestRuntime();
    const matches = new MatchService({ runtime, questions: repository() });
    expect(() => matches.validateStart({ ...roster, prototypeMode: 'speed' })).toThrowError(
      expect.objectContaining({ code: 'INSUFFICIENT_QUESTIONS' }),
    );
  });
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
      match: {
        stage: { phase: 'prototype-complete' },
        finalEntry: {
          status: 'ready',
          scope: 'isolated-prototype',
          allocations: [
            {
              playerId: s.actors[0]!.playerId,
              initialLives: 5,
              survivableLosses: 4,
              eliminatingLoss: 5,
            },
            {
              playerId: s.actors[1]!.playerId,
              initialLives: 4,
              survivableLosses: 3,
              eliminatingLoss: 4,
            },
          ],
        },
      },
    });
    const entry = structuredClone(s.game().state.finalEntry);
    await s.rooms.disconnect(s.actors[0]!);
    await s.rooms.reconnect(s.actors[0]!);
    expect(s.game().state.finalEntry).toEqual(entry);
    const copy = s.game();
    copy.state.scoreboard[0]!.points = 0;
    expect(s.game().state.finalEntry).toEqual(entry);
    await expect(
      s.room.runExclusive((tx) => {
        if (tx.state.phase.status === 'match' && tx.state.phase.game) {
          tx.state.phase.game.state.finalEntry = null;
          tx.touch();
        }
      }),
    ).rejects.toThrow('vidas de entrada são imutáveis');
  });
  it('encerramento empatado publica pendência D06 sem inventar vidas ou usar anfitrião', async () => {
    const s = await setup();
    await s.open();
    for (let i = 0; i < 6; i++) {
      await s.answer(0);
      await s.answer(1);
      await s.advance();
      if (i < 5) await s.advance();
    }
    await s.advance();
    const entry = s.game().state.finalEntry;
    expect(entry).toMatchObject({
      status: 'pending-tiebreak',
      policy: { status: 'pending', decisionId: 'D06' },
      next: { kind: 'decision-required' },
      groups: [[s.actors[0]!.playerId, s.actors[1]!.playerId]],
    });
    expect(entry && 'allocations' in entry).toBe(false);
    await expect(
      s.matches.startFinal(s.room, s.actors[0]!, s.game().state.roster.matchId),
    ).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    expect(s.views.at(-1)?.state).toMatchObject({ status: 'match', match: { finalEntry: entry } });
    await s.rooms.disconnect(s.actors[1]!);
    await s.rooms.reconnect(s.actors[1]!);
    expect(s.game().state.finalEntry).toEqual(entry);
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

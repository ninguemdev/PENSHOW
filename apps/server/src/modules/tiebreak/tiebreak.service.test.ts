import { afterEach, describe, expect, it } from 'vitest';
import { defaultAvatar, playerIdSchema, type PlayerId } from '@penshow/shared';
import { createTestRuntime } from '../../test-support/runtime.js';
import { repository, uuid } from '../../test-support/match.js';
import { combatBotInput } from '../../test-support/combat-bot.js';
import { RoomService } from '../rooms/room.service.js';
import { MatchService, matchContext } from '../matches/match.service.js';
import { matchTimer } from '../matches/match.domain.js';
import { buildPlayerView } from '../views/build-player-view.js';
import { createRoomPublisher } from '../views/room-publisher.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanups.splice(0)) await dispose();
});
async function setup(count = 2, keepSurvivor = false) {
  const { runtime, time } = createTestRuntime();
  runtime.random = { integer: () => 0 };
  const events: { viewer: PlayerId; event: unknown }[] = [],
    errors: unknown[] = [];
  const matches = new MatchService({
    runtime,
    questions: repository(true, 60),
    onError: () => errors.push('match'),
  });
  const publisher = createRoomPublisher({
    clock: time,
    isCurrent: () => true,
    send: (actor, event) => events.push({ viewer: actor.playerId, event }),
    onError: () => errors.push('publish'),
  });
  const rooms = new RoomService({
    runtime,
    quiz: matches,
    onChange: publisher,
    onError: () => errors.push('room'),
  });
  cleanups.push(async () => {
    await rooms.dispose();
    await time.dispose();
  });
  const actors = Array.from({ length: count }, (_, i) => ({
    playerId: playerIdSchema.parse(uuid(i + 1)),
    connectionId: `socket-${i}`,
  }));
  const profile = { nickname: 'Ana', avatar: defaultAvatar() };
  const entry = await rooms.create(actors[0]!, profile, {
    format: 'prototype-v1',
    maxPlayers: count,
    enabledCategories: ['history'],
  });
  for (const actor of actors.slice(1)) await rooms.join(actor, entry.code, profile);
  const room = rooms.registry.byId(entry.roomId)!;
  function state() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw Error('Partida esperada');
    return phase.game.state;
  }
  async function advance() {
    const timer = matchTimer(state());
    if (!timer) throw Error('Prazo esperado');
    await time.advanceTo(timer.deadlineAt);
  }
  function tie() {
    const stage = state().final?.stage;
    if (stage?.phase !== 'final-tiebreak') throw Error('Combate esperado');
    return stage.tiebreak;
  }
  await rooms.start(actors[0]!, room.id, 'classic');
  for (let guard = 0; guard < 50 && state().stage.phase !== 'prototype-complete'; guard++)
    await advance();
  await matches.startFinal(room, actors[0]!, state().roster.matchId);
  for (const actor of actors)
    await matches.execute(room, actor, { kind: 'ready', ...matchContext(state()) });
  await advance();
  if (keepSurvivor) {
    for (const actor of actors.slice(1)) {
      const stage = state().final!.stage;
      if (stage.phase !== 'final-question-open') throw Error('Pergunta esperada');
      await matches.execute(room, actor, {
        kind: 'answer',
        ...matchContext(state()),
        questionId: stage.question.publicQuestion.questionId,
        optionId: stage.question.publicQuestion.options.find(
          (o) => o.optionId !== stage.question.correctOptionId,
        )!.optionId,
      });
      await advance();
      await advance();
    }
  }
  for (let guard = 0; guard < 30 && state().final?.stage.phase !== 'final-tiebreak'; guard++)
    await advance();
  return { runtime, time, rooms, matches, room, actors, state, advance, tie, events, errors };
}
describe('desempate integrado ao agregado da sala', () => {
  it.each([2, 4, 12])(
    '%i jogadores entram por D02 real com vidas próprias e sem gabarito público',
    async (count) => {
      const s = await setup(count);
      expect(s.state().final!.finalists.every((f) => f.lives === 0)).toBe(true);
      expect(s.tie().combat.fighters).toHaveLength(count);
      expect(s.tie().combat.fighters.every((f) => f.lives === 3)).toBe(true);
      const view = buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now());
      expect(JSON.stringify(view)).not.toMatch(
        /correctOptionId|editorialQuestionId|input|protectedUntil/,
      );
      expect(s.errors).toEqual([]);
    },
  );
  it('coalesce entradas, ignora sequência antiga e publica quadros sem visões completas por passo', async () => {
    const s = await setup();
    for (const a of s.actors)
      await s.matches.execute(s.room, a, { kind: 'ready', ...matchContext(s.state()) });
    await s.advance();
    const f = s.tie().combat.fighters[0]!,
      actor = s.actors.find((a) => a.playerId === f.playerId)!;
    const input = combatBotInput(s.tie(), f.playerId, 1);
    const before = s.tie().combat.fighters[0]!.x;
    for (let i = 1; i <= 50; i++)
      await s.matches.input(s.room, actor, matchContext(s.state()), {
        ...input,
        sequence: i,
        moveX: -1,
        moveY: 0,
        shooting: false,
      });
    await s.matches.input(s.room, actor, matchContext(s.state()), {
      ...input,
      sequence: 1,
      moveX: 1,
      shooting: true,
    });
    s.events.length = 0;
    await s.advance();
    await s.advance();
    expect(s.tie().combat.fighters[0]!.lastSequence).toBe(50);
    expect(Math.abs(s.tie().combat.fighters[0]!.x - before)).toBeLessThanOrEqual(20);
    expect(s.events.some((e) => JSON.stringify(e.event).includes('tiebreak:frame'))).toBe(true);
    expect(s.events.some((e) => JSON.stringify(e.event).includes('room:view'))).toBe(false);
    await expect(
      s.matches.input(s.room, actor, matchContext(s.state()), { ...input, generation: 999 }),
    ).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    await s.rooms.disconnect(actor);
    await s.advance();
    await expect(
      s.matches.input(s.room, actor, matchContext(s.state()), { ...input, sequence: 100 }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(s.errors).toEqual([]);
  });
  it('resolve combate com tiros reais, uma recuperação, pergunta privada, reconexão e revanche', async () => {
    const s = await setup();
    let recovered = false,
      questionSeen = false,
      oldQuestion = '';
    for (let guard = 0; guard < 1800 && s.state().final?.stage.phase !== 'podium'; guard++) {
      const stage = s.state().final!.stage;
      if (stage.phase !== 'final-tiebreak') throw Error('Estado inesperado');
      const tie = stage.tiebreak;
      if (tie.phase === 'instructions')
        for (const a of s.actors)
          await s.matches.execute(s.room, a, { kind: 'ready', ...matchContext(s.state()) });
      else if (tie.phase === 'combat') {
        for (const f of tie.combat.fighters.filter((f) => f.status === 'fighting'))
          await s.matches.input(
            s.room,
            s.actors.find((a) => a.playerId === f.playerId)!,
            matchContext(s.state()),
            combatBotInput(tie, f.playerId, s.time.now()),
          );
        await s.advance();
      } else if (tie.phase === 'questions') {
        const pending = tie.questions.filter((q) => !q.outcome && q.opensAt <= s.time.now());
        if (!pending.length) await s.advance();
        for (const q of pending) {
          expect(q.question.publicQuestion.questionId).not.toBe(oldQuestion);
          oldQuestion = q.question.publicQuestion.questionId;
          const actor = s.actors.find((a) => a.playerId === q.playerId)!;
          const other = s.actors.find((a) => a.playerId !== q.playerId)!;
          const publicOther = buildPlayerView(s.room.snapshot(), other.playerId, s.time.now());
          expect(JSON.stringify(publicOther)).not.toContain(q.question.publicQuestion.questionId);
          await s.rooms.disconnect(actor);
          await s.rooms.reconnect(actor);
          const current = s.tie().questions.find((own) => own.playerId === q.playerId)!;
          expect(current.deadlineAt).toBe(q.deadlineAt);
          const optionId = !recovered
            ? q.question.correctOptionId
            : q.question.publicQuestion.options.find(
                (o) => o.optionId !== q.question.correctOptionId,
              )!.optionId;
          await s.matches.execute(s.room, actor, {
            kind: 'tiebreak-answer',
            ...matchContext(s.state()),
            tiebreakId: tie.tiebreakId,
            bout: tie.bout,
            generation: tie.generation,
            questionId: q.question.publicQuestion.questionId,
            optionId,
          });
          if (!recovered) {
            recovered = true;
            expect(s.tie().questions.find((own) => own.playerId === q.playerId)!.outcome).toBe(
              'correct',
            );
          }
          questionSeen = true;
        }
      } else await s.advance();
    }
    expect(recovered && questionSeen).toBe(true);
    expect(s.state().final!.stage.phase).toBe('podium');
    expect(s.state().final!.tiebreakResults).toHaveLength(1);
    const podium = buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now());
    expect(podium?.state).toMatchObject({
      status: 'match',
      match: { stage: { phase: 'podium', winnerSource: 'tiebreak' } },
    });
    await s.rooms.returnToLobby(s.actors[0]!, s.room.id, s.state().roster.matchId, {
      requireFinished: true,
    });
    expect(s.room.snapshot().phase.status).toBe('lobby');
    expect(s.time.pendingCount).toBe(1);
    expect(s.errors).toEqual([]);
  }, 30000);
  it('não restaura vidas de quiz nem troca o campeão fora do grupo empatado', async () => {
    const s = await setup(3, true);
    expect(
      s.state().final!.finalists.find((f) => f.playerId === s.actors[0]!.playerId)!.lives,
    ).toBe(1);
    expect(s.tie().participants).not.toContain(s.actors[0]!.playerId);
    const viewer = buildPlayerView(s.room.snapshot(), s.actors[0]!.playerId, s.time.now());
    expect(viewer?.state).toMatchObject({
      status: 'match',
      match: { stage: { tiebreak: { ownQuestion: { status: 'unavailable' } } } },
    });
    await expect(
      s.matches.execute(s.room, s.actors[0]!, { kind: 'ready', ...matchContext(s.state()) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

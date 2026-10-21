import { afterEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  acknowledgementSchema,
  defaultAvatar,
  issuedGuestSessionSchema,
  serverEventSchema,
  type Acknowledgement,
  type ClientEvent,
  type IssuedGuestSession,
  type MatchStage,
  type RoomView,
  type ServerEvent,
} from '@penshow/shared';
import { buildApp, type AppDependencies } from '../../app.js';
import { loadConfig, SOCKET_PATH } from '../../platform/config.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { repository } from '../../test-support/match.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { matchTimer } from './match.domain.js';

const apps: ReturnType<typeof buildApp>[] = [],
  sockets: Socket[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const socket of sockets.splice(0)) socket.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const profile = { nickname: 'Ana', avatar: defaultAvatar() };
const settings = {
  format: 'prototype-v1' as const,
  maxPlayers: 2,
  enabledCategories: ['history', 'geography'],
};
interface Client {
  socket: Socket;
  session: IssuedGuestSession | undefined;
  events: ServerEvent[];
  command(event: ClientEvent, payload: unknown, actionId?: string): Promise<Acknowledgement>;
}
async function fixture(overrides: AppDependencies = {}) {
  const { runtime, time } = createTestRuntime();
  let seed = 143;
  runtime.random = {
    integer: (max) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % max;
    },
  };
  const app = buildApp({ config: loadConfig({ NODE_ENV: 'test' }), runtime, ...overrides });
  apps.push(app);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  async function issue() {
    return issuedGuestSessionSchema.parse(
      (await app.inject({ method: 'POST', url: '/guest-sessions' })).json(),
    );
  }
  async function connect(
    session?: IssuedGuestSession,
    transport: 'websocket' | 'polling' = 'websocket',
  ): Promise<Client> {
    const socket = io(address, {
      path: SOCKET_PATH,
      transports: [transport],
      autoConnect: false,
      reconnection: false,
      timeout: 1500,
      auth: session ? { token: session.token } : {},
    });
    sockets.push(socket);
    const events: ServerEvent[] = [];
    for (const name of ['room:view', 'room:removed', 'session:ended'])
      socket.on(name, (raw: unknown) => events.push(serverEventSchema.parse(raw)));
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await connected;
    return {
      socket,
      session,
      events,
      command: async (event, payload, actionId = crypto.randomUUID()) =>
        acknowledgementSchema.parse(
          await socket
            .timeout(1500)
            .emitWithAck(event, { protocolVersion: 1, actionId, event, payload }),
        ),
    };
  }
  async function group(transport: 'websocket' | 'polling' = 'websocket') {
    const host = await connect(await issue(), transport),
      guest = await connect(await issue(), transport);
    const created = await host.command('room:create', { profile, settings });
    if (created.status !== 'ok' || created.event !== 'room:create')
      throw new Error('Sala esperada.');
    const entry = created.result;
    expect(
      await guest.command('room:join', {
        code: entry.code,
        profile: { ...profile, nickname: 'Bia' },
      }),
    ).toMatchObject({ status: 'ok' });
    const room = app.rooms.registry.byId(entry.roomId)!;
    function state() {
      const phase = room.snapshot().phase;
      if (phase.status !== 'match' || !phase.game) throw new Error('Motor esperado.');
      return phase.game.state;
    }
    async function advance() {
      await time.advanceTo(matchTimer(state())!.deadlineAt);
    }
    function context() {
      const game = state();
      return {
        roomId: room.id,
        matchId: game.roster.matchId,
        roundId: game.final?.round.roundId ?? game.rounds[game.roundIndex]!.roundId,
      };
    }
    async function start(mode?: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure') {
      expect(
        await host.command('match:start', { roomId: room.id, ...(mode ? { mode } : {}) }),
      ).toMatchObject({
        status: 'ok',
        event: 'match:start',
      });
      await stage(host, 'instructions', room.snapshot().stateVersion);
    }
    async function choose() {
      const { stage: offer } = await stage(
        host,
        'category-selection',
        room.snapshot().stateVersion,
      );
      const chooser = [host, guest].find(
        (client) => client.session?.playerId === offer.chooserPlayerId,
      )!;
      expect(
        await chooser.command('category:choose', { ...context(), category: offer.categories[0] }),
      ).toMatchObject({ status: 'ok' });
    }
    async function open(mode?: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure') {
      await start(mode);
      for (const client of [host, guest])
        expect(await client.command('round:ready', context())).toMatchObject({ status: 'ok' });
      await choose();
      if (state().stage.phase === 'wager-selection') await advance();
      await advance();
      await stage(host, 'question-open', room.snapshot().stateVersion);
    }
    function answerPayload(correct = true) {
      const current = state().final?.stage ?? state().stage;
      if (!('question' in current)) throw new Error('Pergunta esperada.');
      return {
        ...context(),
        questionId: current.question.publicQuestion.questionId,
        optionId: correct
          ? current.question.correctOptionId
          : current.question.publicQuestion.options.find(
              (option) => option.optionId !== current.question.correctOptionId,
            )!.optionId,
      };
    }
    return {
      host,
      guest,
      entry,
      room,
      state,
      advance,
      context,
      start,
      choose,
      open,
      answerPayload,
    };
  }
  return { app, runtime, time, issue, connect, group };
}
async function view(client: Client, predicate: (view: RoomView) => boolean) {
  let found: RoomView | undefined;
  await vi.waitFor(() => {
    found = client.events
      .filter(
        (event): event is Extract<ServerEvent, { event: 'room:view' }> =>
          event.event === 'room:view',
      )
      .map((event) => event.payload)
      .findLast(predicate);
    expect(found).toBeDefined();
  });
  return found!;
}
async function stage<Phase extends MatchStage['phase']>(client: Client, phase: Phase, version = 0) {
  const snapshot = await view(
    client,
    (view) =>
      view.stateVersion >= version &&
      view.state.status === 'match' &&
      view.state.match.stage.phase === phase,
  );
  if (snapshot.state.status !== 'match') throw new Error();
  return {
    view: snapshot,
    match: snapshot.state.match,
    stage: snapshot.state.match.stage as Extract<MatchStage, { phase: Phase }>,
  };
}
function error(ack: Acknowledgement, code: string) {
  expect(ack).toMatchObject({ status: 'error', error: { code } });
}
function privacy(client: Client) {
  for (const event of client.events) {
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(
      /"editorialQuestionId"|"editorialOptionByPublicId"|"receivedAt"|"source"|"selection"|"token"|"connectionId"/,
    );
    if (event.event !== 'room:view' || event.payload.state.status !== 'match') continue;
    const match = event.payload.state.match;
    if (
      !['reveal', 'final-target-selection', 'final-resolution', 'final-no-target-pending'].includes(
        match.stage.phase,
      )
    )
      expect(serialized).not.toMatch(/"correctOptionId"|"explanation"/);
    if (match.stage.phase === 'question-reading' || match.stage.phase === 'final-question-reading')
      expect(serialized).not.toContain('"options"');
    if (match.stage.phase === 'question-open') {
      const own = match.stage.ownAnswer;
      if (own.status === 'submitted')
        expect(match.stage.answeredPlayerIds).toContain(client.session!.playerId);
      expect(serialized).not.toContain('"answers"');
    }
  }
}

describe('quiz clássico autenticado em rede', () => {
  it.each(['websocket', 'polling'] as const)(
    'matriz de fotografia e conexão única via %s',
    async (transport) => {
      const cases = [
        'instructions',
        'category',
        'reading',
        'open',
        'answered',
        'wager',
        'theft',
        'pressure',
      ] as const;
      for (const cell of cases) {
        const f = await fixture();
        const g = await f.group(transport);
        const mode =
          cell === 'wager'
            ? 'wager'
            : cell === 'theft'
              ? 'theft'
              : cell === 'pressure'
                ? 'pressure'
                : 'classic';
        if (['open', 'answered', 'theft', 'pressure'].includes(cell)) await g.open(mode);
        else {
          await g.start(mode);
          if (cell !== 'instructions') {
            for (const client of [g.host, g.guest])
              await client.command('round:ready', g.context());
            if (cell !== 'category') await g.choose();
          }
        }
        if (cell === 'answered') await g.host.command('answer:submit', g.answerPayload());
        if (cell === 'wager')
          await g.host.command('wager:submit', {
            ...g.context(),
            questionId: g.answerPayload().questionId,
            amount: 0,
          });
        if (cell === 'theft') {
          await g.host.command('answer:submit', g.answerPayload());
          await g.guest.command('answer:submit', g.answerPayload());
        }
        if (cell === 'pressure') {
          const turn = g.state().pressureOrder[0]!;
          const owner = turn === g.host.session!.playerId ? g.host : g.guest;
          await owner.command('answer:submit', g.answerPayload());
        }
        const before = await view(
          g.host,
          (snapshot) => snapshot.stateVersion === g.room.snapshot().stateVersion,
        );
        const replacement = await f.connect(g.host.session, transport);
        const ack = await replacement.command('room:sync', {});
        expect(ack).toMatchObject({
          status: 'ok',
          event: 'room:sync',
          result: { status: 'present', roomId: g.room.id },
        });
        const restored = await view(
          replacement,
          (snapshot) => snapshot.stateVersion >= g.room.snapshot().stateVersion,
        );
        if (before.state.status !== 'match' || restored.state.status !== 'match') throw new Error();
        expect(restored.state.match).toEqual(before.state.match);
        expect(restored.viewerId).toBe(before.viewerId);
        expect(restored.members).toHaveLength(2);
        await vi.waitFor(() => expect(g.host.socket.connected).toBe(false));
        if (cell === 'answered')
          error(await replacement.command('answer:submit', g.answerPayload()), 'ALREADY_ANSWERED');
        if (cell === 'wager') {
          expect(restored.state.match.stage).toMatchObject({
            ownWager: { status: 'submitted', amount: 0 },
          });
          error(
            await replacement.command('wager:submit', {
              ...g.context(),
              questionId: g.answerPayload().questionId,
              amount: 25,
            }),
            'ACTION_CONFLICT',
          );
        }
        privacy(replacement);
      }
    },
    20000,
  );
  it.each(['websocket', 'polling'] as const)(
    'sala vazia não avança e room:sync reconcilia retorno/expiração via %s',
    async (transport) => {
      const f = await fixture();
      const g = await f.group(transport);
      await g.open();
      const deadline = matchTimer(g.state())!.deadlineAt;
      g.host.socket.disconnect();
      g.guest.socket.disconnect();
      await vi.waitFor(() => expect(g.room.snapshot().emptySince).not.toBeNull());
      const emptySince = g.room.snapshot().emptySince!;
      await f.time.advanceTo(deadline);
      expect(g.state().history).toHaveLength(1);
      await g.advance();
      const phase = g.room.snapshot().phase;
      if (phase.status !== 'match') throw new Error();
      expect(phase.game?.suspended).toBe(true);
      await f.time.advanceTo(emptySince + 119999);
      const returned = await f.connect(g.guest.session, transport);
      expect(await returned.command('room:sync', {})).toMatchObject({
        status: 'ok',
        result: { status: 'present' },
      });
      await f.time.advanceTo(f.time.now());
      await stage(returned, 'question-reading', g.room.snapshot().stateVersion);
      expect(g.state().history).toHaveLength(1);
      returned.socket.disconnect();
      await vi.waitFor(() => expect(g.room.snapshot().emptySince).not.toBeNull());
      await f.time.advanceTo(g.room.snapshot().emptySince! + 120000);
      const late = await f.connect(g.guest.session, transport);
      expect(await late.command('room:sync', {})).toMatchObject({
        status: 'ok',
        result: { status: 'absent' },
      });
      expect(f.app.rooms.registry.byId(g.room.id)).toBeUndefined();
      error(await late.command('room:sync', { roomId: g.room.id }), 'INVALID_PAYLOAD');
      privacy(returned);
      privacy(late);
    },
  );
  it('reinício descarta salas e credenciais de sessão mantidas apenas na memória', async () => {
    const f = await fixture();
    const g = await f.group();
    await g.open();
    await f.app.close();
    const restarted = await fixture();
    expect(restarted.app.rooms.registry.all()).toEqual([]);
    expect(
      (
        await restarted.app.inject({
          method: 'GET',
          url: `/guest-sessions/${g.host.session!.playerId}`,
          headers: { authorization: `Bearer ${g.host.session!.token}` },
        })
      ).statusCode,
    ).toBe(401);
    await expect(restarted.connect(g.host.session)).rejects.toBeDefined();
  });
  it.each(['websocket', 'polling'] as const)(
    'final via %s: primeira resposta, autoria, reconexão, alvo ausente e dano único',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.open();
      for (let i = 0; i < 6; i++) {
        await g.host.command('answer:submit', g.answerPayload());
        await g.guest.command('answer:submit', g.answerPayload(false));
        await g.advance();
        if (i < 5) await g.advance();
      }
      await g.advance();
      const payload = { roomId: g.room.id, matchId: g.state().roster.matchId };
      error(await g.guest.command('final:start', payload), 'FORBIDDEN');
      error(await g.host.command('final:start', { ...payload, lives: 5 }), 'INVALID_PAYLOAD');
      expect(await g.host.command('final:start', payload)).toMatchObject({ status: 'ok' });
      const version = g.room.snapshot().stateVersion;
      expect(await g.host.command('final:start', payload)).toMatchObject({
        status: 'ok',
        result: { stateVersion: version },
      });
      const initial = await stage(g.host, 'final-instructions', version);
      expect(initial.stage.finalists.map((player) => player.lives)).toEqual([5, 4]);
      const spectator = await f.connect(await f.issue(), transport);
      await spectator.command('room:join', { code: g.entry.code, profile });
      for (const client of [g.host, g.guest]) await client.command('round:ready', g.context());
      error(await g.host.command('answer:submit', g.answerPayload()), 'INVALID_PHASE');
      await g.advance();
      const open = await stage(g.host, 'final-question-open', g.room.snapshot().stateVersion);
      expect(open.match.progress.questionCount).toBeNull();
      error(
        await g.host.command('answer:submit', {
          ...g.answerPayload(),
          optionId: crypto.randomUUID(),
        }),
        'INVALID_PAYLOAD',
      );
      const answerClock = vi.spyOn(f.runtime.clock, 'now').mockReturnValue(open.stage.deadlineAt);
      error(await g.host.command('answer:submit', g.answerPayload()), 'DEADLINE_EXPIRED');
      answerClock.mockRestore();
      error(await spectator.command('answer:submit', g.answerPayload()), 'FORBIDDEN');
      error(
        await g.host.command('answer:submit', {
          ...g.answerPayload(),
          receivedAt: open.stage.opensAt,
        }),
        'INVALID_PAYLOAD',
      );
      expect(await g.host.command('answer:submit', g.answerPayload(false))).toMatchObject({
        status: 'ok',
        result: { acceptance: 'first-valid' },
      });
      error(await g.guest.command('answer:submit', g.answerPayload()), 'QUESTION_CLOSED');
      const wrong = await stage(g.host, 'final-resolution', g.room.snapshot().stateVersion);
      expect(wrong.stage.finalists.map((player) => player.lives)).toEqual([4, 4]);
      await g.advance();
      await g.advance();
      const results = await Promise.all([
        g.host.command('answer:submit', g.answerPayload()),
        g.guest.command('answer:submit', g.answerPayload()),
      ]);
      expect(results.filter((result) => result.status === 'ok')).toHaveLength(1);
      const chosen = await stage(g.host, 'final-target-selection', g.room.snapshot().stateVersion);
      const owner = [g.host, g.guest].find(
          (client) => client.session!.playerId === chosen.stage.acceptedAnswer.playerId,
        )!,
        other = owner === g.host ? g.guest : g.host;
      const targetPayload = {
        ...g.context(),
        questionId: chosen.stage.reveal.question.questionId,
        targetPlayerId: other.session!.playerId,
      };
      error(
        await other.command('target:choose', {
          ...targetPayload,
          targetPlayerId: owner.session!.playerId,
        }),
        'FORBIDDEN',
      );
      error(
        await owner.command('target:choose', {
          ...targetPayload,
          targetPlayerId: owner.session!.playerId,
        }),
        'INVALID_TARGET',
      );
      const replacement = await f.connect(owner.session, transport);
      const restored = await stage(
        replacement,
        'final-target-selection',
        g.room.snapshot().stateVersion,
      );
      expect(restored.stage).toEqual(chosen.stage);
      const clock = vi.spyOn(f.runtime.clock, 'now').mockReturnValue(chosen.stage.deadlineAt);
      error(await replacement.command('target:choose', targetPayload), 'DEADLINE_EXPIRED');
      clock.mockRestore();
      other.socket.disconnect();
      await vi.waitFor(() =>
        expect(
          g.room.snapshot().members.find((member) => member.playerId === other.session!.playerId)
            ?.connection.status,
        ).toBe('disconnected'),
      );
      expect(await replacement.command('target:choose', targetPayload)).toMatchObject({
        status: 'ok',
      });
      error(await replacement.command('target:choose', targetPayload), 'INVALID_PHASE');
      const result = await stage(replacement, 'final-resolution', g.room.snapshot().stateVersion);
      expect(result.stage.finalists.map((player) => player.lives).sort()).toEqual([3, 4]);
      expect(g.state().final?.history).toHaveLength(2);
      expect(g.state().scoreboard.map((score) => score.points)).toEqual([600, 0]);
      privacy(g.host);
      privacy(g.guest);
      privacy(spectator);
      privacy(replacement);
    },
    15_000,
  );
  it.each(['D02', 'D03'] as const)(
    'final em rede suspende %s sem inventar fallback',
    async (decision) => {
      const f = await fixture(),
        g = await f.group();
      await g.open();
      for (let i = 0; i < 6; i++) {
        await g.host.command('answer:submit', g.answerPayload());
        await g.guest.command('answer:submit', g.answerPayload(false));
        await g.advance();
        if (i < 5) await g.advance();
      }
      await g.advance();
      await g.host.command('final:start', { roomId: g.room.id, matchId: g.state().roster.matchId });
      for (const client of [g.host, g.guest]) await client.command('round:ready', g.context());
      await g.advance();
      if (decision === 'D03') await g.host.command('answer:submit', g.answerPayload());
      await g.advance();
      const phase = decision === 'D02' ? 'final-no-answer-pending' : 'final-no-target-pending';
      const pending = await stage(g.host, phase, g.room.snapshot().stateVersion);
      expect(pending.stage.decisionId).toBe(decision);
      expect(pending.stage.finalists.map((player) => player.lives)).toEqual([5, 4]);
      expect(matchTimer(g.state())).toBeNull();
      expect(g.state().final?.history).toHaveLength(0);
      privacy(g.host);
      privacy(g.guest);
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'conversão via %s: resumo público único e recuperação após encerrar',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.open();
      for (let i = 0; i < 6; i++) {
        expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
          status: 'ok',
        });
        expect(await g.guest.command('answer:submit', g.answerPayload(false))).toMatchObject({
          status: 'ok',
        });
        await g.advance();
        if (i < 5) await g.advance();
      }
      await g.advance();
      const complete = await stage(g.host, 'prototype-complete', g.room.snapshot().stateVersion);
      expect(complete.match.finalEntry).toMatchObject({
        status: 'ready',
        scope: 'isolated-prototype',
        allocations: [
          { initialLives: 5, survivableLosses: 4 },
          { initialLives: 4, survivableLosses: 3 },
        ],
      });
      const replacement = await f.connect(g.host.session, transport);
      const restored = await stage(
        replacement,
        'prototype-complete',
        g.room.snapshot().stateVersion,
      );
      expect(restored.match.finalEntry).toEqual(complete.match.finalEntry);
      const spectator = await f.connect(await f.issue(), transport);
      await spectator.command('room:join', { code: g.entry.code, profile });
      expect(
        (await stage(spectator, 'prototype-complete', g.room.snapshot().stateVersion)).match
          .finalEntry,
      ).toEqual(complete.match.finalEntry);
      privacy(g.host);
      privacy(g.guest);
      privacy(replacement);
      privacy(spectator);
      expect(
        await replacement.command('match:returnToLobby', {
          roomId: g.room.id,
          matchId: g.context().matchId,
        }),
      ).toMatchObject({ status: 'ok' });
      expect(g.room.snapshot().phase.status).toBe('lobby');
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'dinamite via %s: turno exclusivo, recuperação do prazo e ausência',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.open('pressure');
      const turn = g.state().pressureOrder[0]!;
      const owner = [g.host, g.guest].find((client) => client.session!.playerId === turn)!;
      const other = owner === g.host ? g.guest : g.host;
      const spectator = await f.connect(await f.issue(), transport);
      await spectator.command('room:join', { code: g.entry.code, profile });
      const open = await stage(owner, 'question-open', g.room.snapshot().stateVersion);
      expect(open.stage.deadlineAt - open.stage.opensAt).toBe(10_000);
      expect(open.stage.ownAnswer.status).toBe('pending');
      expect(
        (await stage(other, 'question-open', g.room.snapshot().stateVersion)).stage.ownAnswer
          .status,
      ).toBe('unavailable');
      error(await other.command('answer:submit', g.answerPayload()), 'FORBIDDEN');
      error(await spectator.command('answer:submit', g.answerPayload()), 'FORBIDDEN');
      error(
        await owner.command('answer:submit', {
          ...g.answerPayload(),
          playerId: other.session!.playerId,
        }),
        'INVALID_PAYLOAD',
      );
      const replacement = await f.connect(owner.session, transport);
      const restored = await stage(replacement, 'question-open', g.room.snapshot().stateVersion);
      expect(restored.stage.deadlineAt).toBe(open.stage.deadlineAt);
      expect(restored.match.pressureTurn).toEqual(open.match.pressureTurn);
      const payload = g.answerPayload();
      expect(await replacement.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
      error(await replacement.command('answer:submit', payload), 'INVALID_PHASE');
      const reveal = await stage(replacement, 'reveal', g.room.snapshot().stateVersion);
      expect(reveal.match.pressureTurn?.outcome).toBe('passed');
      expect(reveal.match.scoreboard.find((score) => score.playerId === turn)?.points).toBe(300);
      await g.advance();
      await g.advance();
      const next = await stage(other, 'question-open', g.room.snapshot().stateVersion);
      expect(next.stage.deadlineAt - next.stage.opensAt).toBe(10_000);
      expect(next.match.pressureTurn?.playerId).toBe(other.session!.playerId);
      await g.advance();
      const absent = await stage(other, 'reveal', g.room.snapshot().stateVersion);
      expect(absent.match.pressureTurn?.outcome).toBe('exploded');
      expect(g.state().history).toHaveLength(2);
      privacy(g.host);
      privacy(g.guest);
      privacy(replacement);
      privacy(spectator);
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'roubo via %s: privacidade, autorização, reconexão e transferência única',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.open('theft');
      const spectator = await f.connect(await f.issue(), transport);
      await spectator.command('room:join', { code: g.entry.code, profile });
      expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
        status: 'ok',
      });
      const before = await stage(g.guest, 'question-open', g.room.snapshot().stateVersion);
      expect(before.match.scoreboard.map((score) => score.points)).toEqual([0, 0]);
      expect(JSON.stringify(before.match)).not.toMatch(
        /"attackerPlayerId"|"theftResult"|"correctOptionId"/,
      );
      expect(await g.guest.command('answer:submit', g.answerPayload())).toMatchObject({
        status: 'ok',
      });
      const target = await stage(g.host, 'theft-target-selection', g.room.snapshot().stateVersion);
      expect(target.stage.attackerPlayerId).toBe(g.host.session!.playerId);
      expect(target.match.scoreboard.map((score) => score.points)).toEqual([100, 100]);
      const payload = {
        ...g.context(),
        questionId: target.stage.questionId,
        targetPlayerId: g.guest.session!.playerId,
      };
      error(await spectator.command('target:choose', payload), 'FORBIDDEN');
      error(
        await g.guest.command('target:choose', {
          ...payload,
          targetPlayerId: g.host.session!.playerId,
        }),
        'FORBIDDEN',
      );
      error(
        await g.host.command('target:choose', {
          ...payload,
          targetPlayerId: g.host.session!.playerId,
        }),
        'INVALID_TARGET',
      );
      error(
        await g.host.command('target:choose', { ...payload, targetPlayerId: crypto.randomUUID() }),
        'INVALID_TARGET',
      );
      error(await g.host.command('target:choose', { ...payload, amount: 500 }), 'INVALID_PAYLOAD');
      const other = await f.connect(await f.issue(), transport);
      error(await other.command('target:choose', payload), 'NOT_A_MEMBER');
      const replacement = await f.connect(g.host.session, transport);
      const restored = await stage(
        replacement,
        'theft-target-selection',
        g.room.snapshot().stateVersion,
      );
      expect(restored.stage).toEqual(target.stage);
      expect(await replacement.command('target:choose', payload)).toMatchObject({ status: 'ok' });
      const reveal = await stage(replacement, 'reveal', g.room.snapshot().stateVersion);
      expect(reveal.match.scoreboard.map((score) => score.points)).toEqual([150, 50]);
      expect(reveal.stage.theftResult).toMatchObject({
        attackerPlayerId: g.host.session!.playerId,
        targetPlayerId: g.guest.session!.playerId,
        amount: 50,
      });
      error(await replacement.command('target:choose', payload), 'INVALID_PHASE');
      expect(g.state().history).toHaveLength(1);
      privacy(g.host);
      privacy(g.guest);
      privacy(spectator);
      privacy(replacement);
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'aposta via %s: saldo protegido, escolhas privadas, reconexão e liquidação única',
    async (transport) => {
      const f = await fixture();
      const g = await f.group(transport);
      await g.open('wager');
      // Both earn their first balance through real commands before risking points.
      for (const client of [g.host, g.guest])
        expect(await client.command('answer:submit', g.answerPayload())).toMatchObject({
          status: 'ok',
        });
      await g.advance();
      const spectator = await f.connect(await f.issue(), transport);
      await spectator.command('room:join', { code: g.entry.code, profile });
      const host = await stage(g.host, 'wager-selection', g.room.snapshot().stateVersion);
      const payload = { ...g.context(), questionId: host.stage.questionId, amount: 50 };
      error(await spectator.command('wager:submit', payload), 'FORBIDDEN');
      error(await g.host.command('wager:submit', { ...payload, amount: 75 }), 'INVALID_PAYLOAD');
      error(
        await g.host.command('wager:submit', { ...payload, pointsAtSelection: 100 }),
        'INVALID_PAYLOAD',
      );
      error(await g.host.command('answer:submit', g.answerPayload()), 'INVALID_PHASE');
      const other = await f.connect(await f.issue(), transport);
      error(await other.command('wager:submit', payload), 'NOT_A_MEMBER');
      expect(await g.host.command('wager:submit', payload)).toMatchObject({ status: 'ok' });
      const version = g.room.snapshot().stateVersion;
      expect(await g.host.command('wager:submit', payload)).toMatchObject({
        status: 'ok',
        result: { stateVersion: version },
      });
      error(await g.host.command('wager:submit', { ...payload, amount: 25 }), 'ACTION_CONFLICT');
      const guest = await stage(g.guest, 'wager-selection', version);
      expect(guest.stage.ownWager).toEqual({ status: 'pending' });
      expect(JSON.stringify(guest.match)).not.toMatch(
        /"amount"|"prompt"|"options"|"wagerResults"|"wagers"/,
      );
      expect(guest.match.scoreboard.map((score) => score.points)).toEqual([100, 100]);
      const replacement = await f.connect(g.host.session, transport);
      const restored = await stage(replacement, 'wager-selection', g.room.snapshot().stateVersion);
      expect(restored.stage.ownWager).toEqual({ status: 'submitted', amount: 50 });
      expect(restored.stage.deadlineAt).toBe(host.stage.deadlineAt);
      expect(await g.guest.command('wager:submit', { ...payload, amount: 25 })).toMatchObject({
        status: 'ok',
      });
      await g.advance();
      await g.advance();
      const open = await stage(g.guest, 'question-open', g.room.snapshot().stateVersion);
      expect(open.stage.ownWager).toEqual({ status: 'submitted', amount: 25 });
      expect(open.match.scoreboard.map((score) => score.points)).toEqual([100, 100]);
      expect(await replacement.command('answer:submit', g.answerPayload())).toMatchObject({
        status: 'ok',
      });
      expect(await g.guest.command('answer:submit', g.answerPayload(false))).toMatchObject({
        status: 'ok',
      });
      const result = await stage(replacement, 'reveal', g.room.snapshot().stateVersion);
      expect(result.match.scoreboard.map((score) => score.points)).toEqual([250, 75]);
      expect(result.stage.wagerResults).toEqual([
        { playerId: g.host.session!.playerId, amount: 50, balanceBefore: 100, balanceAfter: 250 },
        { playerId: g.guest.session!.playerId, amount: 25, balanceBefore: 100, balanceAfter: 75 },
      ]);
      expect(g.state().history).toHaveLength(2);
      privacy(g.host);
      privacy(g.guest);
      privacy(spectator);
      privacy(replacement);
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'velocidade via %s: relógio do cliente recusado, reconexão e bônus oficial',
    async (transport) => {
      const f = await fixture();
      const g = await f.group(transport);
      await g.open('speed');
      const initial = await stage(g.host, 'question-open');
      expect(initial.match.speedRules?.correctPoints).toBe(100);
      const payload = g.answerPayload();
      error(
        await g.host.command('answer:submit', { ...payload, receivedAt: 0 }),
        'INVALID_PAYLOAD',
      );
      await f.time.advanceTo(initial.stage.opensAt + 5000);
      expect(await g.host.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
      const before = await stage(g.host, 'question-open', g.room.snapshot().stateVersion);
      expect(before.stage.ownAnswer.status).toBe('submitted');
      expect(before.match.scoreboard.every((score) => score.points === 0)).toBe(true);
      const replacement = await f.connect(g.host.session, transport);
      const restored = await stage(replacement, 'question-open', g.room.snapshot().stateVersion);
      expect(restored.stage.ownAnswer).toEqual(before.stage.ownAnswer);
      expect(restored.stage.deadlineAt).toBe(initial.stage.deadlineAt);
      error(await replacement.command('answer:submit', payload), 'ALREADY_ANSWERED');
      expect(await g.guest.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
      const result = await stage(replacement, 'reveal', g.room.snapshot().stateVersion);
      expect(result.match.scoreboard.map((score) => score.points)).toEqual([125, 125]);
      expect(
        result.stage.effects
          .filter((effect) => effect.reason === 'speed-bonus')
          .map((effect) => effect.amount),
      ).toEqual([25, 25]);
      privacy(g.host);
      privacy(g.guest);
      privacy(replacement);
    },
  );
  it.each(['websocket', 'polling'] as const)(
    'conclui seis questões com acerto/erro/ausência e matriz de privacidade via %s',
    async (transport) => {
      const f = await fixture(),
        g = await f.group(transport);
      await g.start();
      const spectator = await f.connect(await f.issue(), transport);
      expect(
        await spectator.command('room:join', {
          code: g.entry.code,
          profile: { ...profile, nickname: 'Cris' },
        }),
      ).toMatchObject({ status: 'ok' });
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'instructions', g.room.snapshot().stateVersion);
      for (const client of [g.host, g.guest])
        expect(await client.command('round:ready', g.context())).toMatchObject({ status: 'ok' });
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'category-selection', g.room.snapshot().stateVersion);
      await g.choose();
      for (const client of [g.host, g.guest, spectator])
        await stage(client, 'question-reading', g.room.snapshot().stateVersion);
      await g.advance();
      const seen = new Set<string>(),
        difficulties: string[] = [],
        correctPositions = new Set<number>();
      const answers = [
        [true, false],
        [null, true],
        [true, true],
        [false, false],
        [true, null],
        [null, null],
      ];
      const scores = [
        [100, 0],
        [100, 100],
        [200, 200],
        [200, 200],
        [300, 200],
        [300, 200],
      ];
      for (let index = 0; index < 6; index++) {
        const current = g.state().stage;
        if (current.phase !== 'question-open') throw new Error();
        expect(seen.has(current.question.publicQuestion.questionId)).toBe(false);
        seen.add(current.question.publicQuestion.questionId);
        difficulties.push(current.question.publicQuestion.difficulty);
        correctPositions.add(
          current.question.publicQuestion.options.findIndex(
            (option) => option.optionId === current.question.correctOptionId,
          ),
        );
        expect(
          current.question.publicQuestion.options.every(
            (option) =>
              !current.question.editorialOptionByPublicId.has(option.optionId) ||
              current.question.editorialOptionByPublicId.get(option.optionId) !== option.optionId,
          ),
        ).toBe(true);
        for (const client of [g.host, g.guest, spectator]) {
          const opened = await stage(client, 'question-open', g.room.snapshot().stateVersion);
          expect(opened.match.progress).toEqual({
            roundNumber: 1,
            roundCount: 1,
            questionNumber: index + 1,
            questionCount: 6,
          });
        }
        expect((await stage(spectator, 'question-open')).stage.ownAnswer.status).toBe(
          'unavailable',
        );
        for (const [player, client] of [g.host, g.guest].entries()) {
          const correct = answers[index]![player];
          if (correct === null) continue;
          const payload = g.answerPayload(correct),
            actionId = crypto.randomUUID();
          const ack = await client.command('answer:submit', payload, actionId);
          expect(ack).toMatchObject({
            status: 'ok',
            event: 'answer:submit',
            result: { acceptance: 'recorded' },
          });
          expect(JSON.stringify(ack)).not.toMatch(/correct|explanation|points|optionId/);
          const version = g.room.snapshot().stateVersion;
          const repeated = await client.command('answer:submit', payload, actionId);
          expect(repeated.status).toBe('error');
          expect(g.room.snapshot().stateVersion).toBe(version);
        }
        if (g.state().stage.phase === 'question-open') await g.advance();
        for (const client of [g.host, g.guest, spectator]) {
          const revealed = await stage(client, 'reveal', g.room.snapshot().stateVersion);
          expect(revealed.stage.reveal.correctOptionId).toBe(current.question.correctOptionId);
          expect(revealed.stage.reveal.explanation).toBe(current.question.explanation);
          expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual(scores[index]);
          expect(
            revealed.stage.effects.every(
              (effect) => effect.kind === 'credit' && effect.amount === 100,
            ),
          ).toBe(true);
        }
        await g.advance();
        if (index < 5) {
          for (const client of [g.host, g.guest, spectator])
            await stage(client, 'question-reading', g.room.snapshot().stateVersion);
          await g.advance();
        }
      }
      expect(difficulties.filter((difficulty) => difficulty === 'easy')).toHaveLength(3);
      expect(difficulties.filter((difficulty) => difficulty === 'medium')).toHaveLength(3);
      expect(correctPositions.size).toBeGreaterThan(1);
      await stage(g.host, 'round-results', g.room.snapshot().stateVersion);
      await g.advance();
      for (const client of [g.host, g.guest, spectator]) {
        const complete = await stage(client, 'prototype-complete', g.room.snapshot().stateVersion);
        expect(complete.match.progress).toEqual({
          roundNumber: 1,
          roundCount: 1,
          questionNumber: 6,
          questionCount: 6,
        });
        expect(complete.match.scoreboard.map((score) => score.correctAnswers)).toEqual([3, 2]);
        privacy(client);
      }
      const oldContext = g.context();
      error(
        await g.guest.command('match:returnToLobby', {
          roomId: g.room.id,
          matchId: oldContext.matchId,
        }),
        'FORBIDDEN',
      );
      expect(
        await g.host.command('match:returnToLobby', {
          roomId: g.room.id,
          matchId: oldContext.matchId,
        }),
      ).toMatchObject({ status: 'ok' });
      await view(
        g.host,
        (view) =>
          view.state.status === 'lobby' && view.stateVersion === g.room.snapshot().stateVersion,
      );
      await g.start();
      expect(g.state().roster.matchId).not.toBe(oldContext.matchId);
      error(await g.host.command('round:ready', oldContext), 'STALE_CONTEXT');
    },
  );

  it('limita início ao anfitrião com dois jogadores e autentica todos os comandos', async () => {
    const f = await fixture(),
      host = await f.connect(await f.issue());
    const created = await host.command('room:create', { profile, settings });
    if (created.status !== 'ok' || created.event !== 'room:create') throw new Error();
    const roomId = created.result.roomId;
    error(await host.command('match:start', { roomId }), 'NOT_ENOUGH_PLAYERS');
    const guest = await f.connect(await f.issue());
    await guest.command('room:join', { code: created.result.code, profile });
    error(await guest.command('match:start', { roomId }), 'FORBIDDEN');
    const anonymous = await f.connect();
    error(await anonymous.command('match:start', { roomId }), 'UNAUTHENTICATED');
    expect(await host.command('match:start', { roomId })).toMatchObject({ status: 'ok' });
    error(await host.command('match:start', { roomId }), 'INVALID_PHASE');
  });

  it('serializa respostas simultâneas e resolve uma única vez mesmo com reenvio concorrente', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload(),
      id = crypto.randomUUID();
    const acknowledgements = await Promise.all([
      g.host.command('answer:submit', payload, id),
      g.host.command('answer:submit', payload, id),
      g.guest.command('answer:submit', payload),
    ]);
    expect(acknowledgements.filter((ack) => ack.status === 'ok')).toHaveLength(2);
    expect(acknowledgements.filter((ack) => ack.status === 'error')).toHaveLength(1);
    const revealed = await stage(g.host, 'reveal', g.room.snapshot().stateVersion);
    expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    expect(g.state().history).toHaveLength(1);
  });

  it('bloqueia espectadores, outras salas, retorno prematuro e modalidades não instaladas', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const other = await f.connect(await f.issue());
    error(await other.command('answer:submit', g.answerPayload()), 'NOT_A_MEMBER');
    await other.command('room:create', { profile, settings });
    error(await other.command('round:ready', g.context()), 'NOT_A_MEMBER');
    const spectator = await f.connect(await f.issue());
    await spectator.command('room:join', { code: g.entry.code, profile });
    for (const [event, payload] of [
      ['round:ready', g.context()],
      ['category:choose', { ...g.context(), category: 'history' }],
      ['answer:submit', g.answerPayload()],
    ] as const)
      error(await spectator.command(event, payload), 'FORBIDDEN');
    error(
      await g.host.command('match:returnToLobby', {
        roomId: g.room.id,
        matchId: g.context().matchId,
      }),
      'INVALID_PHASE',
    );
    error(
      await g.host.command('wager:submit', {
        ...g.context(),
        questionId: g.answerPayload().questionId,
        amount: 0,
      }),
      'INVALID_PHASE',
    );
    error(
      await g.host.command('target:choose', {
        ...g.context(),
        questionId: g.answerPayload().questionId,
        targetPlayerId: g.guest.session!.playerId,
      }),
      'INVALID_PHASE',
    );
    privacy(spectator);
  });

  it('valida prontidão, escolha do tema e proíbe resposta durante a leitura', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.start();
    for (const client of [g.host, g.guest])
      expect(await client.command('round:ready', g.context())).toMatchObject({ status: 'ok' });
    const offer = (await stage(g.host, 'category-selection', g.room.snapshot().stateVersion)).stage;
    const wrong = [g.host, g.guest].find(
      (client) => client.session!.playerId !== offer.chooserPlayerId,
    )!;
    error(
      await wrong.command('category:choose', { ...g.context(), category: offer.categories[0] }),
      'FORBIDDEN',
    );
    const chooser = [g.host, g.guest].find((client) => client !== wrong)!;
    error(
      await chooser.command('category:choose', { ...g.context(), category: 'not-offered' }),
      'INVALID_PAYLOAD',
    );
    await g.choose();
    error(await g.host.command('answer:submit', g.answerPayload()), 'INVALID_PHASE');
    await g.advance();
    expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
  });

  it.each(['correct', 'points', 'receivedAt', 'playerId'] as const)(
    'recusa campo privado %s e não modifica a sala',
    async (field) => {
      const f = await fixture(),
        g = await f.group();
      await g.open();
      const before = g.room.snapshot();
      error(
        await g.host.command('answer:submit', {
          ...g.answerPayload(),
          [field]: field === 'playerId' ? g.guest.session!.playerId : 100,
        }),
        'INVALID_PAYLOAD',
      );
      expect(g.room.snapshot()).toEqual(before);
    },
  );

  it('recusa IDs inválidos, contexto antigo e alternativa estranha sem consumir a resposta', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload(),
      before = g.room.snapshot();
    error(
      await g.host.command('answer:submit', { ...payload, optionId: 'option-0' }),
      'INVALID_PAYLOAD',
    );
    error(
      await g.host.command('answer:submit', { ...payload, optionId: crypto.randomUUID() }),
      'INVALID_PAYLOAD',
    );
    for (const key of ['matchId', 'roundId', 'questionId'])
      error(
        await g.host.command('answer:submit', { ...payload, [key]: crypto.randomUUID() }),
        'STALE_CONTEXT',
      );
    expect(g.room.snapshot()).toEqual(before);
    expect(await g.host.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
  });

  it('aceita até um ms antes do prazo e mede a resposta na fila no prazo exato', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const deadline = matchTimer(g.state())!.deadlineAt,
      now = vi.spyOn(f.runtime.clock, 'now');
    now.mockReturnValue(deadline - 1);
    expect(await g.host.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
    now.mockReturnValue(deadline);
    error(await g.guest.command('answer:submit', g.answerPayload()), 'DEADLINE_EXPIRED');
    await g.advance();
    const revealed = await stage(g.host, 'reveal', g.room.snapshot().stateVersion);
    expect(revealed.match.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
  });

  it('restaura resposta própria após reconexão sem reabrir janela ou expor escolha alheia', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    const payload = g.answerPayload();
    expect(await g.host.command('answer:submit', payload)).toMatchObject({ status: 'ok' });
    const deadline = matchTimer(g.state())!.deadlineAt;
    const current = await f.connect(g.host.session);
    const restored = await stage(current, 'question-open', g.room.snapshot().stateVersion);
    expect(restored.stage.ownAnswer).toEqual({ status: 'submitted', optionId: payload.optionId });
    expect(restored.stage.deadlineAt).toBe(deadline);
    expect(
      (await stage(g.guest, 'question-open', g.room.snapshot().stateVersion)).stage.ownAnswer
        .status,
    ).toBe('pending');
    error(await current.command('answer:submit', payload), 'ALREADY_ANSWERED');
    expect(await g.guest.command('answer:submit', g.answerPayload(false))).toMatchObject({
      status: 'ok',
    });
    expect(
      (await stage(current, 'reveal', g.room.snapshot().stateVersion)).match.scoreboard.map(
        (entry) => entry.points,
      ),
    ).toEqual([100, 0]);
    privacy(current);
    privacy(g.guest);
  });

  it('descarta resposta da conexão substituída enquanto ela aguardava na fila', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    let release!: () => void;
    const held = g.room.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const original = f.app.matches!.execute.bind(f.app.matches);
    const called = vi
      .spyOn(f.app.matches!, 'execute')
      .mockImplementation((...args) => original(...args));
    g.host.socket.emit(
      'answer:submit',
      {
        protocolVersion: 1,
        actionId: crypto.randomUUID(),
        event: 'answer:submit',
        payload: g.answerPayload(),
      },
      () => {},
    );
    let current: Client;
    try {
      await vi.waitFor(() => expect(called).toHaveBeenCalledOnce());
      current = await f.connect(g.host.session);
    } finally {
      release();
    }
    await held;
    const restored = await stage(current!, 'question-open', g.room.snapshot().stateVersion);
    expect(restored.stage.ownAnswer.status).toBe('pending');
    expect(restored.stage.answeredPlayerIds).toEqual([]);
    expect(await current!.command('answer:submit', g.answerPayload())).toMatchObject({
      status: 'ok',
    });
  });

  it('mantém lobby quando falta conteúdo e não publica uma partida parcial', async () => {
    const f = await fixture({ questions: { ...repository(), list: () => [] } }),
      g = await f.group();
    const before = g.room.snapshot();
    error(await g.host.command('match:start', { roomId: g.room.id }), 'INSUFFICIENT_QUESTIONS');
    expect(g.room.snapshot()).toEqual(before);
    expect(
      g.host.events.some(
        (event) => event.event === 'room:view' && event.payload.state.status === 'match',
      ),
    ).toBe(false);
  });

  it.each(['development', 'production'] as const)(
    'restringe o protótipo ao ambiente apropriado: %s',
    async (environment) => {
      const f = await fixture({
        config: loadConfig({
          NODE_ENV: environment,
          ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
          LOG_LEVEL: 'silent',
        }),
      });
      const g = await f.group();
      const ack = await g.host.command('match:start', { roomId: g.room.id });
      if (environment === 'production') {
        error(ack, 'INVALID_PHASE');
        expect(f.app.matches).toBeUndefined();
        expect(g.room.snapshot().phase.status).toBe('lobby');
      } else {
        expect(ack.status).toBe('ok');
        await stage(g.host, 'instructions');
      }
    },
  );

  it('recupera falha de preparação sem vazar dados privados pelo ack', async () => {
    const lines: string[] = [];
    const f = await fixture({
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const g = await f.group();
    await g.start();
    for (const client of [g.host, g.guest]) await client.command('round:ready', g.context());
    const offer = (await stage(g.host, 'category-selection', g.room.snapshot().stateVersion)).stage;
    const chooser = [g.host, g.guest].find(
      (client) => client.session!.playerId === offer.chooserPlayerId,
    )!;
    vi.spyOn(QuestionSelection.prototype, 'currentQuestion').mockImplementationOnce(() => {
      throw new Error('gabarito-secreto token-secreto caminho-interno');
    });
    const before = g.room.snapshot();
    const payload = { ...g.context(), category: offer.categories[0] };
    const ack = await chooser.command('category:choose', payload);
    error(ack, 'INTERNAL_ERROR');
    expect(g.room.snapshot()).toEqual(before);
    expect(JSON.stringify(ack) + lines.join('')).not.toMatch(
      /gabarito-secreto|token-secreto|caminho-interno/,
    );
    expect(await chooser.command('category:choose', payload)).toMatchObject({ status: 'ok' });
    await stage(g.host, 'question-reading', g.room.snapshot().stateVersion);
  });

  it('encerra partida ativa e limpa agendamentos e transportes', async () => {
    const f = await fixture(),
      g = await f.group();
    await g.open();
    await f.app.close();
    await vi.waitFor(() =>
      expect(g.host.events.some((event) => event.event === 'room:removed')).toBe(true),
    );
    expect(f.time.pendingCount).toBe(0);
    expect(f.app.rooms.registry.all()).toHaveLength(0);
    expect(f.app.realtime.engine.clientsCount).toBe(0);
  });
});

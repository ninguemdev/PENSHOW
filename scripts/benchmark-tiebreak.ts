import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import assert from 'node:assert/strict';
import { defaultAvatar, playerIdSchema } from '../packages/shared/src/index.js';
import { createTestRuntime } from '../apps/server/src/test-support/runtime.js';
import { repository, uuid } from '../apps/server/src/test-support/match.js';
import { RoomService } from '../apps/server/src/modules/rooms/room.service.js';
import { MatchService, matchContext } from '../apps/server/src/modules/matches/match.service.js';
import { matchTimer } from '../apps/server/src/modules/matches/match.domain.js';
import { createRoomPublisher } from '../apps/server/src/modules/views/room-publisher.js';
import type { Room } from '../apps/server/src/modules/rooms/room.js';

const { runtime, time } = createTestRuntime();
let seed = 39;
runtime.random = {
  integer: (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  },
};
const costs: number[] = [],
  errors: unknown[] = [];
let measuring = false,
  frames = 0,
  views = 0,
  maxFrameBytes = 0,
  maxPending = 0;
runtime.scheduler = {
  scheduleAt: (at, task) =>
    time.scheduleAt(at, async () => {
      const start = performance.now();
      await task();
      if (measuring) costs.push(performance.now() - start);
      maxPending = Math.max(maxPending, time.pendingCount);
    }),
  dispose: () => time.dispose(),
};
const matches = new MatchService({
  runtime,
  questions: repository(true, 60),
  onError: () => errors.push('match'),
});
const publisher = createRoomPublisher({
  clock: time,
  isCurrent: () => true,
  send: (_actor, event) => {
    if (!measuring) return;
    if (event.event === 'tiebreak:frame') {
      frames++;
      maxFrameBytes = Math.max(maxFrameBytes, Buffer.byteLength(JSON.stringify(event)));
    } else views++;
  },
  onError: () => errors.push('view'),
});
const rooms = new RoomService({
  runtime,
  quiz: matches,
  onChange: publisher,
  onError: () => errors.push('room'),
});
function state(room: Room) {
  const phase = room.snapshot().phase;
  assert(phase.status === 'match' && phase.game);
  return phase.game.state;
}
const groups: {
  room: Room;
  actors: { playerId: ReturnType<typeof playerIdSchema.parse>; connectionId: string }[];
}[] = [];
try {
  for (let i = 0; i < 3; i++) {
    const actors = Array.from({ length: 12 }, (_, j) => ({
      playerId: playerIdSchema.parse(uuid(i * 20 + j + 1)),
      connectionId: `load-${i}-${j}`,
    }));
    const profile = { nickname: 'Carga', avatar: defaultAvatar() };
    const entry = await rooms.create(actors[0]!, profile, {
      format: 'prototype-v1',
      maxPlayers: 12,
      enabledCategories: ['history'],
    });
    for (const actor of actors.slice(1)) await rooms.join(actor, entry.code, profile);
    const room = rooms.registry.byId(entry.roomId)!;
    groups.push({ room, actors });
    await rooms.start(actors[0]!, room.id, 'classic');
  }
  while (groups.some((g) => state(g.room).stage.phase !== 'prototype-complete')) {
    const deadlines = groups
      .map((g) => matchTimer(state(g.room))?.deadlineAt)
      .filter((x): x is number => x !== undefined);
    assert(deadlines.length);
    await time.advanceTo(Math.min(...deadlines));
  }
  for (const g of groups) {
    await matches.startFinal(g.room, g.actors[0]!, state(g.room).roster.matchId);
    for (const actor of g.actors)
      await matches.execute(g.room, actor, { kind: 'ready', ...matchContext(state(g.room)) });
  }
  while (groups.some((g) => state(g.room).final?.stage.phase !== 'final-tiebreak')) {
    await time.advanceTo(Math.min(...groups.map((g) => matchTimer(state(g.room))!.deadlineAt)));
  }
  for (const g of groups)
    for (const actor of g.actors)
      await matches.execute(g.room, actor, { kind: 'ready', ...matchContext(state(g.room)) });
  await time.advanceTo(Math.max(...groups.map((g) => matchTimer(state(g.room))!.deadlineAt)));
  measuring = true;
  const started = performance.now();
  // Five virtual minutes at the normal server step rate, with three independently scheduled rooms.
  // Combat/traffic correctness and active projectile work are covered by service/domain/e2e tests.
  await time.advanceTo(time.now() + 300000);
  const elapsed = performance.now() - started;
  measuring = false;
  costs.sort((a, b) => a - b);
  const p95 = costs[Math.floor(costs.length * 0.95)] ?? 0;
  assert.equal(errors.length, 0);
  assert.equal(costs.length, 18000);
  assert.equal(views, 0);
  assert.equal(maxPending, 6);
  const report = {
    recordedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    cpu: cpus()[0]?.model,
    rooms: 3,
    playersPerRoom: 12,
    virtualDurationMs: 300000,
    steps: costs.length,
    stepP95Ms: Number(p95.toFixed(3)),
    maxStepMs: Number(Math.max(...costs).toFixed(3)),
    wallTimeMs: Number(elapsed.toFixed(3)),
    framesSent: frames,
    maxFrameBytes,
    fullViewsDuringMovement: views,
    maxPendingTimers: maxPending,
    errors: errors.length,
    workload:
      'Neutral controls; fixed-step scheduling, room transactions, cloning, projection and compact-frame publication. Active shots and survival covered separately.',
  };
  await mkdir(new URL('../docs/validation/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../docs/validation/t39-load.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  assert(p95 < 25, `Passo p95 excedeu 25ms: ${p95}`);
} finally {
  await rooms.dispose();
  await time.dispose();
}
assert.equal(time.pendingCount, 0);

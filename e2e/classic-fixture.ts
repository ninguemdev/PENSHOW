import { test as base } from './fixtures.ts';
import { createSite } from './site.ts';
import { createSystemRuntime } from '../apps/server/src/platform/runtime.ts';
import { DEFAULT_ROOM_POLICY } from '../apps/server/src/modules/rooms/room-policy.ts';
import { buildPlayerView } from '../apps/server/src/modules/views/build-player-view.ts';
import {
  PROTOTYPE_PARAMETERS,
  prototypeParametersSchema,
} from '../apps/server/src/modules/scoring/match-rules.ts';

/** Real transports and rules; only the timing profile and random port are test-specific. */
export const test = base.extend<{ roundResultsMs: number }>({
  roundResultsMs: [700, { option: true }],
  site: async ({ roundResultsMs }, use) => {
    const runtime = createSystemRuntime((error) => {
      throw error;
    });
    let seed = 36;
    runtime.random = {
      integer: (max) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % max;
      },
    };
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.timings.readingMs = 150;
    parameters.timings.transitionMs = 100;
    parameters.timings.roundResultsMs = roundResultsMs;
    parameters.wager.selectionMs = 2000;
    for (const mode of ['classic', 'speed', 'wager', 'theft', 'pressure', 'final'] as const)
      parameters[mode].revealMs = 500;
    const site = await createSite({
      runtime,
      matchParameters: parameters,
      roomPolicy: { ...DEFAULT_ROOM_POLICY, hostTransferGraceMs: 1000 },
    });
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
});
export { expect } from './fixtures.ts';

test.afterEach(async ({ site }, info) => {
  if (info.status === info.expectedStatus) return;
  const rooms = site.app.rooms.registry.all().map((room) => {
    const snapshot = room.snapshot();
    return snapshot.members.map((member) =>
      buildPlayerView(snapshot, member.playerId, site.app.runtime.clock.now()),
    );
  });
  await info.attach('estado-publico.json', {
    body: JSON.stringify(rooms, null, 2),
    contentType: 'application/json',
  });
});

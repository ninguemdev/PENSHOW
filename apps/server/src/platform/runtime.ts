import { randomInt, randomUUID } from 'node:crypto';
import type { Runtime } from '../ports.js';
import { SystemScheduler } from './scheduler.js';

export function createSystemRuntime(onTaskError: (error: unknown) => void): Runtime {
  const clock = { now: () => Date.now() };
  return {
    clock,
    scheduler: new SystemScheduler(clock, onTaskError),
    ids: { next: () => randomUUID() },
    random: {
      integer: (maxExclusive) => {
        if (
          !Number.isSafeInteger(maxExclusive) ||
          maxExclusive < 1 ||
          maxExclusive > 281474976710655
        )
          throw new Error('O limite do sorteio deve estar entre 1 e 2^48 − 1.');
        return randomInt(maxExclusive);
      },
    },
  };
}

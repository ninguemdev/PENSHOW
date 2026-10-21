import { describe, expect, it } from 'vitest';
import { createTestRuntime } from '../test-support/runtime.js';
import { TrafficLimiter } from './traffic-policy.js';

describe('orçamento de tráfego limitado em memória', () => {
  it('isola identidades, não renova janela com spam e recupera capacidade expirada', async () => {
    const { time } = createTestRuntime();
    const limiter = new TrafficLimiter(time, 1000, 2, 2);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
    expect(limiter.take('c')).toBe(false);
    await time.advanceTo(1999);
    expect(limiter.take('a')).toBe(false);
    await time.advanceTo(2000);
    expect(limiter.take('c')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    limiter.clear();
    expect(limiter.take('b')).toBe(true);
  });
});

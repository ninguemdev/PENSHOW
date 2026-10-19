import { actionIdSchema } from '@penshow/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRuntime, ManualTime } from '../test-support/runtime.js';
import { createSystemRuntime } from './runtime.js';
import { SystemScheduler } from './scheduler.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('tempo e dependências determinísticas', () => {
  it('executa no prazo em ordem estável, incluindo tarefas agendadas por outra', async () => {
    const time = new ManualTime(1000);
    const events: string[] = [];
    time.scheduleAt(1200, () => {
      events.push('last');
    });
    time.scheduleAt(1100, () => {
      events.push('first');
      time.scheduleAt(1100, () => {
        events.push('nested');
      });
    });
    time.scheduleAt(1100, () => {
      events.push('second');
    });
    await time.advanceTo(1099);
    expect(events).toEqual([]);
    await time.advanceTo(1200);
    expect(events).toEqual(['first', 'second', 'nested', 'last']);
    expect(time.now()).toBe(1200);
    expect(time.pendingCount).toBe(0);
  });
  it('cancela de forma idempotente e encerra sem timers reais', async () => {
    const time = new ManualTime();
    const task = vi.fn();
    const cancel = time.scheduleAt(2000, task);
    cancel();
    cancel();
    await time.advanceTo(2000);
    expect(task).not.toHaveBeenCalled();
    time.scheduleAt(3000, task);
    await time.dispose();
    await time.advanceTo(4000);
    expect(task).not.toHaveBeenCalled();
    expect(() => time.scheduleAt(5000, task)).toThrow('encerrado');
    await expect(time.advanceTo(3000)).rejects.toThrow('avançar');
  });
  it('oferece IDs e sorteios determinísticos e recusa sequência esgotada', () => {
    const { runtime } = createTestRuntime(7000, [2, 0]);
    expect(runtime.clock.now()).toBe(7000);
    expect(actionIdSchema.parse(runtime.ids.next())).toBe('00000000-0000-4000-8000-000000000001');
    expect(runtime.ids.next()).toBe('00000000-0000-4000-8000-000000000002');
    expect(runtime.random.integer(3)).toBe(2);
    expect(runtime.random.integer(1)).toBe(0);
    expect(() => runtime.random.integer(3)).toThrow('esgotado');
  });
});

describe('agendador de produção com timers controlados', () => {
  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const report = vi.fn();
    return { scheduler: new SystemScheduler({ now: () => Date.now() }, report), report };
  }
  it('executa no prazo e limpa timers cancelados e pendentes', async () => {
    const { scheduler } = setup();
    const task = vi.fn();
    scheduler.scheduleAt(2000, task);
    const cancel = scheduler.scheduleAt(1500, task);
    cancel();
    cancel();
    await vi.advanceTimersByTimeAsync(999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    scheduler.scheduleAt(3000, task);
    await scheduler.dispose();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(() => scheduler.scheduleAt(4000, task)).toThrow('encerrado');
  });
  it('não antecipa prazos maiores que o limite de setTimeout', async () => {
    const { scheduler } = setup();
    const task = vi.fn();
    scheduler.scheduleAt(1000 + 2147483647 + 10, task);
    await vi.advanceTimersByTimeAsync(2147483647);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(task).toHaveBeenCalledOnce();
    await scheduler.dispose();
  });
  it('trata falha sem interromper as próximas tarefas', async () => {
    const { scheduler, report } = setup();
    const failure = new Error('falha controlada');
    const next = vi.fn();
    scheduler.scheduleAt(1000, () => {
      throw failure;
    });
    scheduler.scheduleAt(1100, next);
    await vi.advanceTimersByTimeAsync(100);
    expect(report).toHaveBeenCalledWith(failure);
    expect(next).toHaveBeenCalledOnce();
    await scheduler.dispose();
  });
  it('aguarda uma tarefa que já começou ao encerrar', async () => {
    const { scheduler } = setup();
    const work = Promise.withResolvers<void>();
    scheduler.scheduleAt(1000, () => work.promise);
    await vi.advanceTimersByTimeAsync(0);
    let disposed = false;
    const closing = scheduler.dispose().then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);
    work.resolve();
    await closing;
    expect(disposed).toBe(true);
  });
  it.each([-1, NaN, Infinity, 1.5])('recusa prazo inválido: %s', async (deadline) => {
    const { scheduler } = setup();
    expect(() => scheduler.scheduleAt(deadline, () => {})).toThrow('prazo');
    await scheduler.dispose();
  });
  it('usa UUIDv4 e sorteio criptográfico com limites explícitos', async () => {
    const runtime = createSystemRuntime(vi.fn());
    expect(actionIdSchema.safeParse(runtime.ids.next()).success).toBe(true);
    expect(runtime.random.integer(1)).toBe(0);
    for (const limit of [0, -1, 1.5, Infinity, 281474976710656])
      expect(() => runtime.random.integer(limit)).toThrow('limite');
    await runtime.scheduler.dispose();
  });
});

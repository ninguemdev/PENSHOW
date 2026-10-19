import type { Clock, Runtime, ScheduledTask, Scheduler } from '../ports.js';

export class ManualTime implements Clock, Scheduler {
  private current: number;
  private sequence = 0;
  private disposed = false;
  private readonly tasks = new Map<number, { deadline: number; task: ScheduledTask }>();
  private readonly running = new Set<Promise<void>>();

  constructor(initialTime = 1000) {
    this.current = initialTime;
  }
  now() {
    return this.current;
  }
  get pendingCount() {
    return this.tasks.size;
  }

  scheduleAt(deadline: number, task: ScheduledTask) {
    if (this.disposed) throw new Error('O agendador foi encerrado.');
    if (!Number.isSafeInteger(deadline) || deadline < 0) throw new Error('Prazo inválido.');
    const id = this.sequence++;
    this.tasks.set(id, { deadline, task });
    return () => {
      this.tasks.delete(id);
    };
  }

  async advanceTo(target: number) {
    if (!Number.isSafeInteger(target) || target < this.current)
      throw new Error('O relógio manual só pode avançar.');
    for (;;) {
      const next = [...this.tasks.entries()]
        .filter(([, entry]) => entry.deadline <= target)
        .sort(
          ([leftId, left], [rightId, right]) => left.deadline - right.deadline || leftId - rightId,
        )[0];
      if (!next) break;
      const [id, entry] = next;
      this.tasks.delete(id);
      this.current = Math.max(this.current, entry.deadline);
      const execution = Promise.resolve().then(entry.task);
      this.running.add(execution);
      try {
        await execution;
      } finally {
        this.running.delete(execution);
      }
    }
    this.current = target;
  }

  async dispose() {
    this.disposed = true;
    this.tasks.clear();
    await Promise.allSettled(this.running);
  }
}

export function createTestRuntime(initialTime = 1000, randomValues: readonly number[] = [0]) {
  const time = new ManualTime(initialTime);
  let nextId = 1;
  let randomIndex = 0;
  const runtime: Runtime = {
    clock: time,
    scheduler: time,
    ids: { next: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}` },
    random: {
      integer: (maxExclusive) => {
        if (
          !Number.isSafeInteger(maxExclusive) ||
          maxExclusive < 1 ||
          maxExclusive > 281474976710655
        )
          throw new Error('Limite de sorteio inválido.');
        const value = randomValues[randomIndex++];
        if (value === undefined || !Number.isInteger(value) || value < 0 || value >= maxExclusive)
          throw new Error('Sorteio determinístico inválido ou esgotado.');
        return value;
      },
    },
  };
  return { time, runtime };
}

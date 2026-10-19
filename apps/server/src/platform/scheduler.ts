import type { Clock, ScheduledTask, Scheduler } from '../ports.js';

export class SystemScheduler implements Scheduler {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly running = new Set<Promise<void>>();
  private disposed = false;

  constructor(
    private readonly clock: Clock,
    private readonly onError: (error: unknown) => void,
  ) {}

  scheduleAt(deadline: number, task: ScheduledTask) {
    if (this.disposed) throw new Error('O agendador foi encerrado.');
    if (!Number.isSafeInteger(deadline) || deadline < 0)
      throw new Error('O prazo deve ser um instante inteiro seguro e não negativo.');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          this.timers.delete(timer);
          if (cancelled || this.disposed) return;
          if (this.clock.now() < deadline) {
            schedule();
            return;
          }
          const execution = Promise.resolve().then(task).catch(this.onError);
          this.running.add(execution);
          void execution.finally(() => this.running.delete(execution));
        },
        Math.min(Math.max(0, deadline - this.clock.now()), 2147483647),
      );
      this.timers.add(timer);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      this.timers.delete(timer);
    };
  }

  async dispose() {
    this.disposed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled(this.running);
  }
}

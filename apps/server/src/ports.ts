export interface Clock {
  now(): number;
}

export type ScheduledTask = () => void | Promise<void>;
export type CancelTask = () => void;

export interface Scheduler {
  scheduleAt(deadline: number, task: ScheduledTask): CancelTask;
  dispose(): Promise<void>;
}

export interface IdGenerator {
  next(): string;
}

export interface RandomSource {
  integer(maxExclusive: number): number;
}

export interface Runtime {
  clock: Clock;
  scheduler: Scheduler;
  ids: IdGenerator;
  random: RandomSource;
}

export interface SessionTokenCodec {
  issue(): string;
  hash(token: string): string;
}

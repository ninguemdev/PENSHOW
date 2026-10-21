import type { Clock } from '../ports.js';

export const DEFAULT_TRAFFIC_POLICY = Object.freeze({
  windowMs: 60_000,
  sessionCreatesPerWindow: 60,
  sessionRequestsPerWindow: 240,
  handshakesPerWindow: 240,
  commandsPerWindow: 240,
  maxTrackedKeys: 16_384,
  maxPendingCommands: 16,
  maxSessions: 10_000,
  maxConnections: 2_048,
  maxRooms: 500,
});
export type TrafficPolicy = { [Key in keyof typeof DEFAULT_TRAFFIC_POLICY]: number };

export function validateTrafficPolicy(policy: TrafficPolicy): Readonly<TrafficPolicy> {
  if (Object.values(policy).some((value) => !Number.isSafeInteger(value) || value < 1))
    throw new Error('Os limites de tráfego devem ser inteiros positivos.');
  return Object.freeze({ ...policy });
}

/** Fixed windows start on first use. Expired keys are reclaimed without extra timers. */
export class TrafficLimiter {
  private readonly entries = new Map<string, { expiresAt: number; count: number }>();
  private nextSweep = 0;

  constructor(
    private readonly clock: Clock,
    private readonly windowMs: number,
    private readonly limit: number,
    private readonly maxKeys: number,
  ) {}

  take(key: string): boolean {
    const now = this.clock.now();
    if (now >= this.nextSweep) {
      for (const [id, entry] of this.entries) if (now >= entry.expiresAt) this.entries.delete(id);
      this.nextSweep = now + this.windowMs;
    }
    let entry = this.entries.get(key);
    if (entry && now >= entry.expiresAt) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (this.entries.size >= this.maxKeys) return false;
      entry = { expiresAt: now + this.windowMs, count: 0 };
      this.entries.set(key, entry);
    }
    if (entry.count >= this.limit) return false;
    entry.count++;
    return true;
  }

  clear() {
    this.entries.clear();
  }
}

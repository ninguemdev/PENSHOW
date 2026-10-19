import { guestSessionTokenSchema, playerIdSchema } from '@penshow/shared';
import type { GuestSession, IssuedGuestSession, PlayerId } from '@penshow/shared';
import type { CancelTask, Clock, IdGenerator, Scheduler, SessionTokenCodec } from '../../ports.js';

export const SESSION_SWEEP_INTERVAL_MS = 600000;

export interface SessionProof {
  readonly playerId: PlayerId;
  readonly tokenHash: string;
}

export interface StoredGuestSession extends SessionProof {
  readonly expiresAt: number;
}

interface SessionStoreDependencies {
  clock: Clock;
  scheduler: Scheduler;
  ids: IdGenerator;
  tokens: SessionTokenCodec;
  ttlMs: number;
}

export class GuestSessionStore {
  private readonly sessions = new Map<string, StoredGuestSession>();
  private readonly playerIds = new Set<PlayerId>();
  private cancelSweep: CancelTask | undefined;
  private disposed = false;

  constructor(private readonly deps: SessionStoreDependencies) {
    if (!Number.isSafeInteger(deps.ttlMs) || deps.ttlMs < 1000 || deps.ttlMs > 604800000)
      throw new Error('A validade da sessão deve estar entre 1 segundo e 7 dias.');
  }

  create(): IssuedGuestSession {
    if (this.disposed) throw new Error('O registro de sessões foi encerrado.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = guestSessionTokenSchema.parse(this.deps.tokens.issue());
      const tokenHash = this.deps.tokens.hash(token);
      const playerId = playerIdSchema.parse(this.deps.ids.next());
      if (this.sessions.has(tokenHash) || this.playerIds.has(playerId)) continue;
      const expiresAt = this.nextExpiry();
      this.sessions.set(tokenHash, Object.freeze({ playerId, tokenHash, expiresAt }));
      this.playerIds.add(playerId);
      return { scope: 'penshow', token, playerId, expiresAt };
    }
    throw new Error('Não foi possível emitir uma sessão única.');
  }

  authenticate(token: unknown): StoredGuestSession | null {
    if (this.disposed) return null;
    const parsed = guestSessionTokenSchema.safeParse(token);
    if (!parsed.success) return null;
    return this.find(this.deps.tokens.hash(parsed.data));
  }

  verify(proof: SessionProof): StoredGuestSession | null {
    if (this.disposed) return null;
    const session = this.find(proof.tokenHash);
    return session?.playerId === proof.playerId ? session : null;
  }

  renew(proof: SessionProof): GuestSession | null {
    const session = this.verify(proof);
    if (!session) return null;
    const expiresAt = Math.max(session.expiresAt, this.nextExpiry());
    this.sessions.set(session.tokenHash, Object.freeze({ ...session, expiresAt }));
    return { scope: 'penshow', playerId: session.playerId, expiresAt };
  }

  startSweeping() {
    if (this.disposed || this.cancelSweep) return;
    const sweep = () => {
      this.cancelSweep = undefined;
      if (this.disposed) return;
      for (const hash of this.sessions.keys()) this.find(hash);
      this.startSweeping();
    };
    this.cancelSweep = this.deps.scheduler.scheduleAt(
      this.deps.clock.now() + SESSION_SWEEP_INTERVAL_MS,
      sweep,
    );
  }

  entries(): readonly StoredGuestSession[] {
    return Object.freeze([...this.sessions.values()]);
  }

  dispose() {
    this.disposed = true;
    this.cancelSweep?.();
    this.cancelSweep = undefined;
    this.sessions.clear();
    this.playerIds.clear();
  }

  private nextExpiry() {
    const expiry = this.deps.clock.now() + this.deps.ttlMs;
    if (!Number.isSafeInteger(expiry) || expiry < 0) throw new Error('Prazo de sessão inválido.');
    return expiry;
  }

  private find(hash: string): StoredGuestSession | null {
    const session = this.sessions.get(hash);
    if (!session) return null;
    if (session.expiresAt <= this.deps.clock.now()) {
      this.sessions.delete(hash);
      this.playerIds.delete(session.playerId);
      return null;
    }
    return session;
  }
}

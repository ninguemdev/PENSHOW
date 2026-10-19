import type { PlayerId } from '@penshow/shared';
import type { CancelTask, Scheduler } from '../../ports.js';
import type { GuestSessionStore, SessionProof } from './session-store.js';

interface Connection {
  id: string;
  close(reason: 'replaced' | 'expired'): void;
}

interface Binding {
  proof: SessionProof;
  connection: Connection;
  cancelExpiry?: CancelTask;
}

export class ActiveConnections {
  private readonly bindings = new Map<PlayerId, Binding>();
  private disposed = false;

  constructor(
    private readonly sessions: GuestSessionStore,
    private readonly scheduler: Scheduler,
  ) {}

  claim(proof: SessionProof, connection: Connection): boolean {
    if (this.disposed || !this.sessions.verify(proof)) return false;
    const previous = this.bindings.get(proof.playerId);
    const binding: Binding = { proof, connection };
    this.bindings.set(proof.playerId, binding);
    previous?.cancelExpiry?.();
    previous?.connection.close('replaced');
    this.scheduleExpiry(binding);
    return true;
  }

  identify(proof: SessionProof, connectionId: string): PlayerId | null {
    if (
      this.disposed ||
      this.bindings.get(proof.playerId)?.connection.id !== connectionId ||
      !this.sessions.verify(proof)
    )
      return null;
    return proof.playerId;
  }

  isCurrent(playerId: PlayerId, connectionId: string): boolean {
    const binding = this.bindings.get(playerId);
    return (
      !this.disposed &&
      binding?.connection.id === connectionId &&
      !!this.sessions.verify(binding.proof)
    );
  }

  release(playerId: PlayerId, connectionId: string) {
    const binding = this.bindings.get(playerId);
    if (binding?.connection.id !== connectionId) return;
    binding.cancelExpiry?.();
    this.bindings.delete(playerId);
  }

  dispose() {
    this.disposed = true;
    for (const binding of this.bindings.values()) binding.cancelExpiry?.();
    this.bindings.clear();
  }

  private scheduleExpiry(binding: Binding) {
    const session = this.sessions.verify(binding.proof);
    if (!session) {
      this.release(binding.proof.playerId, binding.connection.id);
      binding.connection.close('expired');
      return;
    }
    binding.cancelExpiry = this.scheduler.scheduleAt(session.expiresAt, () => {
      if (this.disposed || this.bindings.get(binding.proof.playerId) !== binding) return;
      this.scheduleExpiry(binding);
    });
  }
}

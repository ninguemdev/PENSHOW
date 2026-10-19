import { describe, expect, it, vi } from 'vitest';
import { createSystemSessionTokens } from '../../platform/session-tokens.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { ActiveConnections } from './active-connections.js';
import { GuestSessionStore } from './session-store.js';

function setup() {
  const { runtime, time } = createTestRuntime();
  const sessions = new GuestSessionStore({
    ...runtime,
    tokens: createSystemSessionTokens(),
    ttlMs: 2000,
  });
  const issued = sessions.create();
  const proof = sessions.authenticate(issued.token);
  if (!proof) throw new Error('Sessão esperada');
  return { sessions, proof, time, connections: new ActiveConnections(sessions, runtime.scheduler) };
}

describe('conexão ativa por identidade', () => {
  it('substitui conexão anterior sem deixar seu disconnect remover a nova', () => {
    const { connections, proof, time } = setup();
    const first = { id: 'first', close: vi.fn(() => connections.release(proof.playerId, 'first')) };
    const second = { id: 'second', close: vi.fn() };
    expect(connections.claim(proof, first)).toBe(true);
    expect(connections.identify(proof, 'first')).toBe(proof.playerId);
    expect(connections.claim(proof, second)).toBe(true);
    expect(first.close).toHaveBeenCalledWith('replaced');
    expect(connections.identify(proof, 'first')).toBeNull();
    expect(connections.identify(proof, 'second')).toBe(proof.playerId);
    expect(time.pendingCount).toBe(1);
    connections.release(proof.playerId, 'first');
    expect(connections.identify(proof, 'second')).toBe(proof.playerId);
  });
  it('preserva conexão renovada no prazo anterior e encerra na nova expiração', async () => {
    const { connections, proof, sessions, time } = setup();
    const connection = { id: 'one', close: vi.fn() };
    connections.claim(proof, connection);
    await time.advanceTo(2000);
    expect(sessions.renew(proof)?.expiresAt).toBe(4000);
    await time.advanceTo(3000);
    expect(connection.close).not.toHaveBeenCalled();
    expect(connections.identify(proof, 'one')).toBe(proof.playerId);
    await time.advanceTo(4000);
    expect(connection.close).toHaveBeenCalledWith('expired');
    expect(connections.identify(proof, 'one')).toBeNull();
    expect(time.pendingCount).toBe(0);
  });
  it('rejeita provas expiradas ou de outra sessão e cancela timers ao encerrar', async () => {
    const { connections, proof, time } = setup();
    const connection = { id: 'one', close: vi.fn() };
    expect(connections.claim({ ...proof, tokenHash: 'outro' }, connection)).toBe(false);
    connections.claim(proof, connection);
    connections.dispose();
    connections.dispose();
    expect(connections.identify(proof, 'one')).toBeNull();
    expect(time.pendingCount).toBe(0);
    await time.advanceTo(3000);
    expect(connections.claim(proof, connection)).toBe(false);
    expect(connection.close).not.toHaveBeenCalled();
  });
});

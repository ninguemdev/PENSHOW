import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSystemSessionTokens } from '../../platform/session-tokens.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { GuestSessionStore, SESSION_SWEEP_INTERVAL_MS } from './session-store.js';

function setup(ttlMs = 2000) {
  const { runtime, time } = createTestRuntime();
  const tokens = createSystemSessionTokens();
  const store = new GuestSessionStore({ ...runtime, tokens, ttlMs });
  return { store, runtime, time, tokens };
}

describe('registro de sessões em memória', () => {
  it('emite token de 256 bits e guarda somente hash com escopo, ID e validade', () => {
    const { store } = setup();
    const issued = store.create();
    expect(issued.token).toMatch(/^penshow_v1_[A-Za-z0-9_-]{43}$/u);
    expect(Buffer.from(issued.token.slice('penshow_v1_'.length), 'base64url')).toHaveLength(32);
    const hash = createHash('sha256')
      .update('penshow:guest-session:v1:')
      .update(issued.token)
      .digest('hex');
    expect(store.entries()).toEqual([
      { playerId: issued.playerId, tokenHash: hash, expiresAt: 3000 },
    ]);
    expect(JSON.stringify(store.entries())).not.toContain(issued.token);
    expect(Object.isFrozen(store.entries()[0])).toBe(true);
    expect(store.authenticate(issued.token)?.playerId).toBe(issued.playerId);
    expect(store.authenticate(hash)).toBeNull();
  });
  it('mantém identidades independentes e rejeita tokens alterados ou de outro registro', () => {
    const { store } = setup();
    const first = store.create();
    const second = store.create();
    expect(first.playerId).not.toBe(second.playerId);
    expect(first.token).not.toBe(second.token);
    expect(store.authenticate(`${first.token}x`)).toBeNull();
    expect(store.authenticate(`comicle_v1_${'a'.repeat(43)}`)).toBeNull();
    const other = setup().store;
    expect(other.authenticate(first.token)).toBeNull();
    const proof = store.authenticate(first.token);
    if (!proof) throw new Error('Sessão esperada');
    expect(store.verify({ ...proof, playerId: second.playerId })).toBeNull();
  });
  it('verifica sem renovar e expira exatamente no prazo', async () => {
    const { store, time } = setup();
    const issued = store.create();
    await time.advanceTo(2999);
    expect(store.authenticate(issued.token)?.expiresAt).toBe(3000);
    await time.advanceTo(3000);
    expect(store.authenticate(issued.token)).toBeNull();
    expect(store.entries()).toEqual([]);
  });
  it('renova explicitamente com a mesma identidade e token, sem reviver sessão expirada', async () => {
    const { store, time } = setup();
    const issued = store.create();
    await time.advanceTo(2000);
    const proof = store.authenticate(issued.token);
    if (!proof) throw new Error('Sessão esperada');
    expect(store.renew(proof)).toEqual({
      scope: 'penshow',
      playerId: issued.playerId,
      expiresAt: 4000,
    });
    await time.advanceTo(3000);
    expect(store.authenticate(issued.token)?.playerId).toBe(issued.playerId);
    await time.advanceTo(4000);
    expect(store.renew(proof)).toBeNull();
    expect(store.authenticate(issued.token)).toBeNull();
  });
  it('remove expiradas periodicamente e cancela a limpeza ao encerrar', async () => {
    const { store, time } = setup();
    const issued = store.create();
    store.startSweeping();
    store.startSweeping();
    expect(time.pendingCount).toBe(1);
    await time.advanceTo(1000 + SESSION_SWEEP_INTERVAL_MS);
    expect(store.entries()).toEqual([]);
    expect(time.pendingCount).toBe(1);
    store.dispose();
    store.dispose();
    expect(time.pendingCount).toBe(0);
    expect(store.authenticate(issued.token)).toBeNull();
    expect(() => store.create()).toThrow('encerrado');
  });
  it('perde sessões após reinício do registro', () => {
    const first = setup();
    const issued = first.store.create();
    first.store.dispose();
    const restarted = setup();
    expect(restarted.store.authenticate(issued.token)).toBeNull();
  });
  it('não sobrescreve sessão existente quando o gerador repete o token', () => {
    const { runtime } = createTestRuntime();
    const codec = createSystemSessionTokens();
    const token = codec.issue();
    const store = new GuestSessionStore({
      ...runtime,
      tokens: { ...codec, issue: () => token },
      ttlMs: 2000,
    });
    const first = store.create();
    expect(() => store.create()).toThrow('sessão única');
    expect(store.entries()).toHaveLength(1);
    expect(store.authenticate(token)?.playerId).toBe(first.playerId);
  });
});

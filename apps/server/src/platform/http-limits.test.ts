import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestRuntime } from '../test-support/runtime.js';
import { loadConfig } from './config.js';
import { DEFAULT_TRAFFIC_POLICY, type TrafficPolicy } from './traffic-policy.js';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
function fixture(policy: Partial<TrafficPolicy>) {
  const { runtime, time } = createTestRuntime();
  const app = buildApp({
    runtime,
    config: loadConfig({ NODE_ENV: 'test' }),
    trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, ...policy },
  });
  apps.push(app);
  const create = (remoteAddress = '127.0.0.1', headers = {}) =>
    app.inject({ method: 'POST', url: '/guest-sessions', remoteAddress, headers });
  return { app, time, create };
}
describe('limites HTTP e capacidade de sessões', () => {
  it('rejeita excesso por IP sem confiar em X-Forwarded-For; mantém saúde e outro IP', async () => {
    const { app, time, create } = fixture({ sessionCreatesPerWindow: 2 });
    expect((await create()).statusCode).toBe(201);
    expect((await create()).statusCode).toBe(201);
    const rejected = await create('127.0.0.1', { 'x-forwarded-for': '192.0.2.2' });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.headers['retry-after']).toBe('60');
    expect(rejected.headers['cache-control']).toBe('no-store');
    expect(rejected.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(app.sessions.entries()).toHaveLength(2);
    expect((await create('192.0.2.2')).statusCode).toBe(201);
    expect((await app.inject('/health')).statusCode).toBe(200);
    await time.advanceTo(61_000);
    expect((await create()).statusCode).toBe(201);
  });
  it('limita verificação/renovação separadamente da emissão e não revela outra sessão', async () => {
    const { app, create } = fixture({ sessionRequestsPerWindow: 2 });
    const own = (await create()).json(),
      other = (await create()).json();
    const headers = { authorization: `Bearer ${own.token}` };
    const forbidden = await app.inject({ url: `/guest-sessions/${other.playerId}`, headers });
    expect(forbidden.statusCode).toBe(403);
    expect(JSON.stringify(forbidden.json())).not.toContain(other.token);
    expect(
      (await app.inject({ method: 'POST', url: `/guest-sessions/${own.playerId}/renew`, headers }))
        .statusCode,
    ).toBe(200);
    expect((await app.inject({ url: `/guest-sessions/${own.playerId}`, headers })).statusCode).toBe(
      429,
    );
    expect((await create()).statusCode).toBe(201);
  });
  it('recusa novas sessões na capacidade e reutiliza expiradas antes da varredura', async () => {
    const { app, time, create } = fixture({ maxSessions: 2 });
    expect((await create()).statusCode).toBe(201);
    expect((await create()).statusCode).toBe(201);
    const rejected = await create();
    expect(rejected.statusCode).toBe(503);
    expect(rejected.json()).toMatchObject({ error: { code: 'SERVER_BUSY' } });
    expect(app.sessions.entries()).toHaveLength(2);
    await time.advanceTo(1000 + app.config.guestSessionTtlMs);
    expect((await create()).statusCode).toBe(201);
    expect(app.sessions.entries()).toHaveLength(1);
  });
});

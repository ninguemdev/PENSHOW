import { guestSessionSchema, issuedGuestSessionSchema } from '@penshow/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import type { AppDependencies } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { createSystemSessionTokens } from '../../platform/session-tokens.js';
import { createTestRuntime } from '../../test-support/runtime.js';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function setup(deps: AppDependencies = {}) {
  const { runtime, time } = createTestRuntime();
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test', GUEST_SESSION_TTL_MS: '2000' }),
    runtime,
    ...deps,
  });
  apps.push(app);
  return { app, time };
}

async function issue(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({ method: 'POST', url: '/guest-sessions', payload: {} });
  expect(response.statusCode).toBe(201);
  return issuedGuestSessionSchema.parse(response.json());
}

describe('sessões HTTP de convidado', () => {
  it('emite credencial opaca sem nome e verifica apenas o titular', async () => {
    const { app } = setup();
    const issued = await issue(app);
    const response = await app.inject({
      url: `/guest-sessions/${issued.playerId}`,
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(guestSessionSchema.parse(response.json())).toEqual({
      scope: 'penshow',
      playerId: issued.playerId,
      expiresAt: 3000,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toContain(issued.token);
    expect(response.body).not.toContain('tokenHash');
    const creation = await app.inject({ method: 'POST', url: '/guest-sessions' });
    expect(creation.statusCode).toBe(201);
    expect(creation.headers['cache-control']).toBe('no-store');
    expect(creation.headers.pragma).toBe('no-cache');
  });
  it.each([
    { nickname: 'Ana' },
    { playerId: '00000000-0000-4000-8000-000000000001' },
    { token: 'privado' },
    null,
  ])('recusa identidade ou credencial enviada na criação: %j', async (payload) => {
    const { app } = setup();
    const response = await app.inject({
      method: 'POST',
      url: '/guest-sessions',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
    expect(response.statusCode).toBe(400);
    expect(app.sessions.entries()).toEqual([]);
  });
  it('recusa consultar ou renovar a identidade alheia com um token válido', async () => {
    const { app } = setup();
    const first = await issue(app);
    const second = await issue(app);
    expect(first.playerId).not.toBe(second.playerId);
    for (const method of ['GET', 'POST'] as const) {
      const response = await app.inject({
        method,
        url: `/guest-sessions/${second.playerId}${method === 'POST' ? '/renew' : ''}`,
        headers: { authorization: `Bearer ${first.token}` },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    }
  });
  it('verificação não renova, renovação explícita conserva identidade e expiração não é revertida', async () => {
    const { app, time } = setup();
    const session = await issue(app);
    const headers = { authorization: `Bearer ${session.token}` };
    await time.advanceTo(2000);
    const verified = await app.inject({ url: `/guest-sessions/${session.playerId}`, headers });
    expect(verified.json().expiresAt).toBe(3000);
    const renewed = await app.inject({
      method: 'POST',
      url: `/guest-sessions/${session.playerId}/renew`,
      headers,
      payload: {},
    });
    expect(renewed.statusCode).toBe(200);
    expect(guestSessionSchema.parse(renewed.json())).toEqual({
      scope: 'penshow',
      playerId: session.playerId,
      expiresAt: 4000,
    });
    expect(renewed.body).not.toContain(session.token);
    await time.advanceTo(4000);
    const expired = await app.inject({ url: `/guest-sessions/${session.playerId}`, headers });
    const cannotRenew = await app.inject({
      method: 'POST',
      url: `/guest-sessions/${session.playerId}/renew`,
      headers,
      payload: {},
    });
    expect(expired.statusCode).toBe(401);
    expect(cannotRenew.statusCode).toBe(401);
  });
  it.each([
    undefined,
    'Basic private',
    'Bearer private',
    `Bearer ${'a'.repeat(64)}`,
    `Bearer comicle_v1_${'a'.repeat(43)}`,
  ])('não autentica sem Bearer PENSHOW válido: %j', async (authorization) => {
    const { app } = setup();
    const issued = await issue(app);
    const response = await app.inject({
      url: `/guest-sessions/${issued.playerId}`,
      headers: authorization ? { authorization } : {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer realm="PENSHOW"');
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });
  it('não aceita token na URL, parâmetros extras ou dados de identidade na renovação', async () => {
    const { app } = setup();
    const session = await issue(app);
    const headers = { authorization: `Bearer ${session.token}` };
    expect(
      (await app.inject({ url: `/guest-sessions/${session.playerId}?token=${session.token}` }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: `/guest-sessions/${session.playerId}?token=${session.token}`,
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/guest-sessions/${session.playerId}/renew`,
          headers,
          payload: { nickname: 'Ana' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject({ url: '/guest-sessions/invalid', headers })).statusCode).toBe(400);
  });
  it('nunca registra o token, nem em requisição inválida ou erro de emissão', async () => {
    const lines: string[] = [];
    const { app } = setup({
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const session = await issue(app);
    await app.inject({
      url: `/guest-sessions/${session.playerId}`,
      headers: { authorization: `Bearer ${session.token}` },
    });
    await app.inject({
      url: `/guest-sessions/${session.playerId}?token=${session.token}`,
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(lines.join('')).not.toContain(session.token);
    const tokens = createSystemSessionTokens();
    const failure = setup({
      sessionTokens: {
        issue: () => {
          throw new Error(session.token);
        },
        hash: tokens.hash,
      },
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const response = await failure.app.inject({
      method: 'POST',
      url: '/guest-sessions',
      payload: {},
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(session.token);
    expect(lines.join('')).not.toContain(session.token);
  });
});

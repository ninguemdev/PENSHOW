import { defaultAvatar, healthResponseSchema, issuedGuestSessionSchema } from '@penshow/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';
import { createTestRuntime } from './test-support/runtime.js';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function makeApp(overrides: Parameters<typeof buildApp>[0] = {}) {
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    runtime: createTestRuntime().runtime,
    ...overrides,
  });
  apps.push(app);
  return app;
}

describe('servidor HTTP', () => {
  it('recusa ator sem conexão autenticada no serviço composto e limpa timers no fechamento', async () => {
    const { runtime, time } = createTestRuntime(1000, Array<number>(6).fill(0));
    const app = makeApp({ runtime });
    const issued = issuedGuestSessionSchema.parse(
      (await app.inject({ method: 'POST', url: '/guest-sessions' })).json(),
    );
    expect(() =>
      app.rooms.create(
        { playerId: issued.playerId, connectionId: 'internal-connection' },
        { nickname: 'Ana', avatar: defaultAvatar() },
        { format: 'prototype-v1', maxPlayers: 2, enabledCategories: ['history'] },
      ),
    ).toThrow('sessão');
    expect(app.rooms.registry.all()).toHaveLength(0);
    expect(time.pendingCount).toBe(1);
    await app.close();
    expect(app.rooms.registry.all()).toHaveLength(0);
    expect(time.pendingCount).toBe(0);
  });
  it('responde ao healthcheck sem abrir porta', async () => {
    const app = makeApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(app.server.listening).toBe(false);
    expect(response.headers['content-type']).toContain('application/json');
    expect(healthResponseSchema.parse(response.json())).toEqual({
      service: 'penshow',
      status: 'ok',
    });
  });

  it('sanitiza exceção inesperada sem registrar corpo, query, credenciais, resposta ou stack', async () => {
    const lines: string[] = [];
    const app = makeApp({
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    app.post('/failure', () => {
      throw new Error('resposta-privada token-privado /caminho-interno');
    });
    const response = await app.inject({
      method: 'POST',
      url: '/failure?token=token-privado',
      headers: { authorization: 'Bearer token-privado', cookie: 'token-privado' },
      payload: { optionId: 'resposta-privada' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a ação. Tente novamente.',
      },
    });
    expect(lines.join('')).toContain('Falha interna ao processar requisição.');
    for (const secret of [
      'resposta-privada',
      'token-privado',
      '/caminho-interno',
      'stack',
      'authorization',
      '/failure',
    ]) {
      expect(response.body).not.toContain(secret);
      expect(lines.join('')).not.toContain(secret);
    }
  });

  it('retorna 404 público sem repetir a URL recebida', async () => {
    const response = await makeApp().inject('/missing?token=privado');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(response.body).not.toContain('privado');
  });

  it('limita o corpo e recusa JSON malformado antes de executar a rota', async () => {
    const app = makeApp({ config: loadConfig({ NODE_ENV: 'test', HTTP_BODY_LIMIT: '1024' }) });
    let calls = 0;
    app.post('/payload', () => {
      calls++;
      return {};
    });
    const large = await app.inject({
      method: 'POST',
      url: '/payload',
      payload: { token: 'x'.repeat(2048) },
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/payload',
      headers: { 'content-type': 'application/json' },
      payload: '{"secret":',
    });
    expect(large.statusCode).toBe(413);
    expect(malformed.statusCode).toBe(400);
    expect(large.json().error.code).toBe('INVALID_PAYLOAD');
    expect(malformed.json().error.code).toBe('INVALID_PAYLOAD');
    expect(calls).toBe(0);
  });

  it('libera origem exata e preflight e bloqueia origem diferente', async () => {
    const app = makeApp();
    const allowed = await app.inject({
      url: '/health',
      headers: { origin: 'http://127.0.0.1:5173' },
    });
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'http://127.0.0.1:5173', 'access-control-request-method': 'GET' },
    });
    const denied = await app.inject({
      url: '/health',
      headers: { origin: 'https://other.example' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(preflight.statusCode).toBe(204);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FORBIDDEN');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('encerra antes de listen, cancela tarefas e permite fechamento repetido', async () => {
    const { runtime, time } = createTestRuntime();
    const app = makeApp({ runtime });
    let executed = false;
    runtime.scheduler.scheduleAt(2000, () => {
      executed = true;
    });
    await app.ready();
    await app.close();
    await app.close();
    await time.advanceTo(3000);
    expect(executed).toBe(false);
    expect(time.pendingCount).toBe(0);
    expect(app.realtime.engine.clientsCount).toBe(0);
    expect(() => runtime.scheduler.scheduleAt(4000, () => {})).toThrow('encerrado');
  });
});

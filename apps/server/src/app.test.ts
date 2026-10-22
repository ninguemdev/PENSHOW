import { defaultAvatar, healthResponseSchema, issuedGuestSessionSchema } from '@penshow/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';
import { createTestRuntime } from './test-support/runtime.js';
import { DEFAULT_TRAFFIC_POLICY } from './platform/traffic-policy.js';
import { createConnection } from 'node:net';
import { once } from 'node:events';

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
  it('encerra mesmo com um upload HTTP que não concluiu o corpo da requisição', async () => {
    const app = makeApp();
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Porta TCP esperada.');
    const client = createConnection({ host: '127.0.0.1', port: address.port });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await once(client, 'connect');
      client.write(
        'POST /api/guest-sessions HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{',
      );
      // Receiving the headers establishes an active request, rather than an idle socket.
      await new Promise<void>((resolve) => app.server.once('request', () => resolve()));
      await Promise.race([
        app.close(),
        new Promise<void>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Encerramento HTTP bloqueado.')), 2000);
        }),
      ]);
      expect(app.server.listening).toBe(false);
    } finally {
      clearTimeout(timeout);
      client.destroy();
    }
  });
  it('compartilha o orçamento de criação e a identidade entre rotas históricas e /api', async () => {
    const app = makeApp({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, sessionCreatesPerWindow: 2 },
    });
    const first = await app.inject({ method: 'POST', url: '/api/guest-sessions' });
    expect(first.statusCode).toBe(201);
    const session = issuedGuestSessionSchema.parse(first.json());
    expect(
      (
        await app.inject({
          url: `/guest-sessions/${session.playerId}`,
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/guest-sessions' })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/guest-sessions' })).statusCode).toBe(429);
    expect((await app.inject({ method: 'POST', url: '/guest-sessions' })).statusCode).toBe(429);
  });
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

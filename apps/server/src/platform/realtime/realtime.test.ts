import { acknowledgementSchema } from '@penshow/shared';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { AppDependencies } from '../../app.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { loadConfig, SOCKET_PATH } from '../config.js';
import { DEFAULT_TRAFFIC_POLICY } from '../traffic-policy.js';

const actionId = '00000000-0000-4000-8000-000000000002';
const roomId = '00000000-0000-4000-8000-000000000003';
const leave = { protocolVersion: 1, actionId, event: 'room:leave', payload: { roomId } };
const sync = { protocolVersion: 1, actionId, event: 'time:sync', payload: { clientSentAt: 500 } };
const apps: ReturnType<typeof buildApp>[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function start(deps: AppDependencies = {}) {
  const fixture = createTestRuntime();
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test' }),
    runtime: fixture.runtime,
    ...deps,
  });
  apps.push(app);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  return { app, address, ...fixture };
}

async function connect(
  address: string,
  transport: 'polling' | 'websocket' = 'websocket',
  origin: string | undefined = 'http://127.0.0.1:5173',
  token?: string,
) {
  const client = io(address, {
    path: SOCKET_PATH,
    transports: [transport],
    autoConnect: false,
    reconnection: false,
    timeout: 1500,
    extraHeaders: origin ? { origin } : {},
    auth: token ? { token } : {},
  });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', reject);
    client.connect();
  });
  return client;
}

describe('transporte Socket.IO real em porta efêmera', () => {
  it('fecha o TCP de um cliente WebSocket que não confirma o handshake de encerramento', async () => {
    const { app, address } = await start();
    const peer = createConnection({ host: '127.0.0.1', port: Number(new URL(address).port) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await once(peer, 'connect');
      const upgraded = once(peer, 'data');
      peer.write(
        'GET /penshow/socket.io/?EIO=4&transport=websocket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n',
      );
      expect(String((await upgraded)[0])).toContain('101 Switching Protocols');
      // A raw TCP client consumes frames without sending a WebSocket Close acknowledgement.
      peer.resume();
      const closed = once(peer, 'close');
      await Promise.race([
        Promise.all([app.close(), closed]),
        new Promise<void>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('TCP WebSocket permaneceu aberto.')), 2000);
        }),
      ]);
      expect(peer.destroyed).toBe(true);
    } finally {
      clearTimeout(timer);
      peer.destroy();
    }
  });
  it('limita novas tentativas de handshake por IP mesmo após fechar a conexão', async () => {
    const { app, address, time } = await start({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, handshakesPerWindow: 1 },
    });
    const first = await connect(address);
    first.disconnect();
    await vi.waitFor(() => expect(app.realtime.engine.clientsCount).toBe(0));
    await expect(connect(address)).rejects.toBeInstanceOf(Error);
    await time.advanceTo(61_000);
    expect((await connect(address)).connected).toBe(true);
  });
  it('limita spam anônimo, inclusive sem ack e inválido, e recupera o orçamento no prazo', async () => {
    const { address, time } = await start({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, commandsPerWindow: 2 },
    });
    const client = await connect(address);
    client.emit('unknown', { private: 'segredo' });
    expect(await client.timeout(1500).emitWithAck('unknown', {})).toMatchObject({
      status: 'error',
      error: { code: 'UNKNOWN_EVENT' },
    });
    expect(await client.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      status: 'error',
      actionId,
      error: { code: 'RATE_LIMITED' },
    });
    const replacement = await connect(address);
    expect(await replacement.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    await time.advanceTo(61_000);
    expect(await replacement.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      status: 'ok',
    });
  });
  it('preserva limite da identidade ao substituir conexão sem penalizar outro jogador', async () => {
    const { app, address } = await start({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, commandsPerWindow: 1 },
    });
    const session = app.sessions.create();
    const first = await connect(address, 'websocket', undefined, session.token);
    expect(await first.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      status: 'ok',
    });
    const replacement = await connect(address, 'websocket', undefined, session.token);
    expect(await replacement.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    const other = await connect(address, 'websocket', undefined, app.sessions.create().token);
    expect(await other.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      status: 'ok',
    });
  });
  it('limita comandos em andamento antes de executar outro serviço e libera após falha', async () => {
    const started = Promise.withResolvers<void>(),
      finish = Promise.withResolvers<void>();
    const service = vi.fn(async () => {
      started.resolve();
      await finish.promise;
      throw new Error('segredo interno');
    });
    const { app, address } = await start({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, maxPendingCommands: 1 },
      handlers: { 'room:leave': service },
    });
    const client = await connect(address, 'websocket', undefined, app.sessions.create().token);
    const first = client.timeout(1500).emitWithAck('room:leave', leave);
    try {
      await started.promise;
      expect(await client.timeout(1500).emitWithAck('room:leave', leave)).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });
      expect(service).toHaveBeenCalledTimes(1);
    } finally {
      finish.resolve();
    }
    expect(await first).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(await client.timeout(1500).emitWithAck('time:sync', sync)).toMatchObject({
      status: 'ok',
    });
  });
  it('limita conexões Engine.IO e libera vaga após desconexão', async () => {
    const { app, address } = await start({
      trafficPolicy: { ...DEFAULT_TRAFFIC_POLICY, maxConnections: 1 },
    });
    const first = await connect(address);
    await expect(connect(address)).rejects.toBeInstanceOf(Error);
    first.disconnect();
    await vi.waitFor(() => expect(app.realtime.engine.clientsCount).toBe(0));
    expect((await connect(address)).connected).toBe(true);
  });
  it.each(['polling', 'websocket'] as const)(
    'responde time:sync em %s pelo caminho isolado',
    async (transport) => {
      const { app, address } = await start();
      const client = await connect(address, transport);
      expect(
        acknowledgementSchema.parse(await client.timeout(1500).emitWithAck('time:sync', sync)),
      ).toEqual({
        protocolVersion: 1,
        actionId,
        status: 'ok',
        event: 'time:sync',
        result: { clientSentAt: 500, serverReceivedAt: 1000, serverSentAt: 1000 },
      });
      expect((await app.inject('/socket.io/?EIO=4&transport=polling')).statusCode).toBe(404);
    },
  );
  it.each(['polling', 'websocket'] as const)(
    'bloqueia origem não permitida em %s',
    async (transport) => {
      const { address } = await start();
      await expect(connect(address, transport, 'https://other.example')).rejects.toBeInstanceOf(
        Error,
      );
    },
  );
  it('não confunde uma conexão anônima de origem permitida com autenticação', async () => {
    const { address } = await start();
    const client = await connect(address);
    expect(
      acknowledgementSchema.parse(await client.timeout(1500).emitWithAck('room:leave', leave)),
    ).toMatchObject({ status: 'error', error: { code: 'UNAUTHENTICATED' } });
    expect(
      acknowledgementSchema.parse(await client.timeout(1500).emitWithAck('room:secret', leave)),
    ).toMatchObject({ error: { code: 'UNKNOWN_EVENT' } });
    expect(
      acknowledgementSchema.parse(await client.timeout(1500).emitWithAck('room:kick', leave)),
    ).toMatchObject({ error: { code: 'INVALID_PAYLOAD' } });
  });
  it('identifica ator, delega e sanitiza exceção e logs também no socket', async () => {
    const lines: string[] = [];
    const service = vi.fn(() => {
      throw new Error('token-privado resposta-privada /caminho-interno');
    });
    const { app, address } = await start({
      handlers: { 'room:leave': service },
      config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      logStream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const session = app.sessions.create();
    const client = await connect(address, 'websocket', undefined, session.token);
    const response = acknowledgementSchema.parse(
      await client.timeout(1500).emitWithAck('room:leave', leave),
    );
    expect(response).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(service).toHaveBeenCalledWith(session.playerId, leave);
    expect(lines.join('')).toContain('Falha interna ao processar comando.');
    for (const secret of [
      session.token,
      'token-privado',
      'resposta-privada',
      '/caminho-interno',
      'stack',
    ]) {
      expect(JSON.stringify(response)).not.toContain(secret);
      expect(lines.join('')).not.toContain(secret);
    }
  });
  it('rejeita argumentos excedentes sem executar serviço', async () => {
    const service = vi.fn(() => ({}));
    const { app, address } = await start({
      handlers: { 'room:leave': service },
    });
    const client = await connect(address, 'websocket', undefined, app.sessions.create().token);
    expect(
      acknowledgementSchema.parse(
        await client.timeout(1500).emitWithAck('room:leave', leave, { extra: true }),
      ),
    ).toMatchObject({ error: { code: 'INVALID_PAYLOAD' } });
    expect(service).not.toHaveBeenCalled();
  });
  it('desconecta pacote maior que o limite antes de executar serviço', async () => {
    const service = vi.fn(() => ({}));
    const { app, address } = await start({
      config: loadConfig({ NODE_ENV: 'test', SOCKET_MESSAGE_LIMIT: '1024' }),
      handlers: { 'room:leave': service },
    });
    const client = await connect(address, 'websocket', undefined, app.sessions.create().token);
    const disconnected = new Promise<void>((resolve) => {
      client.once('disconnect', () => resolve());
    });
    client.emit('room:leave', { ...leave, extra: 'x'.repeat(4096) }, () => {});
    await disconnected;
    expect(service).not.toHaveBeenCalled();
    await app.close();
    expect(app.realtime.engine.clientsCount).toBe(0);
  });
  it('encerra conexões e timers e aguarda comando que já começou', async () => {
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const { app, address, time, runtime } = await start({
      handlers: {
        'room:leave': async () => {
          started.resolve();
          await finish.promise;
          return {};
        },
      },
    });
    runtime.scheduler.scheduleAt(5000, () => {
      throw new Error('Timer antigo executado');
    });
    const client = await connect(address, 'websocket', undefined, app.sessions.create().token);
    client.emit('room:leave', leave, () => {});
    await started.promise;
    const disconnected = new Promise<void>((resolve) => {
      client.once('disconnect', () => resolve());
    });
    let closed = false;
    const closing = app.close().then(() => {
      closed = true;
    });
    try {
      await disconnected;
      expect(closed).toBe(false);
      await expect(connect(address)).rejects.toBeInstanceOf(Error);
    } finally {
      finish.resolve();
      await closing;
    }
    expect(app.server.listening).toBe(false);
    expect(app.realtime.engine.clientsCount).toBe(0);
    expect(app.realtime.sockets.sockets.size).toBe(0);
    expect(time.pendingCount).toBe(0);
    await time.advanceTo(6000);
  });
});

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createConnection, createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import {
  acknowledgementSchema,
  defaultAvatar,
  issuedGuestSessionSchema,
  serverEventSchema,
} from '../packages/shared/dist/index.js';

const { io } = createRequire(new URL('../apps/server/package.json', import.meta.url))(
  'socket.io-client',
);
const execute = promisify(execFile);
const image = process.argv[2] ?? 'penshow:local';
const containers = [],
  sockets = [],
  tcpClients = [];
const temporary = await mkdtemp(join(tmpdir(), 'penshow-container-'));
async function docker(...args) {
  const { stdout, stderr } = await execute('docker', args, {
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return (args[0] === 'logs' ? stdout + stderr : stdout).trim();
}
async function eventually(check, timeout = 15_000) {
  const until = Date.now() + timeout;
  let failure;
  do {
    try {
      return await check();
    } catch (error) {
      failure = error;
    }
    await delay(100);
  } while (Date.now() < until);
  throw failure;
}
async function start(environment) {
  const portServer = createServer();
  await new Promise((resolve, reject) => {
    portServer.once('error', reject);
    portServer.listen(0, '127.0.0.1', resolve);
  });
  const { port } = portServer.address();
  await new Promise((resolve) => portServer.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const name = `penshow-t34-${crypto.randomUUID()}`;
  containers.push(name);
  await docker(
    'run',
    '--detach',
    '--name',
    name,
    '--init',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--publish',
    `127.0.0.1:${port}:3000`,
    '--env',
    `NODE_ENV=${environment}`,
    '--env',
    'NARRATION_ENABLED=true',
    '--env',
    `ALLOWED_ORIGINS=${origin}`,
    image,
  );
  await healthy(origin);
  return { name, origin };
}
async function healthy(origin) {
  await eventually(async () => {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1500) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { service: 'penshow', status: 'ok' });
  });
}
async function client(origin, transport = 'websocket') {
  const response = await fetch(`${origin}/api/guest-sessions`, { method: 'POST' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const session = issuedGuestSessionSchema.parse(await response.json());
  const socket = io(origin, {
    path: '/penshow/socket.io',
    transports: [transport],
    auth: { token: session.token },
    autoConnect: false,
    reconnection: false,
    extraHeaders: { Origin: origin },
    timeout: 3000,
  });
  sockets.push(socket);
  const views = [];
  socket.on('room:view', (event) => views.push(serverEventSchema.parse(event).payload));
  const connected = new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  socket.connect();
  await connected;
  const command = async (event, payload) =>
    acknowledgementSchema.parse(
      await socket
        .timeout(3000)
        .emitWithAck(event, { protocolVersion: 1, actionId: crypto.randomUUID(), event, payload }),
    );
  return { socket, session, views, command };
}
function ok(ack) {
  assert.equal(ack.status, 'ok');
  return ack.result;
}
async function group(origin) {
  const host = await client(origin),
    guest = await client(origin, 'polling');
  const entry = ok(
    await host.command('room:create', {
      profile: { nickname: 'Ana', avatar: defaultAvatar() },
      settings: {
        format: 'prototype-v1',
        maxPlayers: 2,
        enabledCategories: ['history', 'geography'],
      },
    }),
  );
  ok(
    await guest.command('room:join', {
      code: entry.code,
      profile: { nickname: 'Bruno', avatar: defaultAvatar() },
    }),
  );
  await eventually(() => assert.equal(host.views.at(-1)?.members.length, 2));
  return { host, guest, entry };
}
async function expectStartupFailure(args, pattern) {
  const name = `penshow-t34-failure-${crypto.randomUUID()}`;
  containers.push(name);
  await docker('create', '--name', name, ...args, image);
  await docker('start', name);
  assert.equal(await docker('wait', name), '1');
  assert.match(await docker('logs', name), pattern);
}
try {
  const { name, origin } = await start('production');
  const root = await fetch(`${origin}/penshow`, { redirect: 'manual' });
  assert.equal(root.status, 308);
  assert.equal(root.headers.get('location'), '/penshow/');
  const html = await fetch(`${origin}/penshow/`);
  assert.equal(html.headers.get('cache-control'), 'no-cache');
  const body = await html.text();
  const assets = [...body.matchAll(/(?:src|href)="(\/penshow\/assets\/[^" ]+)"/gu)].map(
    (match) => match[1],
  );
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    const response = await fetch(`${origin}${asset}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  }
  for (const path of ['/penshow/perfil', '/penshow/criar', '/penshow/sala/ABC234']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), body);
  }
  for (const path of [
    '/comicle/',
    '/data/questions/published/catalog.json',
    '/penshow/data/questions/published/catalog.json',
    '/penshow/catalog.json',
    '/penshow/.env',
    '/api/missing',
    '/penshow/assets/missing.js',
    `${assets[0]}.map`,
    '/apps/server/dist/main.js',
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /<html|correctOptionId|questions/iu);
  }
  assert.equal(
    (await fetch(`${origin}/api/health`, { headers: { Origin: 'https://other.example' } })).status,
    403,
  );
  await docker('exec', name, 'node', 'infra/healthcheck.mjs');
  // Inspect the runtime, including workspace dependency links, without exposing any answers.
  const inspection = await docker(
    'exec',
    name,
    'node',
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
    import { readdir, readFile, access } from 'node:fs/promises';
    import { join } from 'node:path';
    assert.equal(process.getuid(), 1000);
    assert.deepEqual(await readdir('/app/data/questions'), ['published']);
    const dependencies = await readdir('/app/apps/server/node_modules/.pnpm');
    assert.ok(!dependencies.some(name => /^(?:typescript|vitest|tsx|vite|@playwright|@echogarden)[@+]/u.test(name)));
    await access('/app/data/narration/generated/manifest.json');
    await assert.rejects(access('/app/apps/server/src'));
    await access('/app/licenses/comicle-LICENSE.txt');
    await access('/app/data/licenses/opentdb.txt');
    const files = await readdir('/app/apps/web/dist', { recursive: true });
    assert.equal(files.filter(file => file.endsWith('.png')).length, 50);
    assert.ok(!files.some(file => /\\.(?:json|map|ts|tsx)$/u.test(file)));
    const catalog = JSON.parse(await readFile('/app/data/questions/published/catalog.json', 'utf8'));
    const scripts = await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(join('/app/apps/web/dist', file), 'utf8')));
    for (const question of catalog.questions) for (const script of scripts)
      assert.ok(!script.includes(JSON.stringify(question.prompt).slice(1, -1)));
    console.log(JSON.stringify({ approvedQuestions: catalog.questions.length, avatars: 50, developmentTools: false }));
  `,
  );
  console.log(`Imagem inspecionada: ${inspection}`);
  const { host, guest, entry } = await group(origin);
  const denied = await host.command('match:start', { roomId: entry.roomId, mode: 'classic' });
  assert.equal(denied.status, 'error');
  assert.equal(denied.error.code, 'INVALID_PHASE');
  await eventually(
    async () =>
      assert.equal(
        await docker('inspect', '--format', '{{.State.Health.Status}}', name),
        'healthy',
      ),
    20_000,
  );
  // A peer that reads frames without acknowledging WebSocket Close must not hold the process open.
  const stalledWebSocket = createConnection({
    host: '127.0.0.1',
    port: Number(new URL(origin).port),
  });
  tcpClients.push(stalledWebSocket);
  await once(stalledWebSocket, 'connect');
  const upgraded = once(stalledWebSocket, 'data');
  stalledWebSocket.write(
    'GET /penshow/socket.io/?EIO=4&transport=websocket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n',
  );
  assert.match(String((await upgraded)[0]), /101 Switching Protocols/u);
  stalledWebSocket.resume();
  const upload = createConnection({ host: '127.0.0.1', port: Number(new URL(origin).port) });
  tcpClients.push(upload);
  await once(upload, 'connect');
  const continuing = once(upload, 'data');
  upload.write(
    'POST /api/guest-sessions HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 100\r\nExpect: 100-continue\r\n\r\n',
  );
  assert.match(String((await continuing)[0]), /100 Continue/u);
  await docker('stop', '--time', '15', name);
  upload.destroy();
  stalledWebSocket.destroy();
  assert.equal(await docker('inspect', '--format', '{{.State.ExitCode}}', name), '0');
  host.socket.disconnect();
  guest.socket.disconnect();
  await docker('start', name);
  await healthy(origin);
  const oldSession = await fetch(`${origin}/api/guest-sessions/${host.session.playerId}`, {
    headers: { Authorization: `Bearer ${host.session.token}` },
  });
  assert.equal(oldSession.status, 401);
  const fresh = await client(origin);
  assert.equal(ok(await fresh.command('room:sync', {})).status, 'absent');
  fresh.socket.disconnect();
  console.log(
    'Produção: HTTP, cache, privacidade, WebSocket/polling, healthcheck e reinício aprovados.',
  );
  await expectStartupFailure([], /ALLOWED_ORIGINS é obrigatório/u);
  await expectStartupFailure(
    ['--env', 'ALLOWED_ORIGINS=http://127.0.0.1', '--env', 'WEB_BASE_PATH=/outro/'],
    /Build web indisponível/u,
  );
  await writeFile(join(temporary, 'catalog.json'), '{"conteudo":"inválido"}');
  await expectStartupFailure(
    [
      '--env',
      'ALLOWED_ORIGINS=http://127.0.0.1',
      '--mount',
      `type=bind,source=${temporary},target=/app/data/questions/published,readonly`,
    ],
    /Não foi possível carregar o catálogo privado/u,
  );
  await rm(join(temporary, 'catalog.json'));
  await expectStartupFailure(
    [
      '--env',
      'ALLOWED_ORIGINS=http://127.0.0.1',
      '--mount',
      `type=bind,source=${temporary},target=/app/data/questions/published,readonly`,
    ],
    /Não foi possível carregar o catálogo privado/u,
  );
  console.log(
    'Falhas de configuração, build incompatível e catálogo inválido encerram com código 1.',
  );

  // Same runtime image; NODE_ENV=test explicitly enables the existing experimental rules locally.
  const test = await start('test');
  const players = await group(test.origin);
  const { host: quizHost, guest: quizGuest } = players;
  const started = ok(
    await quizHost.command('match:start', { roomId: players.entry.roomId, mode: 'classic' }),
  );
  const stage = (phase, predicate = () => true) =>
    eventually(() => {
      const match = quizHost.views.findLast(
        (view) =>
          view.state.status === 'match' &&
          view.state.match.stage.phase === phase &&
          predicate(view.state.match),
      )?.state.match;
      assert.ok(match, `Etapa esperada: ${phase}`);
      return match;
    }, 25_000);
  const instructions = await stage('instructions');
  const context = {
    roomId: players.entry.roomId,
    matchId: started.matchId,
    roundId: instructions.stage.round.roundId,
  };
  for (const player of [quizHost, quizGuest]) ok(await player.command('round:ready', context));
  const offer = await stage('category-selection');
  const chooser = [quizHost, quizGuest].find(
    (player) => player.session.playerId === offer.stage.chooserPlayerId,
  );
  ok(await chooser.command('category:choose', { ...context, category: offer.stage.categories[0] }));
  const seen = new Set();
  let points = 0;
  for (let index = 0; index < 6; index++) {
    const reading = await stage(
      'question-reading',
      (match) => !seen.has(match.stage.question.questionId),
    );
    assert.ok(reading.stage.narration.durationMs > 0);
    const recording = await fetch(
      `${test.origin}/api/rooms/${context.roomId}/narration/${reading.stage.question.questionId}`,
      { headers: { Authorization: `Bearer ${quizHost.session.token}` } },
    );
    assert.equal(recording.status, 200);
    const wave = Buffer.from(await recording.arrayBuffer());
    assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
    assert.equal(
      reading.stage.narration.durationMs,
      Math.ceil(((wave.length - 44) * 1000) / 44100),
    );
    const opened = await stage(
      'question-open',
      (match) => !seen.has(match.stage.question.questionId),
    );
    const question = opened.stage.question;
    seen.add(question.questionId);
    assert.doesNotMatch(JSON.stringify(opened), /correctOptionId|explanation|editorialQuestionId/u);
    const optionId = question.options[0].optionId;
    for (const player of [quizHost, quizGuest])
      ok(
        await player.command('answer:submit', {
          ...context,
          questionId: question.questionId,
          optionId,
        }),
      );
    const revealed = await stage(
      'reveal',
      (match) => match.stage.reveal.question.questionId === question.questionId,
    );
    if (revealed.stage.reveal.correctOptionId === optionId) points += 100;
    for (const row of revealed.scoreboard) assert.equal(row.points, points);
  }
  await stage('prototype-complete');
  ok(
    await quizHost.command('match:returnToLobby', {
      roomId: context.roomId,
      matchId: context.matchId,
    }),
  );
  await eventually(() => assert.equal(quizHost.views.at(-1)?.state.status, 'lobby'));
  assert.equal(seen.size, 6);
  console.log(
    'Mesmo artefato em teste local: duas identidades, seis perguntas, pontuação real e retorno ao lobby aprovados.',
  );
} catch (error) {
  for (const name of containers) {
    try {
      console.error(`Logs ${name}:\n${await docker('logs', '--tail', '20', name)}`);
    } catch {
      /* Container may not have started. */
    }
  }
  throw error;
} finally {
  for (const client of tcpClients) client.destroy();
  for (const socket of sockets) socket.disconnect();
  for (const name of containers) {
    try {
      await docker('rm', '--force', name);
    } catch {
      /* Preserve the original failure. */
    }
  }
  await rm(temporary, { recursive: true, force: true });
}

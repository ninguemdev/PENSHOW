import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../infra/cloudflare/worker.mjs';

test('encaminha API do PENSHOW preservando corpo, credencial e origem do navegador', async (t) => {
  let forwarded;
  const response = new Response('ok', { status: 201, headers: { 'Cache-Control': 'no-store' } });
  t.mock.method(globalThis, 'fetch', async (request) => {
    forwarded = request;
    return response;
  });
  const request = new Request('https://dionel.site/penshow/api/guest-sessions?check=1', {
    method: 'POST',
    headers: { Origin: 'https://dionel.site', Authorization: 'Bearer fixture-token' },
    body: 'fixture-body',
  });
  assert.equal(
    await worker.fetch(request, { ORIGIN_HOST: 'comicle-origin.dionel.site' }),
    response,
  );
  assert.equal(
    forwarded.url,
    'https://comicle-origin.dionel.site/penshow/api/guest-sessions?check=1',
  );
  assert.equal(forwarded.method, 'POST');
  assert.equal(forwarded.headers.get('Origin'), 'https://dionel.site');
  assert.equal(forwarded.headers.get('Authorization'), 'Bearer fixture-token');
  assert.equal(await forwarded.text(), 'fixture-body');
});

test('preserva o pedido de upgrade WebSocket e o caminho isolado do PENSHOW', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request) => {
    assert.equal(
      request.url,
      'https://comicle-origin.dionel.site/penshow/socket.io/?EIO=4&transport=websocket',
    );
    assert.equal(request.headers.get('Upgrade'), 'websocket');
    return new Response('fixture');
  });
  await worker.fetch(
    new Request('https://dionel.site/penshow/socket.io/?EIO=4&transport=websocket', {
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    }),
    { ORIGIN_HOST: 'comicle-origin.dionel.site' },
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test('não encaminha Comicle, API raiz, portfólio ou caminhos que escapam de /penshow/', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('Origem não deveria ser chamada.'),
  );
  for (const path of [
    '/',
    '/comicle/',
    '/api/guest-sessions',
    '/penshow-other',
    '/penshow/%2e%2e/api/health',
  ]) {
    const response = await worker.fetch(new Request(`https://dionel.site${path}`), {
      ORIGIN_HOST: 'comicle-origin.dionel.site',
    });
    assert.equal(response.status, 404);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('recusa origem ausente ou com esquema, caminho ou credenciais', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => assert.fail('Origem inválida.'));
  for (const hostname of [
    undefined,
    '',
    'https://origin.example',
    'user:password@origin.example',
    'origin.example/path',
  ]) {
    const response = await worker.fetch(new Request('https://dionel.site/penshow/'), {
      ORIGIN_HOST: hostname,
    });
    assert.equal(response.status, 503);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

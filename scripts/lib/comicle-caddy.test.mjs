import assert from 'node:assert/strict';
import test from 'node:test';
import { addPenshowRoute } from './comicle-caddy.mjs';

const source = `{$ORIGIN_HOST} {
  tls /certs/origin.pem /certs/origin.key
  @outsider not remote_ip private_ranges
  @game path /comicle /comicle/* /api/* /socket.io/*
  route {
    respond @outsider 403
    reverse_proxy @game app:3000 {
      header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
    }
    respond 404
  }
}
`;

test('adiciona apenas os caminhos PENSHOW após a restrição de origem e conserva Comicle/TLS', () => {
  const result = addPenshowRoute(source);
  const match = result.match(/ {4}# BEGIN PENSHOW\n[\s\S]*? {4}# END PENSHOW\n/u);
  assert.ok(match);
  assert.equal(result.replace(match[0], ''), source);
  assert(result.indexOf('respond @outsider 403') < result.indexOf('reverse_proxy /penshow/*'));
  assert(result.indexOf('reverse_proxy /penshow/*') < result.indexOf('respond 404'));
});

test('é idempotente e preserva CRLF quando a configuração usa esse formato', () => {
  const result = addPenshowRoute(source.replaceAll('\n', '\r\n'));
  assert.equal(addPenshowRoute(result), result);
  assert.doesNotMatch(result, /(?<!\r)\n/u);
});

test('recusa configuração desconhecida, marcadores ambíguos e alteração concorrente da rota', () => {
  for (const value of [
    source.replace('respond @outsider 403', 'respond 403'),
    source + source,
    source.replace('app:3000', 'other:3000'),
    source + '# /penshow already configured\n',
    addPenshowRoute(source).replace('penshow:3000', 'other:3000'),
  ])
    assert.throws(() => addPenshowRoute(value));
});

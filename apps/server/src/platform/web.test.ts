import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from './config.js';

const apps: ReturnType<typeof buildApp>[] = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(base = '/penshow/') {
  const root = await mkdtemp(join(tmpdir(), 'penshow-web-'));
  roots.push(root);
  await mkdir(join(root, 'assets'));
  await writeFile(
    join(root, 'index.html'),
    `<html><script src="${base}assets/index-abcdefgh.js"></script></html>`,
  );
  await writeFile(join(root, 'assets/index-abcdefgh.js'), 'console.log("cliente público")');
  await writeFile(join(root, 'catalog.json'), 'gabarito-privado');
  await writeFile(join(root, '.env'), 'segredo-privado');
  const app = buildApp({
    config: loadConfig({ NODE_ENV: 'test', WEB_ROOT: root, WEB_BASE_PATH: base }),
  });
  apps.push(app);
  return { app, root };
}
describe('artefato web servido pelo servidor', () => {
  it.each(['/penshow/', '/', '/jogos/penshow/'])(
    'serve páginas e assets no caminho %s com cache apropriado',
    async (base) => {
      const { app } = await fixture(base);
      for (const route of ['', 'perfil', 'criar', 'sala/ABC234']) {
        const response = await app.inject(`${base}${route}`);
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.headers['cache-control']).toBe('no-cache');
      }
      const asset = await app.inject(`${base}assets/index-abcdefgh.js`);
      expect(asset.statusCode).toBe(200);
      expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(asset.headers['x-content-type-options']).toBe('nosniff');
      const health = await app.inject(`${base}api/health`);
      expect(health.json()).toEqual({ service: 'penshow', status: 'ok' });
      expect(health.headers['cache-control']).toBe('no-store');
      const created = await app.inject({ method: 'POST', url: `${base}api/guest-sessions` });
      expect(created.statusCode).toBe(201);
      const { playerId, token } = created.json();
      const verified = await app.inject({
        url: `/guest-sessions/${playerId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(verified.statusCode).toBe(200);
    },
  );
  it('não expõe conteúdo privado, mapas, caminhos externos nem arquivos inexistentes como HTML', async () => {
    const { app } = await fixture();
    for (const path of [
      '/comicle/',
      '/data/questions/published/catalog.json',
      '/penshow/catalog.json',
      '/penshow/.env',
      '/penshow/assets/index-abcdefgh.js.map',
      '/penshow/assets/missing.js',
      '/penshow/../data/questions/published/catalog.json',
      '/penshow/%2e%2e/data/sources.json',
      '/api/missing',
      '/penshow/missing',
    ]) {
      const response = await app.inject(path);
      expect(response.statusCode, path).toBe(404);
      expect(response.body).not.toContain('<html>');
      expect(response.body).not.toMatch(/gabarito-privado|segredo-privado/);
    }
    expect((await app.inject('/penshow')).headers.location).toBe('/penshow/');
    expect((await app.inject({ method: 'POST', url: '/penshow/perfil' })).statusCode).toBe(404);
  });
  it('não inicia com base diferente da compilada', async () => {
    const { app, root } = await fixture();
    await writeFile(join(root, 'index.html'), '<script src="/assets/wrong.js"></script>');
    await expect(app.ready()).rejects.toThrow('Build web indisponível');
  });
});

// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { createServer, normalizePath } from 'vite';
import { expect, it } from 'vitest';

it('bloqueia conteúdo editorial e servidor por /@fs sem bloquear a aplicação ou shared', async () => {
  const server = await createServer({
    configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
    root: fileURLToPath(new URL('../../', import.meta.url)),
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Porta efêmera indisponível.');
    const origin = `http://127.0.0.1:${address.port}`;
    for (const path of [
      'data/questions/published/catalog.json',
      'data/questions/reviewed/t33-002.json',
      'data/editorial-batches/t33-002.json',
      'data/editorial-baselines/t27-catalog.json',
      'data/sources.json',
      'data/narration/generated/manifest.json',
      'data/questions/candidates/questionados/geography.json',
      'data/publication-reports/questions.json',
      'data/import-reports/questionados.json',
      'apps/server/src/modules/questions/editorial-question.schema.ts',
    ]) {
      const file = normalizePath(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)));
      const response = await fetch(`${origin}/@fs/${encodeURI(file)}`);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('contentSha256');
    }
    expect((await fetch(`${origin}/`)).status).toBe(200);
    expect((await fetch(`${origin}/src/main.tsx`)).status).toBe(200);
    const shared = normalizePath(
      fileURLToPath(new URL('../../../../packages/shared/dist/index.js', import.meta.url)),
    );
    expect((await fetch(`${origin}/@fs/${encodeURI(shared)}`)).status).toBe(200);
  } finally {
    await server.close();
  }
}, 15_000);

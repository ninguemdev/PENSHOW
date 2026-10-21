import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { buildApp, type AppDependencies } from '../apps/server/src/app.ts';
import { loadConfig } from '../apps/server/src/platform/config.ts';

/** Private fixture: built web + real application, no test routes, fake answers or shared servers. */
export async function createSite(overrides: AppDependencies = {}) {
  const port = Number(process.env.PENSHOW_E2E_PORT ?? 4179);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('PENSHOW_E2E_PORT precisa ser uma porta válida.');
  const origin = `http://127.0.0.1:${port}`;
  const app = buildApp({
    ...overrides,
    config: loadConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: origin }),
  });
  let web: Awaited<ReturnType<typeof preview>> | undefined;
  try {
    const backend = await app.listen({ host: '127.0.0.1', port: 0 });
    web = await preview({
      root: fileURLToPath(new URL('../apps/web/', import.meta.url)),
      configFile: fileURLToPath(new URL('../apps/web/vite.config.ts', import.meta.url)),
      mode: 'test',
      base: '/',
      preview: {
        host: '127.0.0.1',
        port,
        strictPort: true,
        proxy: {
          '/api': { target: backend, rewrite: (path) => path.replace(/^\/api/, '') },
          '/penshow/socket.io': { target: backend, ws: true },
        },
      },
    });
    return {
      app,
      origin,
      async close() {
        await app.close();
        if (web) {
          const server = web.httpServer;
          const closed = new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
          if ('closeAllConnections' in server) server.closeAllConnections();
          await closed;
        }
      },
    };
  } catch (error) {
    await app.close();
    if (web && 'closeAllConnections' in web.httpServer) web.httpServer.closeAllConnections();
    web?.httpServer.close();
    throw error;
  }
}
export type Site = Awaited<ReturnType<typeof createSite>>;

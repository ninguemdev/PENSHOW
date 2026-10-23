import staticFiles from '@fastify/static';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';

export class WebBuildLoadError extends Error {
  constructor() {
    super(
      'Build web indisponível ou incompatível com WEB_BASE_PATH. Confira WEB_ROOT e VITE_BASE_PATH.',
    );
    this.name = 'WebBuildLoadError';
  }
}

/** Only the built client directory is public; the server and catalog are siblings. */
export function registerWeb(app: FastifyInstance, root: string, base: string) {
  app.register(async (web) => {
    try {
      const html = await readFile(resolve(root, 'index.html'), 'utf8');
      if (!html.includes(`src="${base}assets/`)) throw new Error();
    } catch {
      throw new WebBuildLoadError();
    }
    await web.register(staticFiles, {
      root,
      prefix: base,
      serve: false,
      cacheControl: false,
      dotfiles: 'deny',
      allowedPath: (path) => {
        const file = path.replace(/^\//u, '');
        return (
          file === 'index.html' ||
          /^assets\/[a-zA-Z0-9_-]+\.(?:js|css)$/u.test(file) ||
          /^avatars\/[a-zA-Z0-9_/-]+\.png$/u.test(file) ||
          /^licenses\/[a-zA-Z0-9_-]+\.txt$/u.test(file)
        );
      },
      setHeaders(reply, file) {
        const path = relative(root, file).split(sep).join('/');
        reply.header(
          'Cache-Control',
          /^assets\/[^/]+-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/u.test(path)
            ? 'public, max-age=31536000, immutable'
            : path === 'index.html'
              ? 'no-cache'
              : 'public, max-age=3600',
        );
      },
    });
    if (base !== '/') web.get(base.slice(0, -1), (_request, reply) => reply.redirect(base, 308));
    web.get<{ Params: { '*': string } }>(`${base}*`, (request, reply) => {
      const route = request.params['*'];
      return reply.sendFile(
        /^(?:|perfil\/?|criar\/?|sala\/[A-HJ-NP-Z2-9]{6}\/?)$/u.test(route) ? 'index.html' : route,
      );
    });
  });
}

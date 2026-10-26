// Dedicated PENSHOW routes only. Comicle and the portfolio keep their existing Workers/routes.
export default {
  async fetch(request, environment) {
    const url = new URL(request.url);
    if (url.pathname !== '/penshow' && !url.pathname.startsWith('/penshow/'))
      return new Response('Not found', { status: 404 });
    const hostname = environment.ORIGIN_HOST;
    if (
      typeof hostname !== 'string' ||
      !/^(?=.{1,253}$)[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*$/u.test(hostname)
    )
      return new Response('Origin unavailable', { status: 503 });
    url.protocol = 'https:';
    url.hostname = hostname;
    url.port = '';
    return fetch(new Request(url, request));
  },
};

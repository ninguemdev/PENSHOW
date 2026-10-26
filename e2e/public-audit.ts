import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { serverEventSchema, type RoomView } from '@penshow/shared';

export function observePublicMessages(page: Page, origin: string) {
  const views: RoomView[] = [],
    failures: Error[] = [],
    pending = new Set<Promise<void>>();
  const external: string[] = [],
    pageErrors: string[] = [];
  function packet(data: string) {
    for (const frame of data.split('\x1e')) {
      if (!frame.startsWith('42[')) continue;
      const [name, raw] = JSON.parse(frame.slice(2)) as [string, unknown];
      if (name !== 'room:view') continue;
      const parsed = serverEventSchema.parse(raw);
      if (parsed.event !== 'room:view') throw new Error('Envelope incorreto.');
      const view = parsed.payload;
      expect(JSON.stringify(view)).not.toMatch(
        /"editorialQuestionId"|"editorialOptionByPublicId"|"receivedAt"|"selection"|"source"|"token"|"connectionId"/,
      );
      if (view.state.status === 'match') {
        const stage = view.state.match.stage;
        expect(JSON.stringify(view)).not.toContain('"pressureOrder"');
        if (view.state.match.pressureRules && stage.phase !== 'reveal')
          expect(view.state.match.pressureTurn?.outcome).toBeUndefined();
        if (stage.phase === 'question-open')
          expect(JSON.stringify(stage)).not.toMatch(/"attackerPlayerId"|"theftResult"/);
        expect(JSON.stringify(view)).not.toMatch(/"wagers"|"pointsAtSelection"/);
        if (stage.phase !== 'reveal') expect(JSON.stringify(view)).not.toContain('"wagerResults"');
        if (stage.phase === 'wager-selection')
          expect(JSON.stringify(stage)).not.toMatch(/"prompt"|"options"|"correctOptionId"/);
        if (stage.phase === 'final-tiebreak') {
          const own = stage.tiebreak.ownQuestion;
          if (own.status !== 'resolved')
            expect(JSON.stringify(stage)).not.toMatch(/"correctOptionId"|"explanation"/);
          if (own.status === 'reading') expect(JSON.stringify(own)).not.toContain('"options"');
        } else if (
          ![
            'reveal',
            'final-target-selection',
            'final-resolution',
            'final-no-target-pending',
          ].includes(stage.phase)
        )
          expect(JSON.stringify(view)).not.toMatch(/"correctOptionId"|"explanation"/);
        if (stage.phase === 'question-reading' || stage.phase === 'final-question-reading')
          expect(JSON.stringify(stage)).not.toContain('"options"');
      }
      views.push(view);
    }
  }
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) external.push(url.origin);
  });
  page.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      try {
        packet(typeof payload === 'string' ? payload : payload.toString());
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error('Frame inválido.'));
      }
    }),
  );
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      !/^\/(?:penshow\/)?api\//u.test(url.pathname) &&
      !(
        url.pathname.startsWith('/penshow/socket.io') &&
        url.searchParams.get('transport') === 'polling' &&
        response.request().method() === 'GET'
      )
    )
      return;
    const task = (async () => {
      const body = await response.text();
      if (/^\/(?:penshow\/)?api\//u.test(url.pathname))
        expect(body).not.toMatch(
          /"correctOptionId"|"explanation"|"editorialQuestionId"|"editorialOptionByPublicId"/,
        );
      else packet(body);
    })().catch((error: unknown) => {
      // Navigation may cancel a long poll; a response that was actually received must parse.
      if (
        error instanceof Error &&
        /Protocol error|No resource with given identifier|Target.*closed|Response body is unavailable/.test(
          error.message,
        )
      )
        return;
      failures.push(error instanceof Error ? error : new Error('Resposta inválida.'));
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  return {
    views,
    async verify() {
      await Promise.all([...pending]);
      expect(failures.map((error) => error.message)).toEqual([]);
      expect(external).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(views.length).toBeGreaterThan(0);
      expect(new Set(views.map((view) => view.viewerId)).size).toBe(1);
    },
  };
}
export type PublicAudit = ReturnType<typeof observePublicMessages>;

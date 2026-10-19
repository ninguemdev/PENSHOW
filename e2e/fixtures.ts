import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { createSite, type Site } from './site.ts';
import { observePublicMessages, type PublicAudit } from './public-audit.ts';

export interface Player {
  context: BrowserContext;
  page: Page;
  audit: PublicAudit;
}
interface Fixtures {
  site: Site;
  players: [Player, Player];
}

export const test = base.extend<Fixtures>({
  // Playwright requires a destructured first argument to discover fixture dependencies.
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const site = await createSite();
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
  players: async ({ browser, site }, use, info) => {
    const contexts: BrowserContext[] = [];
    try {
      const players: Player[] = [];
      for (let index = 0; index < 2; index++) {
        const context = await browser.newContext({
          baseURL: site.origin,
          viewport: info.project.use.viewport ?? { width: 1280, height: 900 },
          isMobile: info.project.use.isMobile ?? false,
          hasTouch: info.project.use.hasTouch ?? false,
          deviceScaleFactor: 1,
          locale: 'pt-BR',
          timezoneId: 'America/Sao_Paulo',
        });
        contexts.push(context);
        // Any dependency on remote content fails instead of silently fetching it.
        await context.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin === site.origin) await route.continue();
          else await route.abort('blockedbyclient');
        });
        const page = await context.newPage(),
          audit = observePublicMessages(page, site.origin);
        players.push({ context, page, audit });
      }
      await use(players as [Player, Player]);
    } finally {
      if (info.status !== info.expectedStatus)
        for (const [index, context] of contexts.entries())
          for (const [tab, page] of context.pages().entries())
            await attachFailure(page, info, `jogador-${index + 1}-aba-${tab + 1}`);
      await Promise.all(contexts.map((context) => context.close()));
    }
  },
});
async function attachFailure(page: Page, info: TestInfo, name: string) {
  if (page.isClosed()) return;
  try {
    await info.attach(name, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } catch {
    /* A closed/crashed renderer must not prevent fixture teardown. */
  }
}
export { expect };

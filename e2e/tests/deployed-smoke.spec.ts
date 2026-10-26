import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const target = process.env.PENSHOW_DEPLOY_URL;

test('publicação: cinco identidades entram por convite e iniciam o modo clássico', async ({
  browser,
}, info) => {
  test.skip(!target, 'Informe PENSHOW_DEPLOY_URL para testar uma instalação explicitamente.');
  const url = new URL(target!);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/')
  )
    throw new Error(
      'PENSHOW_DEPLOY_URL deve ser uma URL HTTP(S) sem credenciais/query e terminada em /.',
    );
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const wrongApiPaths: string[] = [];
  async function profile(page: Page, name: string) {
    await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
    await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
    await page.getByRole('button', { name: 'Salvar e continuar', exact: true }).click();
  }
  try {
    for (let index = 0; index < 5; index++) {
      const context = await browser.newContext({
        viewport: info.project.use.viewport ?? { width: 1280, height: 900 },
        isMobile: info.project.use.isMobile ?? false,
        hasTouch: info.project.use.hasTouch ?? false,
        locale: 'pt-BR',
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on('request', (request) => {
        const requested = new URL(request.url());
        if (requested.origin === url.origin && requested.pathname.startsWith('/api/'))
          wrongApiPaths.push(requested.pathname);
      });
      pages.push(page);
    }
    const host = pages[0]!;
    await host.goto(url.href);
    await expect(host.getByText('Versão piloto', { exact: false })).toBeVisible();
    await profile(host, 'Piloto 1');
    await host.getByRole('link', { name: 'Criar sala', exact: true }).click();
    await host.getByRole('spinbutton', { name: 'Vagas de jogadores' }).fill('5');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    const invite = await host.getByRole('textbox', { name: 'Link do convite' }).inputValue();
    expect(new URL(invite).origin).toBe(url.origin);
    expect(new URL(invite).pathname).toMatch(new RegExp(`^${url.pathname}sala/[A-HJ-NP-Z2-9]{6}$`));
    for (const [index, guest] of pages.slice(1).entries()) {
      await guest.goto(invite);
      await profile(guest, `Piloto ${index + 2}`);
      await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    }
    for (const page of pages)
      await expect(
        page.getByRole('region', { name: 'Pessoas na sala' }).getByRole('listitem'),
      ).toHaveCount(5);
    await host.getByRole('button', { name: 'Iniciar modo clássico', exact: true }).click();
    for (const page of pages)
      await expect(
        page.getByRole('list', { name: 'Ordem das fases' }).getByRole('listitem'),
      ).toHaveCount(5);
    await pages[4]!.reload();
    await expect(
      pages[4]!.getByRole('list', { name: 'Ordem das fases' }).getByRole('listitem'),
    ).toHaveCount(5);
    expect(wrongApiPaths).toEqual([]);
    await info.attach('cinco-jogadores.png', {
      body: await host.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

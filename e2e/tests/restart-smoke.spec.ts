import { test, expect } from '../fixtures.ts';
import { buildApp } from '../../apps/server/src/app.ts';

test('reinício: sala e sessão antigas encerram, perfil local continua disponível', async ({
  site,
  players,
}) => {
  const host = players[0];
  await host.page.goto('/');
  await host.page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await host.page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill('Ana');
  await host.page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(host.page.getByRole('heading', { name: 'Pessoas na sala' })).toBeVisible();
  const address = site.app.server.address();
  if (!address || typeof address === 'string') throw new Error();
  const restarted = buildApp({ config: site.app.config });
  await site.app.close();
  try {
    await restarted.listen({ host: '127.0.0.1', port: address.port });
    expect(restarted.rooms.registry.all()).toEqual([]);
    await host.page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(
      host.page.getByText('Sua sessão terminou. Ative uma nova para continuar.', { exact: true }),
    ).toBeVisible();
    await expect(host.page.getByRole('heading', { name: 'Pessoas na sala' })).toHaveCount(0);
    await host.page.getByRole('link', { name: 'Meu perfil', exact: true }).click();
    await expect(
      host.page.getByRole('textbox', { name: 'Como você quer ser chamado?' }),
    ).toHaveValue('Ana');
    await host.audit.verify();
  } finally {
    await restarted.close();
  }
});

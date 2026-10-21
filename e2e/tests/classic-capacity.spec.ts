import { test, expect } from '../classic-fixture.ts';
import { createClassicGroup } from '../classic-group.ts';
import { connectRoomBot } from '../../apps/server/src/test-support/room-bot.ts';

test('modo completo: doze participantes visíveis e 24 turnos de dinamite', async ({
  site,
  players,
}, info) => {
  const g = await createClassicGroup(site, players, [0, 3, 2, 1]);
  const address = site.app.server.address();
  if (!address || typeof address === 'string') throw new Error('Endereço TCP esperado.');
  const bots: Awaited<ReturnType<typeof connectRoomBot>>[] = [];
  try {
    for (let index = 3; index <= 12; index++)
      bots.push(
        await connectRoomBot(`http://127.0.0.1:${address.port}`, g.room.code, `Jogador ${index}`),
      );
    for (const player of players)
      await expect(
        player.page.getByRole('region', { name: 'Pessoas na sala' }).getByRole('listitem'),
      ).toHaveCount(12);
    await g.start();
    const initial = g.state();
    expect(initial.roster.players).toHaveLength(12);
    expect(initial.rounds[0]?.mode).toBe('pressure');
    const context = {
      roomId: g.room.id,
      matchId: initial.roster.matchId,
      roundId: initial.rounds[0]!.roundId,
    };
    for (const bot of bots)
      expect(await bot.command('round:ready', context)).toMatchObject({ status: 'ok' });
    for (const player of players)
      await g.command(() =>
        player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click(),
      );
    const offer = g.state().stage;
    if (offer.phase !== 'category-selection') throw new Error('Escolha esperada.');
    const chooser = bots.find((bot) => bot.playerId === offer.offer.chooserPlayerId);
    if (chooser) {
      expect(
        await chooser.command('category:choose', {
          ...context,
          category: offer.offer.categories[0],
        }),
      ).toMatchObject({ status: 'ok' });
      await g.synchronized();
    } else {
      const player = offer.offer.chooserPlayerId === g.playerId(g.host) ? g.host : g.guest;
      await g.command(() =>
        player.page
          .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
          .getByRole('button')
          .first()
          .click(),
      );
    }
    await expect.poll(() => g.state().stage.phase).toBe('question-open');
    await g.synchronized();
    for (const player of players) {
      await expect(
        player.page.getByText('Ciclo 1 de 2 · Turno 1 de 24', { exact: true }),
      ).toBeVisible();
      await expect(
        player.page.getByRole('table', { name: 'Placar do grupo' }).getByRole('row'),
      ).toHaveCount(13);
      expect(
        await player.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    const path = info.outputPath('grupo-12-dinamite.png');
    await g.host.page.screenshot({ path, fullPage: true });
    await info.attach('grupo-12-dinamite', { path, contentType: 'image/png' });
    for (const player of players) await player.audit.verify();
  } finally {
    for (const bot of bots) bot.close();
  }
});

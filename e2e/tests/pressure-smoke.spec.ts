import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';

const panel = (page: Page) => page.getByRole('region', { name: 'Quiz de dinamite', exact: true });
async function profile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('dinamite: dois ciclos inversos, turno exclusivo, prazo completo e explosão', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  await host.page.goto('/');
  await profile(host.page, 'Ana');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const start = host.page.getByRole('button', { name: 'Iniciar dinamite de teste' });
  await expect(start).toBeDisabled();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await profile(guest.page, 'Bruno');
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await expect(start).toBeEnabled();
  await expect(guest.page.getByRole('button', { name: 'Iniciar dinamite de teste' })).toHaveCount(
    0,
  );
  await start.click();
  for (const player of players)
    await panel(player.page).getByRole('button', { name: 'Estou pronto', exact: true }).click();
  const room = site.app.rooms.registry.all()[0]!;
  function state() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game.state;
  }
  const firstOrder = [...state().pressureOrder];
  await expect(panel(host.page).getByRole('heading', { name: 'Escolha do tema' })).toBeVisible();
  const offer = state().stage;
  if (offer.phase !== 'category-selection') throw new Error();
  const chooser =
    room.snapshot().members[0]!.playerId === offer.offer.chooserPlayerId ? host : guest;
  await panel(chooser.page)
    .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
    .getByRole('button')
    .first()
    .click();
  const owners: string[] = [],
    seen = new Set<string>();
  for (let turn = 0; turn < 4; turn++) {
    for (const player of players)
      await expect(
        panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toBeVisible();
    const open = state().stage;
    if (open.phase !== 'question-open') throw new Error();
    expect(state().rounds[state().roundIndex]).toMatchObject({
      mode: 'pressure',
      variant: { status: 'confirmed', decisionId: 'D04', mode: 'dynamite' },
    });
    expect(open.deadlineAt - open.opensAt).toBe(10_000);
    expect(open.question.publicQuestion.difficulty).toBe(turn < 2 ? 'medium' : 'hard');
    const ownerId = firstOrder[turn < 2 ? turn : 3 - turn]!;
    owners.push(ownerId);
    seen.add(open.question.editorialQuestionId);
    const index = room.snapshot().members[0]!.playerId === ownerId ? 0 : 1;
    const owner = players[index]!,
      other = players[1 - index]!;
    const name = index === 0 ? 'Ana' : 'Bruno';
    for (const player of players) {
      await expect(
        panel(player.page).getByText(`Dinamite com ${name}.`, { exact: true }),
      ).toBeVisible();
      await expect(
        panel(player.page).getByText(`Ciclo ${turn < 2 ? 1 : 2} de 2 · Turno ${turn + 1} de 4`, {
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      panel(other.page).getByRole('button', {
        name: open.question.publicQuestion.options[0]!.text,
        exact: true,
      }),
    ).toBeDisabled();
    if (turn === 0) {
      await owner.page.reload();
      await expect(
        panel(owner.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toBeVisible();
      const restored = state().stage;
      if (restored.phase !== 'question-open') throw new Error();
      expect(restored.deadlineAt).toBe(open.deadlineAt);
    }
    if (turn !== 2) {
      const correct = turn < 2;
      const option = open.question.publicQuestion.options.find(
        (option) => (option.optionId === open.question.correctOptionId) === correct,
      )!;
      const button = panel(owner.page).getByRole('button', { name: option.text, exact: true });
      if (info.project.use.hasTouch) await button.tap();
      else await button.press('Enter');
    }
    for (const player of players) {
      await expect(
        panel(player.page).getByText('Confira a resposta', { exact: true }),
      ).toBeVisible();
      await expect(
        panel(player.page).getByText(
          turn < 2
            ? 'Passagem segura! Resposta correta.'
            : 'Explosão! O jogador continua na partida, sem perder vidas.',
          { exact: true },
        ),
      ).toBeVisible();
      expect(
        await player.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    expect(state().history).toHaveLength(turn + 1);
    if (turn === 2) {
      const screenshot = info.outputPath('dinamite-explosao.png');
      await host.page.screenshot({ path: screenshot, fullPage: true });
      await info.attach('dinamite-explosao', { path: screenshot, contentType: 'image/png' });
    }
  }
  expect(owners).toEqual([...firstOrder, ...[...firstOrder].reverse()]);
  expect(seen.size).toBe(4);
  await expect(
    panel(host.page).getByRole('heading', { name: 'Quiz de dinamite concluído' }),
  ).toBeVisible();
  expect(state().scoreboard.map((score) => score.points)).toEqual([150, 150]);
  expect(state().scoreboard.map((score) => score.correctAnswers)).toEqual([1, 1]);
  await host.page.getByRole('button', { name: 'Voltar ao lobby' }).click();
  for (const player of players) {
    await expect(player.page.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
    await player.audit.verify();
  }
});

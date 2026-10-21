import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';

const panel = (page: Page) => page.getByRole('region', { name: 'Quiz de aposta', exact: true });
async function profile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('aposta: saldo, privacidade, recarga, acerto/erro/ausência e seis perguntas reais', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  await host.page.goto('/');
  await profile(host.page, 'Ana');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const start = host.page.getByRole('button', { name: 'Iniciar aposta de teste' });
  await expect(start).toBeDisabled();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await profile(guest.page, 'Bruno');
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await expect(start).toBeEnabled();
  await expect(guest.page.getByRole('button', { name: 'Iniciar aposta de teste' })).toHaveCount(0);
  await start.click();
  for (const player of players)
    await panel(player.page).getByRole('button', { name: 'Estou pronto', exact: true }).click();
  const room = site.app.rooms.registry.all()[0]!;
  function state() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game.state;
  }
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
  const plans = [
    { wagers: [0, 0], answers: [true, true], points: [100, 100] },
    { wagers: [50, 25], answers: [true, false], points: [250, 75] },
    { wagers: [25, 50], answers: [false, true], points: [225, 225] },
    { wagers: [0, null], answers: [true, false], points: [325, 225] },
    { wagers: [50, 50], answers: [null, true], points: [275, 375] },
    { wagers: [50, 50], answers: [true, false], points: [425, 325] },
  ];
  const seen = new Set<string>();
  for (const [index, plan] of plans.entries()) {
    for (const player of players)
      await expect(
        panel(player.page).getByRole('heading', { name: 'Escolha sua aposta' }),
      ).toBeVisible();
    const selection = state().stage;
    if (selection.phase !== 'wager-selection') throw new Error();
    const before = state().scoreboard;
    seen.add(selection.question.editorialQuestionId);
    for (const [i, player] of players.entries()) {
      await expect(
        panel(player.page).getByRole('heading', {
          name: selection.question.publicQuestion.prompt,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toHaveCount(0);
      if (index === 0) {
        await expect(
          panel(player.page).getByText('Seu saldo: 0 pontos', { exact: true }),
        ).toBeVisible();
        await expect(
          panel(player.page).getByRole('button', { name: 'Apostar 25 pontos', exact: true }),
        ).toHaveCount(0);
      }
      const wager = plan.wagers[i];
      if (wager !== null) {
        const button = panel(player.page).getByRole('button', {
          name: `Apostar ${wager} pontos`,
          exact: true,
        });
        if (info.project.use.hasTouch) await button.tap();
        else await button.press('Enter');
        await expect(
          panel(player.page).getByText(
            `Aposta de ${wager} pontos registrada. Aguarde a pergunta.`,
            { exact: true },
          ),
        ).toBeVisible();
      }
    }
    expect(state().scoreboard).toEqual(before);
    if (index === 1) {
      await host.page.reload();
      await expect(
        panel(host.page).getByText('Aposta de 50 pontos registrada. Aguarde a pergunta.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        panel(host.page).getByRole('button', { name: 'Apostar 50 pontos', exact: true }),
      ).toBeDisabled();
      const restored = state().stage;
      if (restored.phase !== 'wager-selection') throw new Error();
      expect(restored.deadlineAt).toBe(selection.deadlineAt);
    }
    for (const player of players)
      await expect(
        panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toBeVisible();
    const open = state().stage;
    if (open.phase !== 'question-open') throw new Error();
    for (const [i, player] of players.entries()) {
      const correct = plan.answers[i];
      if (correct === null) continue;
      const option = open.question.publicQuestion.options.find(
        (option) => (option.optionId === open.question.correctOptionId) === correct,
      )!;
      await panel(player.page)
        .getByRole('group', { name: 'Escolha sua resposta' })
        .getByRole('button', { name: option.text, exact: true })
        .click();
    }
    for (const player of players) {
      await expect(
        panel(player.page).getByText('Confira a resposta', { exact: true }),
      ).toBeVisible();
      const result = state().history.at(-1)!;
      for (const [i, score] of result.after.entries()) {
        const member = room
          .snapshot()
          .members.find((member) => member.playerId === score.playerId)!;
        expect(score.points).toBe(plan.points[i]);
        const list = panel(player.page).getByRole('list', {
          name: 'Apostas e saldos nesta pergunta',
        });
        await expect(
          list.getByText(
            `${member.profile.nickname}: Aposta ${plan.wagers[i] ?? 0} · Saldo ${before[i]!.points} → ${score.points}`,
          ),
        ).toBeVisible();
        const row = panel(player.page)
          .getByRole('table')
          .getByRole('row', { name: new RegExp(member.profile.nickname) });
        await expect(row.getByRole('cell').nth(0)).toHaveText(String(score.points));
      }
      expect(
        await player.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
  await expect(
    panel(host.page).getByRole('heading', { name: 'Quiz de aposta concluído' }),
  ).toBeVisible();
  expect(seen.size).toBe(6);
  const screenshot = info.outputPath('aposta-resultado.png');
  await host.page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('aposta-resultado', { path: screenshot, contentType: 'image/png' });
  await host.page.getByRole('button', { name: 'Voltar ao lobby' }).click();
  for (const player of players) {
    await expect(player.page.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
    await player.audit.verify();
  }
  await info.attach('resumo-aposta', {
    body: Buffer.from(
      JSON.stringify({
        uniqueQuestions: seen.size,
        finalPoints: [425, 325],
        reconnected: true,
        returnedToLobby: true,
      }),
    ),
    contentType: 'application/json',
  });
});

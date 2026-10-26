import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';

const panel = (page: Page) =>
  page.getByRole('region', { name: 'Quiz de roubo de pontos', exact: true });
async function profile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('roubo: seis perguntas, primeiro acerto, alvo, timeout e transferência oficial', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  await host.page.goto('/');
  await profile(host.page, 'Ana');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const start = host.page.getByRole('button', { name: 'Iniciar roubo de teste' });
  await expect(start).toBeDisabled();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await profile(guest.page, 'Bruno');
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await expect(start).toBeEnabled();
  await expect(guest.page.getByRole('button', { name: 'Iniciar roubo de teste' })).toHaveCount(0);
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
    { order: [0, 1], answers: [true, true], attacker: 0, points: [200, 0] },
    { order: [0, 1], answers: [false, true], attacker: 1, points: [100, 200] },
    { order: [0, 1], answers: [false, false], attacker: null, points: [100, 200] },
    { order: [0, 1], answers: [true, true], attacker: null, points: [200, 300] },
    { order: [1, 0], answers: [true, true], attacker: 1, points: [200, 500] },
    { order: [0, 1], answers: [true, false], attacker: 0, points: [400, 400] },
  ];
  const seen = new Set<string>();
  for (const [index, plan] of plans.entries()) {
    for (const player of players)
      await expect(
        panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toBeVisible();
    const open = state().stage;
    if (open.phase !== 'question-open') throw new Error();
    seen.add(open.question.editorialQuestionId);
    for (const i of plan.order) {
      const option = open.question.publicQuestion.options.find(
        (option) => (option.optionId === open.question.correctOptionId) === plan.answers[i],
      )!;
      await panel(players[i]!.page)
        .getByRole('group', { name: 'Escolha sua resposta' })
        .getByRole('button', { name: option.text, exact: true })
        .click();
      if (i === plan.order[0]) {
        for (const player of players)
          await expect(
            panel(player.page).getByRole('heading', { name: 'Escolha do alvo do roubo' }),
          ).toHaveCount(0);
      }
    }
    if (plan.attacker !== null) {
      const actor = players[plan.attacker]!,
        other = players[1 - plan.attacker]!;
      await expect(
        panel(actor.page).getByRole('heading', { name: 'Escolha do alvo do roubo' }),
      ).toBeVisible();
      await expect(panel(other.page).getByRole('button', { name: /Roubar de/ })).toHaveCount(0);
      if (index === 0) {
        const target = state().stage;
        if (target.phase !== 'theft-target-selection') throw new Error();
        await actor.page.reload();
        await expect(
          panel(actor.page).getByRole('heading', { name: 'Escolha do alvo do roubo' }),
        ).toBeVisible();
        const restored = state().stage;
        if (restored.phase !== 'theft-target-selection') throw new Error();
        expect(restored.deadlineAt).toBe(target.deadlineAt);
        expect(restored.attackerPlayerId).toBe(target.attackerPlayerId);
      }
      const choose = panel(actor.page)
        .getByRole('group', { name: 'Escolha do alvo do roubo' })
        .getByRole('button')
        .first();
      if (info.project.use.hasTouch) await choose.tap();
      else await choose.press('Enter');
    }
    for (const player of players) {
      await expect(
        panel(player.page).getByText('Confira a resposta', { exact: true }),
      ).toBeVisible();
      if (plan.attacker === null)
        await expect(
          panel(player.page).getByText('Sem transferência nesta pergunta.', { exact: true }),
        ).toBeVisible();
      else
        await expect(
          panel(player.page).getByText(
            plan.attacker === 0
              ? 'Ana roubou 100 pontos de Bruno.'
              : 'Bruno roubou 100 pontos de Ana.',
            { exact: true },
          ),
        ).toBeVisible();
      for (const [i, name] of ['Ana', 'Bruno'].entries()) {
        const row = panel(player.page)
          .getByRole('table')
          .getByRole('row', { name: new RegExp(name) });
        await expect(row.getByRole('cell').nth(0)).toHaveText(String(plan.points[i]));
      }
      await expect(
        panel(player.page)
          .getByRole('list', { name: 'Créditos e transferência nesta pergunta' })
          .getByRole('listitem'),
      ).toHaveCount(2);
      expect(
        await player.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    if (index === 5) {
      const screenshot = info.outputPath('roubo-transferencia.png');
      await host.page.screenshot({ path: screenshot, fullPage: true });
      await info.attach('roubo-transferencia', { path: screenshot, contentType: 'image/png' });
    }
    expect(state().history).toHaveLength(index + 1);
  }
  await expect(
    panel(host.page).getByRole('heading', { name: 'Quiz de roubo concluído' }),
  ).toBeVisible();
  expect(seen.size).toBe(6);
  expect(state().scoreboard.map((score) => score.points)).toEqual([400, 400]);
  await host.page.getByRole('button', { name: 'Voltar ao lobby' }).click();
  for (const player of players) {
    await expect(player.page.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
    await player.audit.verify();
  }
});

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';

const panel = (page: Page) => page.getByRole('region', { name: 'Quiz de velocidade', exact: true });
async function profile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('velocidade: seis perguntas, bônus oficiais, recarga após resposta e retorno', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  await host.page.goto('/');
  await profile(host.page, 'Ana');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const start = host.page.getByRole('button', { name: 'Iniciar velocidade de teste' });
  await expect(start).toBeDisabled();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await profile(guest.page, 'Bruno');
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await expect(start).toBeEnabled();
  await expect(guest.page.getByRole('button', { name: 'Iniciar velocidade de teste' })).toHaveCount(
    0,
  );
  await start.click();
  for (const player of players) {
    await expect(
      panel(player.page).getByText('Cada acerto vale +100 de base. Erro ou ausência vale zero.'),
    ).toBeVisible();
    await expect(panel(player.page).getByText('De 0 s até antes de 5 s: bônus +50.')).toBeVisible();
    await panel(player.page).getByRole('button', { name: 'Estou pronto', exact: true }).click();
  }
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
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    for (const player of players)
      await expect(
        panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
      ).toBeVisible();
    const open = state().stage;
    if (open.phase !== 'question-open') throw new Error();
    const question = open.question;
    seen.add(question.editorialQuestionId);
    const right = question.publicQuestion.options.find(
      (option) => option.optionId === question.correctOptionId,
    )!;
    const wrong = question.publicQuestion.options.find(
      (option) => option.optionId !== question.correctOptionId,
    )!;
    const hostOptions = panel(host.page).getByRole('group', { name: 'Escolha sua resposta' });
    await hostOptions.getByRole('button', { name: right.text, exact: true }).click();
    await expect(
      panel(host.page).getByText('Resposta registrada. Aguarde a revelação.'),
    ).toBeVisible();
    if (i === 0) {
      await host.page.reload();
      await expect(
        panel(host.page).getByText('Resposta registrada. Aguarde a revelação.'),
      ).toBeVisible();
      await expect(
        hostOptions.getByRole('button', { name: right.text, exact: true }),
      ).toBeDisabled();
      const restored = state().stage;
      if (restored.phase !== 'question-open') throw new Error();
      expect(restored.deadlineAt).toBe(open.deadlineAt);
    }
    const guestOptions = panel(guest.page).getByRole('group', { name: 'Escolha sua resposta' });
    await guestOptions
      .getByRole('button', { name: i % 2 === 0 ? wrong.text : right.text, exact: true })
      .click();
    for (const player of players) {
      await expect(
        panel(player.page).getByText('Confira a resposta', { exact: true }),
      ).toBeVisible();
      await expect(
        panel(player.page).getByText(`Fase 1 de 1 · Pergunta ${i + 1} de 6`, { exact: true }),
      ).toBeVisible();
      const result = state().history.at(-1)!;
      for (const score of result.after) {
        const member = room
          .snapshot()
          .members.find((member) => member.playerId === score.playerId)!;
        const effects = result.effects.filter((effect) => effect.playerId === score.playerId);
        const base = effects.find((effect) => effect.reason === 'correct-answer')?.amount ?? 0;
        const bonus = effects.find((effect) => effect.reason === 'speed-bonus')?.amount ?? 0;
        expect([0, 25, 50]).toContain(bonus);
        const list = panel(player.page).getByRole('list', { name: 'Bônus de velocidade' });
        await expect(
          list.getByText(
            `${member.profile.nickname}: Base +${base} · Bônus +${bonus} · Total +${base + bonus}`,
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
    panel(host.page).getByRole('heading', { name: 'Quiz de velocidade concluído' }),
  ).toBeVisible();
  expect(seen.size).toBe(6);
  expect(state().scoreboard.map((score) => score.correctAnswers)).toEqual([6, 3]);
  await host.page.getByRole('button', { name: 'Voltar ao lobby' }).click();
  for (const player of players) {
    await expect(player.page.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
    await player.audit.verify();
  }
  await info.attach('resumo-velocidade', {
    body: Buffer.from(
      JSON.stringify({ uniqueQuestions: seen.size, reconnected: true, returnedToLobby: true }),
    ),
    contentType: 'application/json',
  });
});

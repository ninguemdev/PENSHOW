import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';
import { matchTimer } from '../../apps/server/src/modules/matches/match.domain.ts';
import { QuestionSelection } from '../../apps/server/src/modules/questions/question-selection.ts';
import { observePublicMessages } from '../public-audit.ts';
const panel = (page: Page) => page.getByRole('region', { name: 'Final de vidas', exact: true });
async function profile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('final e revanche: duas partidas, concorrência, pódio, histórico e troca de participantes', async ({
  site,
  players,
  browser,
}, info) => {
  test.setTimeout(300_000);
  const [host, guest] = players;
  await host.page.goto('/');
  await profile(host.page, 'Ana');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await profile(guest.page, 'Bruno');
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Iniciar quiz clássico', exact: true }).click();
  for (const player of players)
    await player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  const room = site.app.rooms.registry.all()[0]!;
  function state() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game.state;
  }
  async function advance() {
    const timer = matchTimer(state());
    if (!timer) throw new Error('Prazo esperado.');
    await expect.poll(() => matchTimer(state())?.deadlineAt).not.toBe(timer.deadlineAt);
  }
  await expect(host.page.getByRole('heading', { name: 'Escolha do tema' })).toBeVisible();
  const offer = state().stage;
  if (offer.phase !== 'category-selection') throw new Error();
  const chooser =
    room.snapshot().members[0]!.playerId === offer.offer.chooserPlayerId ? host : guest;
  await chooser.page
    .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
    .getByRole('button')
    .first()
    .click();
  for (let i = 0; i < 6; i++) {
    await expect(
      host.page.getByText('As alternativas serão liberadas em instantes.', { exact: true }),
    ).toBeVisible();
    await advance();
    for (const player of players)
      await expect(player.page.getByRole('group', { name: 'Escolha sua resposta' })).toBeVisible();
    const open = state().stage;
    if (open.phase !== 'question-open') throw new Error();
    for (const [index, player] of players.entries()) {
      const option = open.question.publicQuestion.options.find(
        (option) => (option.optionId === open.question.correctOptionId) === (index === 0),
      )!;
      await player.page
        .getByRole('group', { name: 'Escolha sua resposta' })
        .getByRole('button', { name: option.text, exact: true })
        .click();
    }
    await expect(host.page.getByText('Confira a resposta', { exact: true })).toBeVisible();
    await advance();
  }
  await expect(host.page.getByRole('heading', { name: 'Resultado da fase' })).toBeVisible();
  await advance();
  const start = host.page.getByRole('button', { name: 'Iniciar final de teste' });
  await expect(start).toBeVisible();
  await expect(guest.page.getByRole('button', { name: 'Iniciar final de teste' })).toHaveCount(0);
  await start.click();
  for (const player of players) {
    await expect(
      panel(player.page).getByRole('heading', { name: 'Prepare-se para a final' }),
    ).toBeVisible();
    await panel(player.page).getByRole('button', { name: 'Estou pronto', exact: true }).click();
  }
  const guestId = room.snapshot().members[1]!.playerId;
  const hostId = room.snapshot().members[0]!.playerId;
  // First error closes the question and removes exactly one life.
  await expect(
    panel(guest.page).getByText('As alternativas serão liberadas em instantes.', { exact: true }),
  ).toBeVisible();
  await advance();
  const wrongOpen = state().final!.stage;
  if (wrongOpen.phase !== 'final-question-open') throw new Error();
  await panel(guest.page)
    .getByRole('button', {
      name: wrongOpen.question.publicQuestion.options.find(
        (option) => option.optionId !== wrongOpen.question.correctOptionId,
      )!.text,
      exact: true,
    })
    .click();
  for (const player of players) {
    await expect(
      panel(player.page).getByText('Bruno errou e perdeu uma vida.', { exact: true }),
    ).toBeVisible();
    await expect(panel(player.page).getByRole('button', { name: /Atacar/ })).toHaveCount(0);
  }
  expect(state().final!.history).toHaveLength(1);
  expect(state().final!.finalists.find((player) => player.playerId === guestId)!.lives).toBe(3);
  await advance();
  await advance();
  // Both tabs dispatch their answer; the authoritative queue chooses one respondent.
  for (const player of players)
    await expect(
      panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
    ).toBeVisible();
  const race = state().final!.stage;
  if (race.phase !== 'final-question-open') throw new Error();
  const correct = race.question.publicQuestion.options.find(
    (option) => option.optionId === race.question.correctOptionId,
  )!.text;
  // Hold only the queue while both real UI handlers dispatch, so neither tab
  // loses its button to an incoming projection before it has clicked.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = room.runExclusive(() => gate);
  try {
    await Promise.all(
      players.map((player) =>
        panel(player.page)
          .getByRole('button', { name: correct, exact: true })
          .evaluate((button: HTMLButtonElement) => button.click()),
      ),
    );
  } finally {
    release();
  }
  await held;
  await expect(
    panel(host.page).getByRole('heading', { name: 'Escolha o alvo da final' }),
  ).toBeVisible();
  const target = state().final!.stage;
  if (target.phase !== 'final-target-selection') throw new Error();
  const actor = target.accepted.playerId === hostId ? host : guest;
  const other = actor === host ? guest : host;
  await expect(panel(other.page).getByRole('button', { name: /Atacar/ })).toHaveCount(0);
  await actor.page.reload();
  await expect(
    panel(actor.page).getByRole('heading', { name: 'Escolha o alvo da final' }),
  ).toBeVisible();
  const restored = state().final!.stage;
  if (restored.phase !== 'final-target-selection') throw new Error();
  expect(restored.deadlineAt).toBe(target.deadlineAt);
  await other.page.goto('about:blank');
  await expect
    .poll(
      () =>
        room.snapshot().members.find((member) => member.playerId !== target.accepted.playerId)
          ?.connection.status,
    )
    .toBe('disconnected');
  const attack = panel(actor.page).getByRole('button', { name: /Atacar.*desconectado/ });
  if (info.project.use.hasTouch) await attack.tap();
  else await attack.press('Enter');
  await expect(
    panel(actor.page).getByRole('heading', { name: 'Resultado da pergunta da final' }),
  ).toBeVisible();
  expect(state().final!.history).toHaveLength(2);
  expect(state().final!.history[1]!.resolution.outcome).toBe('attack');
  await other.page.goto(invite);
  await expect(
    panel(other.page).getByRole('heading', { name: 'Resultado da pergunta da final' }),
  ).toBeVisible();
  // Finish by attacking Bruno, verifying zero lives and the restored spectator screen.
  while (state().final!.finalists.find((player) => player.playerId === guestId)!.lives > 0) {
    await advance();
    await advance();
    await expect(
      panel(host.page).getByRole('group', { name: 'Escolha sua resposta' }),
    ).toBeVisible();
    const open = state().final!.stage;
    if (open.phase !== 'final-question-open') throw new Error();
    await panel(host.page)
      .getByRole('button', {
        name: open.question.publicQuestion.options.find(
          (option) => option.optionId === open.question.correctOptionId,
        )!.text,
        exact: true,
      })
      .click();
    await panel(host.page)
      .getByRole('button', { name: /Atacar Bruno/ })
      .click();
    await expect(
      panel(guest.page).getByRole('heading', { name: 'Resultado da pergunta da final' }),
    ).toBeVisible();
  }
  await expect(
    panel(guest.page).getByText('Você foi eliminado e está assistindo à final.', { exact: true }),
  ).toBeVisible();
  await guest.page.reload();
  await expect(
    panel(guest.page).getByText('Você foi eliminado e está assistindo à final.', { exact: true }),
  ).toBeVisible();
  await expect(panel(guest.page).getByRole('button', { name: /Atacar/ })).toHaveCount(0);
  await expect(panel(guest.page).getByRole('group', { name: 'Escolha sua resposta' })).toHaveCount(
    0,
  );
  for (const player of players) {
    expect(
      await player.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await player.audit.verify();
  }
  const screenshot = info.outputPath('final-vidas.png');
  await guest.page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('final-vidas', { path: screenshot, contentType: 'image/png' });
  await advance();
  await expect(panel(host.page).getByText('Ana venceu a final!', { exact: true })).toBeVisible();
  await expect(
    panel(host.page).getByRole('list', { name: 'Classificação final' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(
    panel(host.page).getByRole('heading', { name: 'Placar antes da final' }),
  ).toBeVisible();
  await expect(panel(host.page).getByRole('heading', { name: 'Resumo por fase' })).toBeVisible();
  const oldMatch = state().roster.matchId;
  const oldRound = state().rounds[0]!.roundId;
  const phase = room.snapshot().phase;
  if (phase.status !== 'match' || !phase.game) throw new Error();
  const previousQueue = QuestionSelection.resume(
    phase.game.selection,
    site.app.runtime,
  ).choiceQueueForRematch();
  const nextContext = await browser.newContext({
    baseURL: site.origin,
    viewport: info.project.use.viewport ?? { width: 1280, height: 900 },
    isMobile: info.project.use.isMobile ?? false,
    hasTouch: info.project.use.hasTouch ?? false,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  try {
    await nextContext.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === site.origin) await route.continue();
      else await route.abort('blockedbyclient');
    });
    const newPage = await nextContext.newPage();
    const audit = observePublicMessages(newPage, site.origin);
    await newPage.goto(invite);
    await profile(newPage, 'Cris');
    await newPage.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await expect(panel(newPage).getByRole('heading', { name: 'Pódio da partida' })).toBeVisible();
    const newcomer = room.snapshot().members.at(-1)!;
    expect(newcomer.role).toBe('spectator');
    await expect(panel(newPage).getByRole('button', { name: 'Preparar revanche' })).toHaveCount(0);
    await host.page.getByRole('button', { name: 'Sair da sala', exact: true }).click();
    await host.page
      .getByRole('dialog', { name: 'Sair desta sala?' })
      .getByRole('button', { name: 'Sair da sala', exact: true })
      .click();
    await panel(guest.page).getByRole('button', { name: 'Preparar revanche' }).click();
    for (const page of [guest.page, newPage]) {
      await expect(page.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Pódio da partida' })).toHaveCount(0);
    }
    expect(room.snapshot().members.map((member) => member.playerId)).toEqual([
      guestId,
      newcomer.playerId,
    ]);
    expect(room.snapshot().members.every((member) => member.role === 'player')).toBe(true);
    await guest.page.getByRole('button', { name: 'Iniciar quiz clássico', exact: true }).click();
    const fresh = state();
    expect(fresh.roster.matchId).not.toBe(oldMatch);
    expect(fresh.rounds[0]!.roundId).not.toBe(oldRound);
    expect(fresh.history).toEqual([]);
    expect(fresh.final).toBeNull();
    expect(
      fresh.scoreboard.every((score) => score.points === 0 && score.correctAnswers === 0),
    ).toBe(true);
    for (const page of [guest.page, newPage])
      await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
    const selection = state().stage;
    if (selection.phase !== 'category-selection') throw new Error();
    expect(selection.offer.chooserPlayerId).toBe(
      previousQueue.pending.find((id) => id !== hostId) ?? newcomer.playerId,
    );
    const choosePage = selection.offer.chooserPlayerId === guestId ? guest.page : newPage;
    await choosePage
      .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
      .getByRole('button')
      .first()
      .click();
    for (let i = 0; i < 6; i++) {
      await expect(
        guest.page.getByText('As alternativas serão liberadas em instantes.', { exact: true }),
      ).toBeVisible();
      await advance();
      const open = state().stage;
      if (open.phase !== 'question-open') throw new Error();
      for (const [index, page] of [guest.page, newPage].entries()) {
        const option = open.question.publicQuestion.options.find(
          (option) => (option.optionId === open.question.correctOptionId) === (index === 1),
        )!;
        await page
          .getByRole('group', { name: 'Escolha sua resposta' })
          .getByRole('button', { name: option.text, exact: true })
          .click();
      }
      await expect(guest.page.getByText('Confira a resposta', { exact: true })).toBeVisible();
      await advance();
    }
    await expect(guest.page.getByRole('heading', { name: 'Resultado da fase' })).toBeVisible();
    await advance();
    await guest.page.getByRole('button', { name: 'Iniciar final de teste' }).click();
    for (const page of [guest.page, newPage])
      await panel(page).getByRole('button', { name: 'Estou pronto', exact: true }).click();
    expect(state().final!.finalists.find((player) => player.playerId === guestId)!.rank).toBe(2);
    while (state().final!.stage.phase !== 'podium') {
      await advance();
      const open = state().final!.stage;
      if (open.phase !== 'final-question-open') throw new Error();
      await panel(guest.page)
        .getByRole('button', {
          name: open.question.publicQuestion.options.find(
            (option) => option.optionId === open.question.correctOptionId,
          )!.text,
          exact: true,
        })
        .click();
      const attack = panel(guest.page).getByRole('button', { name: /Atacar Cris/ });
      if (info.project.use.hasTouch) await attack.tap();
      else await attack.press('Enter');
      await expect(
        panel(newPage).getByRole('heading', { name: 'Resultado da pergunta da final' }),
      ).toBeVisible();
      await advance();
    }
    await guest.page.reload();
    for (const page of [guest.page, newPage]) {
      await expect(panel(page).getByText('Bruno venceu a final!', { exact: true })).toBeVisible();
      const order = panel(page)
        .getByRole('list', { name: 'Classificação final' })
        .getByRole('listitem');
      await expect(order.nth(0)).toContainText('Bruno');
      await expect(order.nth(1)).toContainText('Cris');
      await expect(
        panel(page).getByRole('heading', { name: 'Placar antes da final' }),
      ).toBeVisible();
      await expect(panel(page).getByText('6 perguntas resolvidas', { exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    const podiumScreenshot = info.outputPath('podio-revanche.png');
    await guest.page.screenshot({ path: podiumScreenshot, fullPage: true });
    await info.attach('podio-revanche', { path: podiumScreenshot, contentType: 'image/png' });
    await panel(guest.page).getByRole('button', { name: 'Preparar revanche' }).click();
    await expect(newPage.getByText('Aguardando os jogadores.', { exact: true })).toBeVisible();
    expect(site.app.rooms.registry.all()).toHaveLength(1);
    expect(room.snapshot().members.map((member) => member.profile.nickname)).toEqual([
      'Bruno',
      'Cris',
    ]);
    for (const player of players) await player.audit.verify();
    await audit.verify();
  } finally {
    await nextContext.close();
  }
});

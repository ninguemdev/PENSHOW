import type { Locator, Page } from '@playwright/test';
import { test, expect, type Player } from '../fixtures.ts';
import { observePublicMessages } from '../public-audit.ts';
import type { Site } from '../site.ts';

const panel = (page: Page) => page.getByRole('region', { name: 'Quiz clássico', exact: true });
const members = (page: Page) => page.getByRole('region', { name: 'Pessoas na sala' });
function room(site: Site) {
  const rooms = site.app.rooms.registry.all();
  expect(rooms).toHaveLength(1);
  return rooms[0]!;
}
function game(site: Site) {
  const phase = room(site).snapshot().phase;
  if (phase.status !== 'match' || !phase.game) throw new Error('Partida clássica esperada.');
  return phase.game.state;
}
async function prepareProfile(page: Page, name: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
  await page.getByRole('tabpanel').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}
async function activate(button: Locator, touch: boolean) {
  await expect(button).toBeEnabled();
  if (touch) await button.tap();
  else await button.press('Enter');
}
async function score(page: Page, name: string, points: number, correct: number) {
  const row = page
    .getByRole('table', { name: 'Placar do grupo' })
    .getByRole('row', { name: new RegExp(name) });
  await expect(row.getByRole('cell').nth(0)).toHaveText(String(points));
  await expect(row.getByRole('cell').nth(1)).toHaveText(String(correct));
}

test('perfil, convite, edição, recarga, duas sessões e seis perguntas reais', async ({
  site,
  players,
}, info) => {
  const [host, originalGuest] = players;
  const touch = info.project.use.hasTouch ?? false;
  let guest: Player = originalGuest,
    invite = '';
  const audits = [host.audit, originalGuest.audit];
  const seen = new Set<string>(),
    difficulties: string[] = [];

  await test.step('preparar perfil, criar sala e compartilhar convite sem credenciais', async () => {
    await host.page.goto('/');
    await prepareProfile(host.page, 'Ana');
    await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
    await host.page.getByRole('spinbutton', { name: 'Vagas de jogadores' }).fill('2');
    await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await expect(members(host.page).getByRole('listitem')).toHaveCount(1);
    await expect(host.page.getByRole('button', { name: 'Iniciar quiz clássico' })).toBeDisabled();
    invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
    expect(new URL(invite).origin).toBe(site.origin);
    expect(new URL(invite).search).toBe('');
    expect(new URL(invite).pathname).toMatch(/^\/sala\/[A-HJ-NP-Z2-9]{6}$/);
    await host.page.getByRole('button', { name: 'Copiar convite', exact: true }).click();
    await expect(
      host.page.getByText(/Convite copiado\.|Não foi possível copiar\. Selecione o link/),
    ).toBeVisible();
  });
  await test.step('segunda identidade prepara perfil pelo convite e entra pela interface', async () => {
    await guest.page.goto(invite);
    await prepareProfile(guest.page, 'Bruno');
    await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    for (const player of [host, guest])
      await expect(members(player.page).getByRole('listitem')).toHaveCount(2);
    expect(
      new Set(
        room(site)
          .snapshot()
          .members.map((member) => member.playerId),
      ).size,
    ).toBe(2);
    await expect(guest.page.getByRole('button', { name: 'Iniciar quiz clássico' })).toHaveCount(0);
  });
  await test.step('editar nome/personagem no lobby e aplicar o perfil salvo ao grupo', async () => {
    const previous = room(site).snapshot().members[0]!.profile;
    await host.page.getByRole('link', { name: 'Editar perfil', exact: true }).click();
    await host.page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill('Ana Silva');
    await host.page.getByRole('tabpanel').getByRole('button', { pressed: false }).first().click();
    await host.page.getByRole('button', { name: 'Salvar e continuar' }).click();
    await host.page.getByRole('button', { name: 'Usar meu perfil salvo na sala' }).click();
    for (const player of [host, guest])
      await expect(members(player.page).getByText('Ana Silva', { exact: true })).toBeVisible();
    expect(room(site).snapshot().members[0]!.profile.avatar).not.toEqual(previous.avatar);
  });
  await test.step('conferir diálogo nativo e cancelar saída sem remover jogadores', async () => {
    const leave = host.page.getByRole('button', { name: 'Sair da sala', exact: true });
    await leave.click();
    await expect(host.page.getByRole('dialog', { name: 'Sair desta sala?' })).toBeVisible();
    await expect(host.page.getByRole('button', { name: 'Continuar na sala' })).toBeFocused();
    await host.page.keyboard.press('Escape');
    await expect(host.page.getByRole('dialog')).toHaveCount(0);
    await expect(leave).toBeFocused();
    expect(room(site).snapshot().members).toHaveLength(2);
  });
  await test.step('recarga e outra aba conservam as duas identidades, sem duplicar membros', async () => {
    const ids = room(site)
      .snapshot()
      .members.map((member) => member.playerId);
    await host.page.reload();
    await expect(members(host.page).getByRole('listitem')).toHaveCount(2);
    await expect(members(host.page).getByText('Ana Silva', { exact: true })).toBeVisible();
    const replacement = await guest.context.newPage();
    const audit = observePublicMessages(replacement, site.origin);
    audits.push(audit);
    await replacement.goto(invite);
    await expect(members(replacement).getByRole('listitem')).toHaveCount(2);
    await expect(
      guest.page.getByText(
        'Sua sessão foi aberta em outra aba. Ative aqui somente se quiser voltar para esta aba.',
      ),
    ).toBeVisible();
    expect(
      room(site)
        .snapshot()
        .members.map((member) => member.playerId),
    ).toEqual(ids);
    await guest.page.close();
    guest = { ...guest, page: replacement, audit };
  });
  await test.step('iniciar o protótipo de uma fase e confirmar prontidão/tema', async () => {
    await expect(
      host.page.getByRole('heading', { name: 'Quiz clássico de teste · 1 fase · 6 perguntas' }),
    ).toBeVisible();
    await activate(host.page.getByRole('button', { name: 'Iniciar quiz clássico' }), touch);
    for (const player of [host, guest])
      await expect(
        panel(player.page).getByRole('heading', { name: 'Prepare-se para responder' }),
      ).toBeVisible();
    await Promise.all(
      [host, guest].map((player) =>
        activate(panel(player.page).getByRole('button', { name: 'Estou pronto' }), touch),
      ),
    );
    for (const player of [host, guest])
      await expect(
        panel(player.page).getByRole('heading', { name: 'Escolha do tema' }),
      ).toBeVisible();
    const stage = game(site).stage;
    if (stage.phase !== 'category-selection') throw new Error('Seleção de tema esperada.');
    const hostId = room(site).snapshot().members[0]!.playerId;
    const chooser = stage.offer.chooserPlayerId === hostId ? host : guest;
    const options = panel(chooser.page)
      .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
      .getByRole('button');
    await activate(options.first(), touch);
  });
  const plans = [
    { host: true, guest: true, points: [100, 100], correct: [1, 1] },
    { host: true, guest: false, points: [200, 100], correct: [2, 1] },
    { host: true, guest: null, points: [300, 100], correct: [3, 1] },
    { host: true, guest: true, points: [400, 200], correct: [4, 2] },
    { host: false, guest: false, points: [400, 200], correct: [4, 2] },
    { host: true, guest: false, points: [500, 200], correct: [5, 2] },
  ];
  for (const [index, plan] of plans.entries())
    await test.step(`pergunta ${index + 1}: resposta definitiva, privacidade e pontos oficiais`, async () => {
      for (const player of [host, guest]) {
        await expect(
          panel(player.page).getByText('Leia a pergunta', { exact: true }),
        ).toBeVisible();
        await expect(
          panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
        ).toHaveCount(0);
      }
      for (const player of [host, guest]) {
        await expect(
          panel(player.page).getByRole('group', { name: 'Escolha sua resposta' }),
        ).toBeVisible();
        await expect(
          panel(player.page).getByText(`Fase 1 de 1 · Pergunta ${index + 1} de 6`, { exact: true }),
        ).toBeVisible();
        await expect(
          panel(player.page).getByText('Resposta correta:', { exact: true }),
        ).toHaveCount(0);
        expect(
          await player.page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
      const stage = game(site).stage;
      if (stage.phase !== 'question-open') throw new Error('Pergunta aberta esperada.');
      // Only the test process reads private state to choose known answers. Nothing is exposed to HTTP/UI.
      const prepared = stage.question;
      expect(seen.has(prepared.publicQuestion.questionId)).toBe(false);
      seen.add(prepared.publicQuestion.questionId);
      difficulties.push(prepared.publicQuestion.difficulty);
      expect(
        site.app.questions
          .list()
          .some(
            (question) =>
              question.id === prepared.editorialQuestionId && question.status === 'approved',
          ),
      ).toBe(true);
      const correct = prepared.publicQuestion.options.find(
        (option) => option.optionId === prepared.correctOptionId,
      )!;
      const wrong = prepared.publicQuestion.options.find(
        (option) => option.optionId !== prepared.correctOptionId,
      )!;
      const hostAnswer = panel(host.page).getByRole('button', {
        name: (plan.host ? correct : wrong).text,
        exact: true,
      });
      const guestAnswer = panel(guest.page).getByRole('button', {
        name: (plan.guest ? correct : wrong).text,
        exact: true,
      });
      if (index === 1) {
        const deadline = stage.deadlineAt,
          ids = room(site)
            .snapshot()
            .members.map((member) => member.playerId);
        await activate(hostAnswer, touch);
        await expect(
          panel(host.page).getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
        ).toBeVisible();
        await host.page.reload();
        await expect(
          panel(host.page).getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
        ).toBeVisible();
        await expect(
          panel(host.page)
            .getByRole('group', { name: 'Escolha sua resposta' })
            .getByRole('button')
            .first(),
        ).toBeDisabled();
        const restored = game(site).stage;
        expect(restored.phase).toBe('question-open');
        if (restored.phase === 'question-open') expect(restored.deadlineAt).toBe(deadline);
        expect(
          room(site)
            .snapshot()
            .members.map((member) => member.playerId),
        ).toEqual(ids);
        await activate(guestAnswer, touch);
      } else if (plan.guest === null) {
        await activate(hostAnswer, touch);
        await expect(
          panel(host.page).getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
        ).toBeVisible();
        await expect(
          panel(guest.page).getByRole('button', { name: wrong.text, exact: true }),
        ).toBeEnabled();
      } else await Promise.all([activate(hostAnswer, touch), activate(guestAnswer, touch)]);
      for (const player of [host, guest]) {
        await expect(
          panel(player.page).getByText('Confira a resposta', { exact: true }),
        ).toBeVisible();
        await expect(
          panel(player.page).getByText('Resposta correta:', { exact: true }).locator('..'),
        ).toContainText(correct.text);
        if (prepared.explanation)
          await expect(
            panel(player.page).getByText(prepared.explanation, { exact: true }),
          ).toBeVisible();
        await score(player.page, 'Ana Silva', plan.points[0]!, plan.correct[0]!);
        await score(player.page, 'Bruno', plan.points[1]!, plan.correct[1]!);
      }
      expect(game(site).history).toHaveLength(index + 1);
    });
  await test.step('resultado, conclusão e retorno do grupo ao lobby', async () => {
    for (const player of [host, guest])
      await expect(
        panel(player.page).getByRole('heading', { name: 'Resultado da fase' }),
      ).toBeVisible();
    for (const player of [host, guest]) {
      await expect(
        panel(player.page).getByRole('heading', { name: 'Quiz clássico concluído' }),
      ).toBeVisible();
      await score(player.page, 'Ana Silva', 500, 5);
      await score(player.page, 'Bruno', 200, 2);
      await info.attach(`placar-${player === host ? 'host' : 'guest'}`, {
        body: await player.page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
    await expect(guest.page.getByRole('button', { name: 'Voltar ao lobby' })).toHaveCount(0);
    await activate(host.page.getByRole('button', { name: 'Voltar ao lobby' }), touch);
    for (const player of [host, guest]) {
      await expect(
        player.page.getByText('Aguardando os jogadores.', { exact: true }),
      ).toBeVisible();
      await expect(members(player.page).getByRole('listitem')).toHaveCount(2);
    }
  });
  expect(seen.size).toBe(6);
  expect(difficulties.filter((difficulty) => difficulty === 'easy')).toHaveLength(3);
  expect(difficulties.filter((difficulty) => difficulty === 'medium')).toHaveLength(3);
  for (const audit of audits) await audit.verify();
  for (const audit of [host.audit, guest.audit]) {
    const phases = new Set(
      audit.views.flatMap((view) =>
        view.state.status === 'match' ? [view.state.match.stage.phase] : [],
      ),
    );
    expect([...phases]).toEqual(
      expect.arrayContaining([
        'instructions',
        'category-selection',
        'question-reading',
        'question-open',
        'reveal',
        'round-results',
        'prototype-complete',
      ]),
    );
  }
  await info.attach('resumo', {
    body: Buffer.from(
      JSON.stringify({
        identities: 2,
        uniqueQuestions: seen.size,
        difficulties,
        finalPoints: [500, 200],
        viewsAudited: audits.reduce((count, audit) => count + audit.views.length, 0),
        externalRequests: 0,
        returnedToLobby: true,
      }),
    ),
    contentType: 'application/json',
  });
});

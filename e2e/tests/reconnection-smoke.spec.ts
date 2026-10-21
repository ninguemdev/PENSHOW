import { test, expect } from '../fixtures.ts';
import { QuestionSelection } from '../../apps/server/src/modules/questions/question-selection.ts';
import { observePublicMessages } from '../public-audit.ts';

test('reconexão: janela preservada, sala vazia, retorno, anfitrião e aba substituída', async ({
  site,
  players,
}, info) => {
  const [host, guest] = players;
  for (const [index, player] of players.entries()) {
    await player.page.goto('/');
    await player.page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
    await player.page
      .getByRole('textbox', { name: 'Como você quer ser chamado?' })
      .fill(index === 0 ? 'Ana' : 'Bruno');
    await player.page.getByRole('button', { name: 'Salvar e continuar' }).click();
  }
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Iniciar quiz clássico', exact: true }).click();
  for (const player of players)
    await player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  const room = site.app.rooms.registry.all()[0]!;
  function game() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error();
    return phase.game;
  }
  const offer = game().state.stage;
  if (offer.phase !== 'category-selection') throw new Error();
  const chooser =
    offer.offer.chooserPlayerId === room.snapshot().members[0]!.playerId ? host : guest;
  await chooser.page
    .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
    .getByRole('button')
    .first()
    .click();
  await expect(guest.page.getByRole('group', { name: 'Escolha sua resposta' })).toBeVisible();
  const open = game().state.stage;
  if (open.phase !== 'question-open') throw new Error();
  const correct = open.question.publicQuestion.options.find(
    (option) => option.optionId === open.question.correctOptionId,
  )!;
  await guest.page.getByRole('button', { name: correct.text, exact: true }).click();
  await expect(
    guest.page.getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
  ).toBeVisible();
  await guest.page.reload();
  await expect(
    guest.page.getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
  ).toBeVisible();
  expect(game().state.stage).toMatchObject({
    deadlineAt: open.deadlineAt,
    answers: [{ playerId: room.snapshot().members[1]!.playerId }],
  });
  const hostId = room.snapshot().members[0]!.playerId,
    guestId = room.snapshot().members[1]!.playerId;
  await host.page.goto('about:blank');
  await guest.page.goto('about:blank');
  await expect.poll(() => room.snapshot().emptySince).not.toBeNull();
  await expect.poll(() => game().suspended, { timeout: 30000 }).toBe(true);
  expect(game().state.history).toHaveLength(1);
  expect(QuestionSelection.resume(game().selection, site.app.runtime).history()).toHaveLength(1);
  expect(game().state.scoreboard.find((score) => score.playerId === guestId)!.points).toBe(100);
  await guest.page.goto(invite);
  await expect(
    guest.page.getByText('As alternativas serão liberadas em instantes.', { exact: true }),
  ).toBeVisible();
  expect(game().suspended).toBeUndefined();
  await expect.poll(() => room.snapshot().hostPlayerId).toBe(guestId);
  await expect(guest.page.getByRole('group', { name: 'Escolha sua resposta' })).toBeVisible();
  const second = game().state.stage;
  if (second.phase !== 'question-open') throw new Error();
  const secondCorrect = second.question.publicQuestion.options.find(
    (option) => option.optionId === second.question.correctOptionId,
  )!;
  await guest.page.getByRole('button', { name: secondCorrect.text, exact: true }).click();
  const replacement = await guest.context.newPage();
  const audit = observePublicMessages(replacement, site.origin);
  await replacement.goto(invite);
  await expect(
    guest.page.getByText(
      'Sua sessão foi aberta em outra aba. Ative aqui somente se quiser voltar para esta aba.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    replacement.getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
  ).toBeVisible();
  expect(game().state.stage).toMatchObject({
    deadlineAt: second.deadlineAt,
    answers: [{ playerId: guestId }],
  });
  await expect(
    replacement.getByRole('group', { name: 'Escolha sua resposta' }).getByRole('button').first(),
  ).toBeDisabled();
  await host.page.goto(invite);
  await expect(host.page.getByRole('group', { name: 'Escolha sua resposta' })).toBeVisible();
  expect(room.snapshot().hostPlayerId).toBe(guestId);
  expect(room.snapshot().members.map((member) => member.playerId)).toEqual([hostId, guestId]);
  await host.page.getByRole('button', { name: secondCorrect.text, exact: true }).click();
  await expect(replacement.getByText('Confira a resposta', { exact: true })).toBeVisible();
  expect(game().state.history).toHaveLength(2);
  expect(game().state.scoreboard.map((score) => score.points)).toEqual([100, 200]);
  const screenshot = info.outputPath('reconexao.png');
  await replacement.screenshot({ path: screenshot, fullPage: true });
  await info.attach('reconexao', { path: screenshot, contentType: 'image/png' });
  for (const player of players) await player.audit.verify();
  await audit.verify();
});

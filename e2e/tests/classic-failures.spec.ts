import { test, expect } from '../classic-fixture.ts';
import { createClassicGroup } from '../classic-group.ts';
import { observePublicMessages } from '../public-audit.ts';
import { QuestionSelection } from '../../apps/server/src/modules/questions/question-selection.ts';

test.use({ roundResultsMs: 2000 });

test('modo completo: anfitrião cai e retorna sem renovar pergunta, placar ou plano', async ({
  site,
  players,
}) => {
  const g = await createClassicGroup(site, players, [4, 3, 2, 1]);
  await g.start();
  const initial = g.state();
  await g.prepareRound();
  await g.answer(g.guest, true);
  const open = g.state().stage;
  if (open.phase !== 'question-open') throw new Error('Pergunta esperada.');
  await g.host.page.goto('about:blank');
  await expect.poll(() => g.room.snapshot().hostPlayerId).toBe(g.playerId(g.guest));
  await g.host.page.goto(g.invite);
  await expect(
    g.host.page.getByRole('group', { name: 'Escolha sua resposta', exact: true }),
  ).toBeVisible();
  expect(g.state().roster.matchId).toBe(initial.roster.matchId);
  expect(g.state().rounds).toEqual(initial.rounds);
  expect(g.state().finalRound).toEqual(initial.finalRound);
  expect(g.state().stage).toMatchObject({
    phase: 'question-open',
    deadlineAt: open.deadlineAt,
    answers: open.answers,
  });
  await g.answer(g.host, false);
  expect(g.state().history).toHaveLength(1);
  expect(g.state().scoreboard.find((score) => score.playerId === g.playerId(g.guest))?.points).toBe(
    100,
  );
  expect(g.room.snapshot().hostPlayerId).toBe(g.playerId(g.guest));
  for (const player of players) await player.audit.verify();
});

test('modo completo: outra aba substitui o controle e recupera a resposta definitiva', async ({
  site,
  players,
}) => {
  const g = await createClassicGroup(site, players, [4, 3, 2, 1]);
  await g.start();
  const initial = g.state();
  await g.prepareRound();
  await g.answer(g.guest, true);
  const open = g.state().stage;
  if (open.phase !== 'question-open') throw new Error('Pergunta esperada.');
  const replacement = await g.guest.context.newPage();
  const audit = observePublicMessages(replacement, site.origin);
  await replacement.goto(g.invite);
  await expect(
    replacement.getByText('Resposta registrada. Aguarde a revelação.', { exact: true }),
  ).toBeVisible();
  await expect(g.guest.page.getByText(/outra aba|outra conexão/)).toBeVisible();
  const options = replacement
    .getByRole('group', { name: 'Escolha sua resposta', exact: true })
    .getByRole('button');
  for (const option of await options.all()) await expect(option).toBeDisabled();
  expect(g.state().stage).toMatchObject({
    phase: 'question-open',
    deadlineAt: open.deadlineAt,
    answers: open.answers,
  });
  expect(g.state().rounds).toEqual(initial.rounds);
  // The replaced page stops receiving views; wait on the active page and the actual commit.
  const option = open.question.publicQuestion.options.find(
    (option) => option.optionId !== open.question.correctOptionId,
  )!;
  await g.host.page.getByRole('button', { name: option.text, exact: true }).click();
  await expect.poll(() => g.state().history.length).toBe(1);
  expect(g.state().history[0]!.correctPlayerIds).toEqual([g.playerId(g.guest)]);
  await audit.verify();
  for (const player of players) await player.audit.verify();
});

test('modo completo: sala vazia espera entre fases e retoma sem consumir conteúdo', async ({
  site,
  players,
}) => {
  const g = await createClassicGroup(site, players, [4, 3, 2, 1]);
  await g.start();
  const initial = g.state();
  await g.prepareRound();
  for (let index = 0; index < 6; index++) {
    await g.answer(g.host, true);
    await g.answer(g.guest, false);
    expect(g.state().history).toHaveLength(index + 1);
    if (index < 5) await expect.poll(() => g.state().stage.phase).toBe('question-open');
  }
  await expect(
    g.host.page.getByRole('heading', { name: 'Resultado da fase', exact: true }),
  ).toBeVisible();
  const before = g.game();
  const used = QuestionSelection.resume(before.selection, site.app.runtime).history();
  await Promise.all(players.map((player) => player.page.goto('about:blank')));
  await expect.poll(() => g.game().suspended).toBe(true);
  expect(g.state().stage.phase).toBe('round-results');
  expect(g.state().roundIndex).toBe(0);
  expect(g.state().history).toEqual(before.state.history);
  expect(QuestionSelection.resume(g.game().selection, site.app.runtime).history()).toEqual(used);
  await g.guest.page.goto(g.invite);
  await expect(
    g.guest.page.getByRole('button', { name: 'Estou pronto', exact: true }),
  ).toBeVisible();
  await g.host.page.goto(g.invite);
  await expect(
    g.host.page.getByRole('button', { name: 'Estou pronto', exact: true }),
  ).toBeVisible();
  expect(g.game().suspended).toBeUndefined();
  expect(g.state().roundIndex).toBe(1);
  expect(g.state().scoreboard).toEqual(before.state.scoreboard);
  expect(g.state().rounds).toEqual(initial.rounds);
  expect(g.state().finalRound).toEqual(initial.finalRound);
  expect(QuestionSelection.resume(g.game().selection, site.app.runtime).history()).toEqual(used);
  for (const player of players) await player.audit.verify();
});

import { expect, type Player } from './fixtures.ts';
import type { Site } from './site.ts';

export async function createClassicGroup(
  site: Site,
  players: [Player, Player],
  choices?: readonly number[],
) {
  const [host, guest] = players;
  async function profile(player: Player, name: string, path: string) {
    await player.page.goto(path);
    await player.page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
    await player.page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(name);
    await player.page.getByRole('button', { name: 'Salvar e continuar' }).click();
  }
  await profile(host, 'Ana', '/');
  await host.page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await host.page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(
    host.page.getByRole('button', { name: 'Iniciar modo clássico', exact: true }),
  ).toBeDisabled();
  const invite = await host.page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await profile(guest, 'Bia', invite);
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  const room = site.app.rooms.registry.all()[0]!;
  expect(room.snapshot().settings.format).toBe('classic');
  if (choices) {
    const pending = [...choices],
      random = site.app.runtime.random;
    site.app.runtime.random = { integer: (max) => pending.shift() ?? random.integer(max) };
  }
  function game() {
    const phase = room.snapshot().phase;
    if (phase.status !== 'match' || !phase.game) throw new Error('Partida esperada.');
    return phase.game;
  }
  const state = () => game().state;
  async function synchronized() {
    const version = room.snapshot().stateVersion;
    for (const player of players)
      await expect
        .poll(() => player.audit.views.at(-1)?.stateVersion)
        .toBeGreaterThanOrEqual(version);
  }
  async function command(action: () => Promise<unknown>) {
    const version = room.snapshot().stateVersion;
    await action();
    await expect
      .poll(() => room.snapshot().stateVersion, { intervals: [25, 50, 100] })
      .toBeGreaterThan(version);
    await synchronized();
  }
  async function advance(revision = state().revision) {
    await expect
      .poll(() => state().revision, { intervals: [50, 100, 250] })
      .toBeGreaterThan(revision);
    await synchronized();
  }
  async function start() {
    await command(() =>
      host.page.getByRole('button', { name: 'Iniciar modo clássico', exact: true }).click(),
    );
  }
  async function prepareRound() {
    for (const player of players)
      await command(() =>
        player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click(),
      );
    const stage = state().stage;
    if (stage.phase !== 'category-selection') throw new Error('Escolha de tema esperada.');
    const chooser =
      stage.offer.chooserPlayerId === room.snapshot().members[0]!.playerId ? host : guest;
    await command(() =>
      chooser.page
        .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
        .getByRole('button')
        .first()
        .click(),
    );
  }
  const playerId = (player: Player) => player.audit.views.at(-1)!.viewerId;
  async function answer(player: Player, correct: boolean) {
    await expect(
      player.page.getByRole('group', { name: 'Escolha sua resposta', exact: true }),
    ).toBeVisible();
    const stage = state().final?.stage ?? state().stage;
    if (stage.phase !== 'question-open' && stage.phase !== 'final-question-open')
      throw new Error('Resposta esperada.');
    const option = stage.question.publicQuestion.options.find((option) =>
      correct
        ? option.optionId === stage.question.correctOptionId
        : option.optionId !== stage.question.correctOptionId,
    )!;
    await command(() =>
      player.page
        .getByRole('group', { name: 'Escolha sua resposta', exact: true })
        .getByRole('button', { name: option.text, exact: true })
        .click(),
    );
  }
  return {
    host,
    guest,
    invite,
    room,
    game,
    state,
    synchronized,
    command,
    advance,
    start,
    prepareRound,
    answer,
    playerId,
  };
}

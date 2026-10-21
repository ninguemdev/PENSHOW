import { test, expect } from '../sound-fixture.ts';
import { createClassicGroup } from '../classic-group.ts';
import { audioState, observeAudio } from '../sound-audit.ts';
import { currentPressureTurn } from '../../apps/server/src/modules/matches/match.domain.ts';
import { auditAccessibility, expectReflow } from '../accessibility.ts';

test('som: partida real, seis avisos e reconexão sem repetir explosão ou vitória', async ({
  site,
  players,
}, info) => {
  for (const player of players) await observeAudio(player.context);
  const g = await createClassicGroup(site, players, [0, 1, 0, 1]);
  const { host, guest, state, command, advance } = g;
  expect((await audioState(host.page)).states).toEqual([]);
  await host.page.getByRole('button', { name: 'Ativar som', exact: true }).click();
  await expect(host.page.getByRole('button', { name: 'Silenciar som', exact: true })).toBeVisible();
  expect((await audioState(host.page)).states).toEqual(['running']);
  await host.page.getByRole('slider', { name: /Volume do som/ }).fill('55');
  await auditAccessibility(host.page, info, 'controles-som');
  await expectReflow(host.page);
  await g.start();
  let wrong = false,
    reconnected = false;
  for (let guard = 0; guard < 150 && state().final?.stage.phase !== 'podium'; guard++) {
    await g.synchronized();
    const current = state(),
      stage = current.final?.stage ?? current.stage;
    if (stage.phase === 'instructions' || stage.phase === 'final-instructions') {
      for (const player of players)
        await command(() =>
          player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click(),
        );
    } else if (stage.phase === 'category-selection') {
      const chooser = stage.offer.chooserPlayerId === g.playerId(host) ? host : guest;
      await command(() =>
        chooser.page
          .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
          .getByRole('button')
          .first()
          .click(),
      );
    } else if (stage.phase === 'wager-selection') {
      for (const player of players)
        await command(() =>
          player.page.getByRole('button', { name: 'Apostar 0 pontos', exact: true }).click(),
        );
      await advance();
    } else if (stage.phase === 'question-open' || stage.phase === 'final-question-open') {
      const turn = currentPressureTurn(current);
      const respondents =
        stage.phase === 'final-question-open'
          ? [host]
          : players.filter((player) => !turn || turn.playerId === g.playerId(player));
      for (const player of respondents) {
        const correct =
          player === host
            ? wrong || stage.phase === 'final-question-open'
            : current.rounds[current.roundIndex]?.mode === 'theft';
        if (player === host && !wrong) wrong = true;
        const option = stage.question.publicQuestion.options.find(
          (option) => (option.optionId === stage.question.correctOptionId) === correct,
        )!;
        await command(() =>
          player.page
            .getByRole('group', { name: 'Escolha sua resposta', exact: true })
            .getByRole('button', { name: option.text, exact: true })
            .click(),
        );
      }
    } else if (
      stage.phase === 'theft-target-selection' ||
      stage.phase === 'final-target-selection'
    ) {
      await command(() =>
        host.page
          .getByRole('group', {
            name:
              stage.phase === 'theft-target-selection'
                ? 'Escolha do alvo do roubo'
                : 'Escolha o alvo da final',
            exact: true,
          })
          .getByRole('button')
          .first()
          .click(),
      );
    } else {
      const projected = host.audit.views.at(-1);
      if (
        projected?.state.status === 'match' &&
        projected.state.match.pressureTurn?.outcome === 'exploded' &&
        !reconnected
      ) {
        await expect(
          host.page.getByText('Explosão! O jogador continua na partida, sem perder vidas.', {
            exact: true,
          }),
        ).toBeVisible();
        const before = (await audioState(host.page)).starts.length;
        const member = g.room
          .snapshot()
          .members.find((member) => member.playerId === g.playerId(host))!;
        if (member.connection.status !== 'connected') throw new Error('Conexão esperada.');
        const connectionId = member.connection.connectionId;
        site.app.realtime.sockets.sockets.get(connectionId)!.conn.close();
        await expect
          .poll(() => {
            const connection = g.room
              .snapshot()
              .members.find((member) => member.playerId === g.playerId(host))?.connection;
            return connection?.status === 'connected' && connection.connectionId !== connectionId;
          })
          .toBe(true);
        await g.synchronized();
        expect((await audioState(host.page)).starts).toHaveLength(before);
        reconnected = true;
      }
      await advance(current.revision);
    }
  }
  expect(state().final?.stage.phase).toBe('podium');
  await expect(host.page.getByText('Ana venceu a final!', { exact: true })).toBeVisible();
  const audit = await audioState(host.page);
  const count = (frequency: number) =>
    audit.starts.filter((tone) => tone.frequency === frequency).length;
  expect(count(392)).toBe(5);
  expect(count(246.94)).toBe(1);
  expect(count(110)).toBe(2);
  expect(count(220)).toBe(4);
  expect(count(1046.5)).toBe(1);
  expect(count(659.25)).toBeGreaterThan(0);
  expect(reconnected).toBe(true);
  expect((await audioState(guest.page)).states).toEqual([]);
  await info.attach('audio-partida.json', {
    body: JSON.stringify(audit, null, 2),
    contentType: 'application/json',
  });
  await host.page.reload();
  await expect(
    host.page.getByRole('heading', { name: 'Pódio da partida', exact: true }),
  ).toBeVisible();
  expect((await audioState(host.page)).states).toEqual([]);
  await host.page.getByRole('button', { name: 'Ativar som', exact: true }).click();
  await expect(host.page.getByRole('button', { name: 'Silenciar som', exact: true })).toBeVisible();
  expect((await audioState(host.page)).starts).toEqual([]);
  await expect(host.page.getByRole('slider', { name: /Volume do som/ })).toHaveValue('55');
  for (const player of players) await player.audit.verify();
});

test('som: sem Web Audio mantém resposta, prazo, silêncio e preferência funcionais', async ({
  site,
  players,
}) => {
  await players[1].context.addInitScript(() =>
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }),
  );
  const g = await createClassicGroup(site, players, [4, 3, 2, 1]);
  await g.guest.page.getByRole('button', { name: 'Ativar som', exact: true }).click();
  await expect(g.guest.page.getByText(/Áudio indisponível/)).toBeVisible();
  await g.start();
  await g.prepareRound();
  await expect(
    g.host.page.getByRole('group', { name: 'Escolha sua resposta', exact: true }),
  ).toBeVisible();
  const open = g.state().stage;
  if (open.phase !== 'question-open') throw new Error('Pergunta esperada.');
  await g.guest.page.getByRole('slider', { name: /Volume do som/ }).fill('20');
  expect(g.state().stage).toMatchObject({ phase: 'question-open', deadlineAt: open.deadlineAt });
  await g.answer(g.guest, false);
  await g.answer(g.host, true);
  await expect(g.guest.page.getByText('Confira a resposta', { exact: true })).toBeVisible();
  await g.guest.page.reload();
  await expect(g.guest.page.getByRole('slider', { name: /Volume do som/ })).toHaveValue('20');
  for (const player of players) await player.audit.verify();
});

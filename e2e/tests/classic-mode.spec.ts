import { test, expect } from '../classic-fixture.ts';
import { createClassicGroup } from '../classic-group.ts';
import { currentPressureTurn } from '../../apps/server/src/modules/matches/match.domain.ts';

for (const scenario of [
  {
    name: 'aposta na abertura e dinamite',
    choices: [0, 1, 0, 1],
    modes: ['wager', 'theft', 'pressure', 'speed'],
  },
  {
    name: 'quiz simples, velocidade e aposta com saldo',
    choices: [4, 3, 2, 1],
    modes: ['classic', 'speed', 'wager', 'theft'],
  },
])
  test(`modo padrão: ${scenario.name}, final e revanche`, async ({ site, players }) => {
    test.setTimeout(180_000);
    const { host, guest, room, state, synchronized, advance, command, start } =
      await createClassicGroup(site, players, scenario.choices);
    await start();
    const initial = state();
    expect(initial.rules.parameters.timings.readingMs).toBe(150);
    expect(initial.rounds).toHaveLength(4);
    expect(initial.rounds.map((round) => round.mode)).toEqual(scenario.modes);
    expect(new Set(initial.rounds.map((round) => round.mode)).size).toBe(4);
    expect(initial.finalRound?.index).toBe(5);
    const originalPlan = [...initial.rounds, initial.finalRound];
    const hostId = room.snapshot().hostPlayerId;
    const guestId = room.snapshot().members.find((member) => member.playerId !== hostId)!.playerId;
    const seen = new Set<string>();
    let reloaded = false;
    for (let guard = 0; guard < 250 && state().final?.stage.phase !== 'podium'; guard++) {
      await synchronized();
      const current = state(),
        stage = current.final?.stage ?? current.stage;
      if (stage.phase === 'podium') break;
      expect([...current.rounds, current.finalRound]).toEqual(originalPlan);
      for (const player of players)
        await expect(
          player.page.getByRole('list', { name: 'Ordem das fases' }).getByRole('listitem'),
        ).toHaveCount(5);
      if (stage.phase === 'instructions' || stage.phase === 'final-instructions') {
        if (!reloaded && current.roundIndex > 0) {
          await guest.page.reload();
          await expect(guest.page.getByText('Sessão conectada.', { exact: true })).toBeVisible();
          await expect(
            guest.page.getByRole('button', { name: 'Estou pronto', exact: true }),
          ).toBeEnabled();
          expect(state().roster.matchId).toBe(initial.roster.matchId);
          reloaded = true;
        }
        for (const player of players) {
          await command(() =>
            player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click(),
          );
          await synchronized();
        }
      } else if (stage.phase === 'category-selection') {
        const chooser = stage.offer.chooserPlayerId === hostId ? host : guest;
        await command(() =>
          chooser.page
            .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
            .getByRole('button')
            .first()
            .click(),
        );
        await synchronized();
      } else if (stage.phase === 'wager-selection') {
        for (const player of players) {
          const id = player === host ? hostId : guestId;
          const balance = state().scoreboard.find((score) => score.playerId === id)!.points;
          const amount = player === host && balance >= 50 ? 50 : 0;
          await command(() =>
            player.page
              .getByRole('button', { name: 'Apostar ' + amount + ' pontos', exact: true })
              .click(),
          );
          expect(state().wagers.find((wager) => wager.playerId === id)?.amount).toBe(amount);
        }
        expect(state().scoreboard).toEqual(current.scoreboard);
        await advance();
      } else if (stage.phase === 'question-open' || stage.phase === 'final-question-open') {
        const question = stage.question;
        expect(seen.has(question.publicQuestion.questionId)).toBe(false);
        seen.add(question.publicQuestion.questionId);
        const turn = currentPressureTurn(current);
        const respondents =
          stage.phase === 'final-question-open'
            ? [host]
            : players.filter(
                (player) => !turn || turn.playerId === (player === host ? hostId : guestId),
              );
        for (const player of respondents) {
          const option = question.publicQuestion.options.find((option) =>
            player === host ||
            (current.stage.phase === 'question-open' &&
              current.rounds[current.roundIndex]?.mode === 'theft' &&
              current.history.filter(
                (record) => record.context.roundId === current.rounds[current.roundIndex]!.roundId,
              ).length === 0)
              ? option.optionId === question.correctOptionId
              : option.optionId !== question.correctOptionId,
          )!;
          await command(() =>
            player.page
              .getByRole('group', { name: 'Escolha sua resposta', exact: true })
              .getByRole('button', { name: option.text, exact: true })
              .click(),
          );
          await synchronized();
        }
      } else if (stage.phase === 'theft-target-selection') {
        const total = current.scoreboard.reduce((sum, score) => sum + score.points, 0);
        await command(() => host.page.getByRole('button', { name: /^Roubar de Bia/ }).click());
        const settled = state().stage;
        if (settled.phase !== 'reveal') throw new Error('Revelação esperada.');
        expect(settled.theftResult).toMatchObject({
          attackerPlayerId: hostId,
          targetPlayerId: guestId,
          amount: 100,
        });
        expect(state().scoreboard.reduce((sum, score) => sum + score.points, 0)).toBe(total);
        await synchronized();
      } else if (stage.phase === 'final-target-selection') {
        const total = current.final!.finalists.reduce((sum, player) => sum + player.lives, 0);
        const count = current.final!.history.length;
        await command(() => host.page.getByRole('button', { name: /^Atacar Bia/ }).click());
        expect(state().final!.history).toHaveLength(count + 1);
        expect(state().final!.finalists.reduce((sum, player) => sum + player.lives, 0)).toBe(
          total - 1,
        );
        await synchronized();
      } else await advance(current.revision);
    }
    expect(state().final?.stage.phase).toBe('podium');
    expect(reloaded).toBe(true);
    expect(
      state()
        .history.filter(
          (record) =>
            record.context.roundId ===
            initial.rounds.find((round) => round.mode === 'theft')!.roundId,
        )
        .some((record) => record.effects.some((effect) => effect.reason === 'theft')),
    ).toBe(true);
    for (const player of players) {
      await expect(
        player.page.getByRole('heading', { name: 'Pódio da partida', exact: true }),
      ).toBeVisible();
      await expect(player.page.getByText('Ana venceu a final!', { exact: true })).toBeVisible();
      await expect(
        player.page.getByRole('list', { name: 'Classificação final' }).getByRole('listitem'),
      ).toHaveCount(2);
    }
    await command(() =>
      host.page.getByRole('button', { name: 'Preparar revanche', exact: true }).click(),
    );
    await synchronized();
    await start();
    await synchronized();
    expect(state().roster.matchId).not.toBe(initial.roster.matchId);
    expect(state().scoreboard.every((score) => score.points === 0)).toBe(true);
    for (const player of players) await player.audit.verify();
  });

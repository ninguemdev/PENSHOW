import { test, expect } from '../accessibility-fixture.ts';
import { createClassicGroup } from '../classic-group.ts';
import { auditAccessibility, activateWithKeyboard, expectReflow } from '../accessibility.ts';
import { currentPressureTurn } from '../../apps/server/src/modules/matches/match.domain.ts';

test('acessibilidade: teclado, textos longos, movimento reduzido e alvos até o pódio', async ({
  site,
  players,
}, info) => {
  test.setTimeout(180_000);
  for (const player of players) await player.page.emulateMedia({ reducedMotion: 'reduce' });
  const group = await createClassicGroup(site, players, [0, 1, 0, 1]);
  const { host, guest, state, command, advance } = group;
  await auditAccessibility(host.page, info, 'lobby');
  await command(() =>
    activateWithKeyboard(
      host.page,
      host.page.getByRole('button', { name: 'Iniciar modo clássico', exact: true }),
    ),
  );
  const scanned = new Set<string>();
  for (let guard = 0; guard < 130 && state().final?.stage.phase !== 'podium'; guard++) {
    await group.synchronized();
    const current = state(),
      stage = current.final?.stage ?? current.stage;
    const key = stage.phase;
    if (
      !scanned.has(key) &&
      [
        'instructions',
        'category-selection',
        'wager-selection',
        'question-open',
        'theft-target-selection',
        'final-instructions',
        'final-question-open',
        'final-target-selection',
        'final-resolution',
      ].includes(key)
    ) {
      // All review windows are real server deadlines; no public view or score is patched.
      await auditAccessibility(host.page, info, key);
      await expectReflow(host.page);
      if (
        key === 'theft-target-selection' ||
        key === 'final-target-selection' ||
        key === 'final-resolution'
      ) {
        await info.attach(`${key}.png`, {
          body: await host.page.screenshot({ path: info.outputPath(`${key}.png`) }),
          contentType: 'image/png',
        });
        if (key === 'final-resolution')
          await expect(
            host.page.getByText('Pergunta encerrada. Nenhuma outra resposta será avaliada.', {
              exact: true,
            }),
          ).toBeInViewport({ ratio: 1 });
        else {
          const label =
            key === 'theft-target-selection'
              ? 'Escolha do alvo do roubo'
              : 'Escolha o alvo da final';
          await expect(host.page.getByRole('group', { name: label, exact: true })).toBeInViewport({
            ratio: 1,
          });
        }
      }
      scanned.add(key);
    }
    if (stage.phase === 'instructions' || stage.phase === 'final-instructions') {
      if (stage.phase === 'final-instructions')
        await expect(host.page.locator('.final-allocations li').first()).toHaveCSS(
          'animation-name',
          'none',
        );
      for (const player of players)
        await command(() =>
          activateWithKeyboard(
            player.page,
            player.page.getByRole('button', { name: 'Estou pronto', exact: true }),
          ),
        );
    } else if (stage.phase === 'category-selection') {
      const chooser = stage.offer.chooserPlayerId === group.playerId(host) ? host : guest;
      await command(() =>
        activateWithKeyboard(
          chooser.page,
          chooser.page
            .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
            .getByRole('button')
            .first(),
        ),
      );
    } else if (stage.phase === 'wager-selection') {
      for (const player of players)
        await command(() =>
          activateWithKeyboard(
            player.page,
            player.page.getByRole('button', { name: 'Apostar 0 pontos', exact: true }),
          ),
        );
      // Submitted wagers remain private until the normal server deadline.
      await advance();
    } else if (stage.phase === 'question-open' || stage.phase === 'final-question-open') {
      const turn = currentPressureTurn(current);
      const respondents =
        stage.phase === 'final-question-open'
          ? [host]
          : players.filter((player) => !turn || turn.playerId === group.playerId(player));
      for (const player of respondents) {
        const options = stage.question.publicQuestion.options;
        const index = options.findIndex((option) =>
          player === host || current.rounds[current.roundIndex]?.mode === 'theft'
            ? option.optionId === stage.question.correctOptionId
            : option.optionId !== stage.question.correctOptionId,
        );
        const heading = player.page.locator('.match-stage .question-prompt');
        await expect(heading).toBeFocused();
        if (!scanned.has('long-options') && player === host) {
          await player.page
            .getByRole('group', { name: 'Escolha sua resposta', exact: true })
            .getByRole('button')
            .last()
            .scrollIntoViewIfNeeded();
          const timer = await player.page.getByRole('timer').boundingBox();
          expect(timer!.y).toBeGreaterThanOrEqual(0);
          expect(timer!.y + timer!.height).toBeLessThan(player.page.viewportSize()!.height);
          await info.attach('alternativas-longas.png', {
            body: await player.page.screenshot(),
            contentType: 'image/png',
          });
          scanned.add('long-options');
        }
        await command(() => player.page.keyboard.press(String(index + 1)));
        if (
          !scanned.has('confirmation') &&
          player === host &&
          stage.phase === 'question-open' &&
          !turn
        ) {
          const confirmation = player.page.locator('.question-feedback .answer-status');
          await expect(confirmation).toHaveText('Resposta registrada. Aguarde a revelação.');
          await expect(confirmation).toBeInViewport({ ratio: 1 });
          scanned.add('confirmation');
        }
      }
    } else if (
      stage.phase === 'theft-target-selection' ||
      stage.phase === 'final-target-selection'
    ) {
      const label =
        stage.phase === 'theft-target-selection'
          ? 'Escolha do alvo do roubo'
          : 'Escolha o alvo da final';
      await command(() =>
        activateWithKeyboard(
          host.page,
          host.page.getByRole('group', { name: label, exact: true }).getByRole('button').first(),
        ),
      );
    } else await advance(current.revision);
  }
  expect(state().final?.stage.phase).toBe('podium');
  await auditAccessibility(host.page, info, 'podio');
  for (const phase of [
    'wager-selection',
    'theft-target-selection',
    'final-target-selection',
    'final-resolution',
  ])
    expect(scanned.has(phase)).toBe(true);
});

test('acessibilidade: retrato, paisagem, tablet, texto ampliado, diálogo e conexão lenta', async ({
  site,
  players,
}, info) => {
  const group = await createClassicGroup(site, players, [4, 3, 2, 1]);
  const page = group.host.page;
  const sizes = [
    { width: 320, height: 640 },
    { width: 780, height: 360 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expectReflow(page);
    await auditAccessibility(page, info, `ampliado-${size.width}`);
    await info.attach(`ampliado-${size.width}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
  await activateWithKeyboard(page, page.getByRole('button', { name: 'Sair da sala', exact: true }));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await auditAccessibility(page, info, 'dialogo');
  for (let count = 0; count < 6; count++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair da sala', exact: true })).toBeFocused();
  const cdp = await group.host.context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: 128 * 1024,
    uploadThroughput: 64 * 1024,
  });
  await page.reload();
  await expect(page.getByText('Sessão conectada.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Iniciar modo clássico', exact: true }),
  ).toBeEnabled();
  await expectReflow(page);
  await cdp.detach();
  await activateWithKeyboard(page, page.getByRole('link', { name: 'Meu perfil', exact: true }));
  await page.setViewportSize({ width: 320, height: 320 });
  const nickname = page.getByRole('textbox', { name: 'Como você quer ser chamado?' });
  await nickname.focus();
  await page.keyboard.press('End');
  await page.keyboard.type(' celular');
  await expect(nickname).toHaveValue('Ana celular');
  await expectReflow(page);
  await activateWithKeyboard(
    page,
    page.getByRole('button', { name: 'Salvar e continuar', exact: true }),
  );
  await expect(page.getByText('Ana celular', { exact: true })).toBeVisible();
});

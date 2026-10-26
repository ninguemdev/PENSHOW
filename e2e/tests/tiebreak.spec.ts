import type { Page } from '@playwright/test';
import { test as base, expect } from '../fixtures.ts';
import { createSite } from '../site.ts';
import { auditAccessibility, expectReflow } from '../accessibility.ts';
import {
  prototypeParametersSchema,
  PROTOTYPE_PARAMETERS,
} from '../../apps/server/src/modules/scoring/match-rules.ts';

const test = base.extend({
  // Playwright discovers fixture dependencies from this required destructured argument.
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const parameters = prototypeParametersSchema.parse(PROTOTYPE_PARAMETERS);
    parameters.timings.readingMs = 150;
    parameters.timings.transitionMs = 50;
    parameters.timings.roundResultsMs = 150;
    parameters.final.responseMs = 400;
    parameters.final.revealMs = 100;
    parameters.classic.revealMs = 150;
    const site = await createSite({ matchParameters: parameters });
    try {
      await use(site);
    } finally {
      await site.close();
    }
  },
});
async function profile(page: Page, nickname: string) {
  await page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill(nickname);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}
test('desempate: tiro, pergunta, recuperação, reconexão, eliminação e pódio', async ({
  site,
  players,
}, info) => {
  test.setTimeout(180000);
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
    if (phase.status !== 'match' || !phase.game) throw Error('Partida esperada');
    return phase.game.state;
  }
  function tie() {
    const stage = state().final?.stage;
    if (stage?.phase !== 'final-tiebreak') throw Error('Arena esperada');
    return stage.tiebreak;
  }
  await expect(host.page.getByRole('heading', { name: 'Escolha do tema' })).toBeVisible();
  const stage = state().stage;
  if (stage.phase !== 'category-selection') throw Error();
  const chooser =
    stage.offer.chooserPlayerId === room.snapshot().members[0]!.playerId ? host : guest;
  await chooser.page
    .getByRole('group', { name: 'Escolha um dos temas abaixo.' })
    .getByRole('button')
    .first()
    .click();
  for (let i = 0; i < 6; i++) {
    await expect.poll(() => state().stage.phase).toBe('question-open');
    const open = state().stage;
    if (open.phase !== 'question-open') throw Error();
    const correct = open.question.publicQuestion.options.find(
      (o) => o.optionId === open.question.correctOptionId,
    )!.text;
    for (const player of players)
      await player.page
        .getByRole('group', { name: 'Escolha sua resposta' })
        .getByRole('button', { name: correct, exact: true })
        .click();
    await expect.poll(() => state().history.length).toBe(i + 1);
  }
  await host.page.getByRole('button', { name: 'Iniciar final de teste' }).click();
  for (const player of players)
    await player.page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  // D06 assigns five lives to both; five real final deadlines produce the simultaneous elimination.
  await expect(host.page.getByRole('heading', { name: 'Prepare-se para o combate' })).toBeVisible();
  expect(state().final!.finalists.map((f) => f.lives)).toEqual([0, 0]);
  expect(tie().combat.fighters.map((f) => f.lives)).toEqual([3, 3]);
  await auditAccessibility(host.page, info, 'combate-instrucoes');
  for (const player of players)
    await player.page.getByRole('button', { name: 'Estou pronto para o combate' }).click();
  await expect(host.page.getByRole('heading', { name: 'Combate em andamento' })).toBeVisible();
  await auditAccessibility(host.page, info, 'combate-arena');
  await expectReflow(host.page);
  const hostId = room.snapshot().members[0]!.playerId,
    guestId = room.snapshot().members[1]!.playerId;
  const firstX = tie().combat.fighters.find((f) => f.playerId === hostId)!.x;
  const direction = firstX > 600 ? -1 : 1;
  const mobile = info.project.name === 'mobile';
  async function holdPad(label: string, dx: number) {
    const pad = host.page.getByRole('group', { name: label, exact: true });
    await expect(pad).toBeVisible();
    await pad.scrollIntoViewIfNeeded();
    const bounds = await pad.boundingBox();
    if (!bounds) throw Error();
    const cdp = await host.context.newCDPSession(host.page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          x: bounds.x + bounds.width * (dx > 0 ? 0.85 : 0.15),
          y: bounds.y + bounds.height / 2,
          id: 1,
        },
      ],
    });
    return async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    };
  }
  let stop: () => Promise<void>;
  if (mobile) stop = await holdPad('Mover personagem', direction);
  else {
    await host.page.locator('canvas').focus();
    await host.page.keyboard.down(direction > 0 ? 'd' : 'a');
    stop = async () => {
      await host.page.getByRole('link', { name: 'Início', exact: true }).focus();
      await expect
        .poll(() => tie().combat.fighters.find((f) => f.playerId === hostId)!.input?.moveX)
        .toBe(0);
      await host.page.keyboard.up(direction > 0 ? 'd' : 'a');
      const lastSequence = tie().combat.fighters.find((f) => f.playerId === hostId)!.lastSequence;
      await host.page.keyboard.press('ArrowDown');
      await expect
        .poll(() => tie().combat.fighters.find((f) => f.playerId === hostId)!.lastSequence)
        .toBeGreaterThan(lastSequence);
      expect(tie().combat.fighters.find((f) => f.playerId === hostId)!.input).toMatchObject({
        moveX: 0,
        moveY: 0,
        shooting: false,
      });
      await host.page.locator('canvas').focus();
    };
  }
  await expect
    .poll(() => Math.abs(tie().combat.fighters.find((f) => f.playerId === hostId)!.x - firstX))
    .toBeGreaterThan(300);
  await stop();
  async function fireUntilQuestion(keyboardOnly = false) {
    const target = tie().combat.fighters.find((f) => f.playerId === guestId)!;
    const shooter = tie().combat.fighters.find((f) => f.playerId === hostId)!;
    let release: () => Promise<void>;
    if (mobile) release = await holdPad('Mirar e atirar', target.x - shooter.x);
    else if (keyboardOnly) {
      const aimKey = target.x > shooter.x ? 'l' : 'j';
      await host.page.locator('canvas').focus();
      await host.page.keyboard.down(aimKey);
      await host.page.keyboard.down('Space');
      release = async () => {
        await host.page.keyboard.up('Space');
        await host.page.keyboard.up(aimKey);
      };
    } else {
      const bounds = await host.page.locator('canvas').boundingBox();
      if (!bounds) throw Error();
      await host.page.mouse.move(
        bounds.x + (target.x / 1200) * bounds.width,
        bounds.y + (target.y / 800) * bounds.height,
      );
      await host.page.mouse.down();
      release = () => host.page.mouse.up();
    }
    try {
      await expect(
        guest.page.getByRole('heading', { name: 'Sua pergunta de sobrevivência' }),
      ).toBeVisible({ timeout: 25000 });
    } finally {
      await release();
    }
  }
  await host.page.screenshot({ path: info.outputPath('arena.png'), fullPage: true });
  await fireUntilQuestion();
  const first = tie().questions.find((q) => q.playerId === guestId)!;
  const deadline = first.deadlineAt;
  await guest.page.reload();
  await expect(
    guest.page.getByRole('heading', { name: 'Sua pergunta de sobrevivência' }),
  ).toBeVisible();
  expect(tie().questions.find((q) => q.playerId === guestId)!.deadlineAt).toBe(deadline);
  await auditAccessibility(guest.page, info, 'combate-pergunta');
  await expectReflow(guest.page);
  const correct = first.question.publicQuestion.options.find(
    (o) => o.optionId === first.question.correctOptionId,
  )!.text;
  await guest.page
    .getByRole('group', { name: 'Escolha sua resposta' })
    .getByRole('button', { name: correct, exact: true })
    .click();
  await expect(
    guest.page.getByText('Você acertou e recuperou 1 vida!', { exact: true }),
  ).toBeVisible();
  expect(tie().combat.fighters.find((f) => f.playerId === guestId)!.lives).toBe(1);
  await expect(host.page.getByRole('heading', { name: 'Combate em andamento' })).toBeVisible();
  await fireUntilQuestion(true);
  const second = tie().questions.find((q) => q.playerId === guestId)!;
  expect(second.question.publicQuestion.questionId).not.toBe(
    first.question.publicQuestion.questionId,
  );
  const wrong = second.question.publicQuestion.options.find(
    (o) => o.optionId !== second.question.correctOptionId,
  )!.text;
  await guest.page
    .getByRole('group', { name: 'Escolha sua resposta' })
    .getByRole('button', { name: wrong, exact: true })
    .click();
  await expect(
    guest.page.getByText('Resposta incorreta. Você foi eliminado do combate.', { exact: true }),
  ).toBeVisible();
  await expect(host.page.getByText('Campeão no desempate de tiro.', { exact: true })).toBeVisible();
  await auditAccessibility(host.page, info, 'combate-podio');
  expect(state().final!.tiebreakResults?.at(-1)?.standings).toEqual([hostId, guestId]);
  for (const player of players) {
    expect(
      await player.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await player.audit.verify();
  }
  await host.page.getByRole('button', { name: 'Preparar revanche', exact: true }).click();
  await expect(
    host.page.getByRole('button', { name: 'Iniciar modo clássico', exact: true }),
  ).toBeVisible();
  expect(room.snapshot().phase.status).toBe('lobby');
});

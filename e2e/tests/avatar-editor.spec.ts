import { test, expect } from '../fixtures.ts';
import { auditAccessibility } from '../accessibility.ts';

test('personagem: ajustes por teclado/toque, arraste, persistência e composição no lobby', async ({
  players,
  site,
}, info) => {
  const [host, guest] = players;
  const page = host.page;
  await page.goto('/perfil');
  await page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill('Ana');
  await expect(page.getByRole('tab', { name: 'Cabeça' })).toHaveCount(0);
  const preview = page.getByRole('img', { name: 'Prévia do seu personagem' });
  const head = preview.locator('[data-avatar-part="head"]');
  const frameBox = (await page.locator('.avatar-frame').boundingBox())!;
  const previewBox = (await preview.boundingBox())!;
  expect(previewBox.width).toBeLessThanOrEqual(frameBox.width);
  expect(previewBox.x).toBeGreaterThanOrEqual(frameBox.x);
  expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width);
  const originalHead = await head.getAttribute('style');
  await page.getByRole('tab', { name: 'Cabelo', exact: true }).click();
  await page
    .getByRole('tabpanel', { name: 'Cabelo', exact: true })
    .getByRole('button', { name: 'Despenteado' })
    .click();
  const size = page.getByRole('slider', { name: 'Tamanho', exact: true });
  if (info.project.use.hasTouch) {
    await size.scrollIntoViewIfNeeded();
    const box = (await size.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);
  } else {
    await size.focus();
    await size.press('ArrowRight');
    await size.press('ArrowRight');
  }
  expect(Number(await size.inputValue())).toBeGreaterThan(100);
  const surface = page.locator('.avatar-drag-surface');
  await surface.scrollIntoViewIfNeeded();
  const box = (await surface.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (info.project.use.hasTouch) {
    const cdp = await host.context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x + 26, y: start.y - 13 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 26, start.y - 13, { steps: 4 });
    await page.mouse.up();
  }
  expect(
    Number(await page.getByRole('slider', { name: 'Posição horizontal' }).inputValue()),
  ).toBeGreaterThan(0);
  expect(
    Number(await page.getByRole('slider', { name: 'Posição vertical' }).inputValue()),
  ).toBeLessThan(0);
  await expect(head).toHaveAttribute('style', originalHead!);
  const hairStyle = await preview.locator('[data-avatar-part="hair"]').getAttribute('style');
  await expect(preview.locator('[data-avatar-part="hair"]')).toHaveJSProperty('complete', true);
  await auditAccessibility(page, info, 'editor-personagens');
  if (info.project.use.hasTouch) {
    await size.scrollIntoViewIfNeeded();
    const visiblePreview = (await preview.boundingBox())!;
    const visibleSlider = (await size.boundingBox())!;
    expect(visiblePreview.y).toBeGreaterThanOrEqual(0);
    expect(visiblePreview.y + visiblePreview.height).toBeLessThanOrEqual(visibleSlider.y);
    await page.screenshot({ path: info.outputPath('editor-viewport.png') });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await info.attach('editor-personagens', {
    body: await page.screenshot({ fullPage: true, path: info.outputPath('editor.png') }),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.reload();
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).click();
  await page.getByRole('tab', { name: 'Cabelo', exact: true }).click();
  await expect(preview.locator('[data-avatar-part="hair"]')).toHaveAttribute('style', hairStyle!);
  await expect(head).toHaveAttribute('style', originalHead!);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('link', { name: 'Criar sala', exact: true }).click();
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const invite = await page.getByRole('textbox', { name: 'Link do convite' }).inputValue();
  await guest.page.goto(invite);
  await guest.page.getByRole('link', { name: 'Prepare seu perfil', exact: true }).click();
  await guest.page.getByRole('textbox', { name: 'Como você quer ser chamado?' }).fill('Bia');
  await guest.page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await guest.page.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  const remoteAvatar = guest.page.getByRole('img', { name: 'Personagem de Ana', exact: true });
  await expect(remoteAvatar.locator('[data-avatar-part="hair"]')).toHaveAttribute(
    'style',
    hairStyle!,
  );
  const room = site.app.rooms.registry.all()[0]!;
  expect(room.snapshot().members[0]?.profile.avatar.layout?.parts.hair?.x).toBeGreaterThan(0);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Pessoas na sala' }).getByRole('listitem'),
  ).toHaveCount(2);
  expect(room.snapshot().members[0]?.profile.avatar.layout?.parts.hair?.x).toBeGreaterThan(0);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo, type Locator } from '@playwright/test';

export async function auditAccessibility(page: Page, info: TestInfo, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  await info.attach(`${name}-axe.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  await info.attach(`${name}-arvore.yml`, {
    body: await page.locator('body').ariaSnapshot(),
    contentType: 'text/yaml',
  });
  expect(results.violations, `axe: ${name}`).toEqual([]);
}

export async function activateWithKeyboard(page: Page, button: Locator) {
  await expect(button).toBeEnabled();
  for (let index = 0; index < 120; index++) {
    if (await button.evaluate((element) => document.activeElement === element)) {
      await page.keyboard.press('Enter');
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Controle não alcançável por Tab.');
}

export async function expectReflow(page: Page) {
  const overflow = await page.locator('body *').evaluateAll((elements) =>
    elements
      .filter(
        (element) =>
          element instanceof HTMLElement &&
          element.getBoundingClientRect().right > window.innerWidth + 1,
      )
      .slice(0, 12)
      .map(
        (element) =>
          `${element.tagName}.${element.className}: ${element.getBoundingClientRect().right}`,
      ),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    overflow.join('\n'),
  ).toBeLessThanOrEqual(1);
}

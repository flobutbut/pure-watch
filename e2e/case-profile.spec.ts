import { expect, test } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(90_000);
test('les profils se sélectionnent, se partagent et restent indépendants de la forme et du cadran', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const initial = { a: 3, x: '#173548', n: 8, ag: 2, ac: 3 };
  await page.goto('/#v1.' + Buffer.from(JSON.stringify(initial)).toString('base64url'));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 30; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-case-profile-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-profile-curved');
  await page.keyboard.press('Home');
  for (const [i, profile] of ['straight', 'curved', 'faceted', 'stepped'].entries()) {
    if (i) await page.keyboard.press('ArrowRight');
    await expect(grid).toHaveAttribute('aria-activedescendant', `cell-case-profile-${profile}`);
    await expect
      .poll(() => {
        const payload = linkPayload(page.url());
        return payload;
      })
      .toEqual({ ...initial, ...(i === 1 ? {} : { ah: i + 1 }) });
  }
  const saved = page.url();
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-shape-tonneau');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-size-40-mm');
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await grid.focus();
  for (let i = 0; i < 30; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-case-profile-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-profile-stepped');
  expect(page.url()).toBe(saved);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

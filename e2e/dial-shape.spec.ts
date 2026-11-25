import { expect, test } from '@playwright/test';
import { linkPayload } from './link';

test('la forme précède la finition, suit les choix et se restaure par URL', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=cushion');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-dauphine');
  await grid.focus();
  // Locate the row without coupling this journey to optional font/finish rows.
  for (let i = 0; i < 12; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-shape-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-shape-round');
  for (const shape of ['cushion', 'tonneau', 'octagon', 'square', 'rectangle']) {
    await page.keyboard.press('ArrowRight');
    await expect(grid).toHaveAttribute('aria-activedescendant', `cell-dial-shape-${shape}`);
  }
  const shared = page.url();
  expect(linkPayload(shared).aa).toBe(6);
  // The dial size row sits between the shape and the finish.
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-size-open');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-finish-grained');
  expect(page.url()).toBe(shared);
  await page.reload();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-dauphine');
  expect(page.url()).toBe(shared);
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('un ancien lien conserve le cadran rond', async ({ page }) => {
  await page.goto('/#v1.e30');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await grid.focus();
  for (let i = 0; i < 12; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-shape-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-shape-round');
  expect(page.url()).toContain('#v1.e30');
});

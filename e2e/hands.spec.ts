import { expect, test } from '@playwright/test';

test('les six jeux affinés restent configurables et inspectables', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=black');
  await expect(page.locator('#boot')).toHaveClass(/done/);
  const grid = page.getByRole('grid');
  await grid.focus();
  const sets = ['baton', 'dauphine', 'sword', 'leaf', 'breguet', 'syringe'];
  for (const [index, set] of sets.entries()) {
    if (index > 0) await page.keyboard.press('ArrowRight');
    await expect(grid).toHaveAttribute('aria-activedescendant', `cell-hands-${set}`);
    await expect(page.locator('.live canvas')).toBeVisible();
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

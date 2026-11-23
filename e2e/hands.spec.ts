import { expect, test } from '@playwright/test';

test('les douze jeux et les dix trotteuses restent configurables, partageables et inspectables', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=black');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  await grid.focus();
  const sets = [
    'baton',
    'dauphine',
    'sword',
    'leaf',
    'breguet',
    'syringe',
    'spear',
    'pencil',
    'spade',
    'art-deco',
    'skeleton',
    'cathedral',
  ];
  for (const [index, set] of sets.entries()) {
    if (index > 0) await page.keyboard.press('ArrowRight');
    await expect(grid).toHaveAttribute('aria-activedescendant', `cell-hands-${set}`);
    await expect(page.locator('.live canvas')).toBeVisible();
  }
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  for (const [index, seconds] of [
    'thin',
    'counterweight',
    'lollipop',
    'arrow',
    'triangle',
    'baton',
    'diamond',
    'teardrop',
    'ring-tail',
    'lightning',
  ].entries()) {
    if (index > 0) await page.keyboard.press('ArrowRight');
    await expect(grid).toHaveAttribute('aria-activedescendant', `cell-seconds-${seconds}`);
  }
  const saved = page.url();
  await page.reload();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-cathedral');
  expect(page.url()).toBe(saved);
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lightning');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

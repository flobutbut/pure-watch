import { expect, test } from '@playwright/test';

test('la grille démarre sur la ligne Aiguilles et répond aux flèches', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveClass(/done/);
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await grid.focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-none');
  // Choisir des chiffres fait apparaître la ligne Typographie juste en dessous.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numeral-font-sans');
});

test('Entrée ouvre la vue 3D, Échap la referme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
});

test("Espace ouvre et referme l'aperçu 3D", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
});

test('le pilote coussin reste configurable et inspectable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=cushion');
  await expect(page.locator('#boot')).toHaveClass(/done/);
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-dauphine');
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lollipop');
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-arrow');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

test('le tonneau noir conserve ses options et sa navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=black');
  await expect(page.locator('#boot')).toHaveClass(/done/);
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lollipop');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-color-yellow');
  await page.keyboard.press('Enter');
  await expect(page.locator('.live canvas')).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { hexField } from './hex';

test('la grille démarre sur la ligne Aiguilles et répond aux flèches', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await grid.focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-baton');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-none');
  // Choisir des chiffres fait apparaître la ligne Typographie juste en dessous.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numeral-font-sans');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-baton');
});

test('Entrée ouvre la vue 3D, Échap la referme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
});

test('dans la vue 3D, les flèches parcourent lignes et variantes et la vue reste ouverte', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  const close3d = page.getByRole('button', { name: 'Fermer', exact: true });
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(close3d).toBeVisible();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  const cell = (await grid.getAttribute('aria-activedescendant'))!;
  const link = page.url();
  // ← → : variante suivante, enregistrée dans le lien comme dans la grille.
  await page.keyboard.press('ArrowRight');
  await expect(grid).not.toHaveAttribute('aria-activedescendant', cell);
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-hands-/);
  await expect.poll(() => page.url()).not.toBe(link);
  // ↑ ↓ : ligne suivante ; son nom et sa variante restent lisibles à gauche, comme dans la grille.
  const label = page.locator('.preview-label');
  await expect(label).toContainText('Aiguilles');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-seconds-/);
  await expect(label).toContainText('Trotteuse');
  await expect(label).toHaveCSS('opacity', '1');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-hands-/);
  await expect(close3d).toBeVisible();
  // Retour à la grille : la sélection faite dans la vue est conservée.
  const chosen = (await grid.getAttribute('aria-activedescendant'))!;
  await page.keyboard.press('Escape');
  await expect(close3d).toBeHidden();
  await expect(grid).toHaveAttribute('aria-activedescendant', chosen);
});

test('Espace ouvre l’aperçu avec les réglages de la ligne, ou la vue 3D sans réglages', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  const close3d = page.getByRole('button', { name: 'Fermer', exact: true });
  await grid.focus();
  // Ligne des aiguilles (active au chargement) : la vue 3D et son panneau de réglages.
  await page.keyboard.press('Space');
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Aiguilles');
  await expect(close3d).toBeVisible();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Space');
  await expect(panel).toBeHidden();
  await expect(close3d).toBeHidden();
  // Ligne sans réglages (date) : la vue 3D seule, sans fiche d'identité.
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-date-/);
  await page.keyboard.press('Space');
  await expect(close3d).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(close3d).toBeHidden();
});

test('le pilote coussin reste configurable et inspectable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=cushion');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
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
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lollipop');
  // The seconds colour is a swatch on the cell, not a row: the date row comes next.
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-date-none');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lollipop');
  await page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }).click();
  await expect(await hexField(page)).toHaveValue('#F2C230');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.live canvas')).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

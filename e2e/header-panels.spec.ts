import { expect, test, type Page } from '@playwright/test';

/*
 * The preview (Space, Enter or a click on the watch): the 3D watch with the active row's settings beside it, following the
 * rows browsed with the arrows. And the header's card and share buttons from every place: the
 * grid, a settings panel opened from a row's button, the preview, the 3D view.
 */

test.setTimeout(90_000);

async function row(page: Page, id: string) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('PageUp');
  for (let i = 0; i < 40; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith(`cell-${id}-`)) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}

function ui(page: Page) {
  return {
    grid: page.getByRole('grid'),
    cardButton: page.getByRole('button', { name: 'Fiche d’identité', exact: true }),
    shareButton: page.getByRole('button', { name: 'Partager la configuration', exact: true }),
    card: page.getByRole('dialog', { name: 'Votre montre' }),
    share: page.getByRole('dialog', { name: 'Partager votre montre' }),
    /** A colour or settings panel, in the grid or beside the preview. */
    settings: page.getByRole('dialog').filter({
      has: page.getByRole('button', { name: 'Fermer les couleurs', exact: true }),
    }),
    dimensions: page.getByRole('dialog', { name: 'Dimensions du boîtier' }),
    close3d: page.getByRole('button', { name: 'Fermer', exact: true }),
  };
}

/** Back in the grid, the 3D view closed and settled, no panel left. */
async function inGrid(page: Page) {
  const { grid, close3d } = ui(page);
  await expect(close3d).toBeHidden();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** The settings of the given part are shown, alone; `view`: beside the 3D preview. */
async function settingsOf(page: Page, part: string, view: boolean) {
  const { settings, card, share, close3d, grid } = ui(page);
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('heading', { name: part, exact: true })).toBeVisible();
  await expect(card).toBeHidden();
  await expect(share).toBeHidden();
  if (view) await expect(close3d).toBeVisible();
  else await expect(close3d).toBeHidden();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
}

/** Space on the active row: the preview opens. */
async function preview(page: Page) {
  const { grid, close3d } = ui(page);
  await grid.focus();
  await page.keyboard.press('Space');
  await expect(close3d).toBeVisible();
  await expect(grid).toHaveAttribute('aria-busy', 'false');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
});

test('l’aperçu suit les lignes au clavier et montre leurs réglages quand elles en ont', async ({
  page,
}) => {
  const { grid, settings } = ui(page);
  await preview(page);
  await settingsOf(page, 'Aiguilles', true);

  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-seconds-/);
  await settingsOf(page, 'Couleur de la trotteuse', true);

  // Date : pas de réglages, la montre seule.
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-date-/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ui(page).close3d).toBeVisible();

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await settingsOf(page, 'Aiguilles', true);

  // La croix du panneau le masque ; la vue 3D reste, sans réglages.
  const toggle = page.getByRole('button', { name: 'Réglages de la ligne', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await settings.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ui(page).close3d).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Le bouton de la barre d'outils les fait revenir ; la touche R les bascule aussi.
  await toggle.click();
  await settingsOf(page, 'Couleur de la trotteuse', true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await grid.focus();
  await page.keyboard.press('r');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('r');
  await settingsOf(page, 'Couleur de la trotteuse', true);

  await page.keyboard.press('Escape');
  await inGrid(page);
});

test('un réglage fait dans l’aperçu est gardé en changeant de ligne', async ({ page }) => {
  const { grid, settings } = ui(page);
  await row(page, 'seconds');
  await preview(page);
  await settingsOf(page, 'Couleur de la trotteuse', true);
  const swatches = settings.getByRole('group', { name: 'Teintes proposées' }).getByRole('button');
  const target = swatches.nth(1);
  const name = (await target.getAttribute('aria-label'))!;
  const before = page.url();
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');

  // The focus is on the swatch: the arrows still browse the rows, and the colour is saved.
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-hands-/);
  await settingsOf(page, 'Aiguilles', true);
  await expect.poll(() => page.url()).not.toBe(before);
  await page.keyboard.press('ArrowDown');
  await settingsOf(page, 'Couleur de la trotteuse', true);
  await expect(settings.getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('l’aperçu montre les dimensions sur la ligne de la taille', async ({ page }) => {
  const { grid, dimensions } = ui(page);
  await row(page, 'case-size');
  await preview(page);
  await expect(dimensions).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(grid).not.toHaveAttribute('aria-activedescendant', /^cell-case-size-/);
  await expect(dimensions).toBeHidden();
  await page.keyboard.press('ArrowUp');
  await expect(dimensions).toBeVisible();
});

test('dans l’aperçu, Fiche et Partager remplacent les réglages puis les rendent', async ({
  page,
}) => {
  const { grid, cardButton, shareButton, card, share, settings } = ui(page);
  await preview(page);
  await settingsOf(page, 'Aiguilles', true);

  await cardButton.click();
  await expect(card).toBeVisible();
  await expect(settings).toBeHidden();
  await expect(cardButton).toHaveAttribute('aria-pressed', 'true');
  await cardButton.click();
  await settingsOf(page, 'Aiguilles', true);

  // La croix de la fiche, la touche I.
  await cardButton.click();
  await card.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true }).click();
  await settingsOf(page, 'Aiguilles', true);
  await grid.focus();
  await page.keyboard.press('i');
  await expect(card).toBeVisible();
  await page.keyboard.press('i');
  await settingsOf(page, 'Aiguilles', true);

  // Partage, puis fiche → partage → croix du partage.
  await shareButton.click();
  await expect(share).toBeVisible();
  await shareButton.click();
  await settingsOf(page, 'Aiguilles', true);
  await cardButton.click();
  await shareButton.click();
  await expect(share).toBeVisible();
  await share.getByRole('button', { name: 'Fermer le partage', exact: true }).click();
  await settingsOf(page, 'Aiguilles', true);

  // Échap quitte l'aperçu.
  await grid.focus();
  await page.keyboard.press('Escape');
  await inGrid(page);
});

test('depuis le bouton Paramètres de la grille, Fiche remplace le panneau et le rend', async ({
  page,
}) => {
  const { cardButton, shareButton, card, share, settings } = ui(page);
  await page.getByRole('button', { name: 'Paramètres des aiguilles', exact: true }).click();
  await settingsOf(page, 'Aiguilles', false);

  await cardButton.click();
  await expect(card).toBeVisible();
  await expect(settings).toBeHidden();
  await cardButton.click();
  await settingsOf(page, 'Aiguilles', false);

  await cardButton.click();
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await settingsOf(page, 'Aiguilles', false);

  await shareButton.click();
  await expect(share).toBeVisible();
  await cardButton.click();
  await expect(card).toBeVisible();
  await cardButton.click();
  await settingsOf(page, 'Aiguilles', false);

  await settings.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await inGrid(page);
});

test('depuis la grille, Fiche et Partager y reviennent ; Entrée ouvre aussi l’aperçu', async ({
  page,
}) => {
  const { grid, cardButton, shareButton, card, share, close3d } = ui(page);

  // Grille → fiche → partage → croix du partage : retour à la grille.
  await cardButton.click();
  await expect(card).toBeVisible();
  await shareButton.click();
  await expect(share).toBeVisible();
  await share.getByRole('button', { name: 'Fermer le partage', exact: true }).click();
  await inGrid(page);

  // Aperçu ouvert avec Entrée : les mêmes réglages qu'avec Espace ; la fiche va et vient.
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(close3d).toBeVisible();
  await settingsOf(page, 'Aiguilles', true);
  await page.keyboard.press('ArrowDown');
  await settingsOf(page, 'Couleur de la trotteuse', true);
  await cardButton.click();
  await expect(card).toBeVisible();
  await cardButton.click();
  await expect(card).toBeHidden();
  await settingsOf(page, 'Couleur de la trotteuse', true);
  await page.keyboard.press('Escape');
  await inGrid(page);
});

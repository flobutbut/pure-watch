import { expect, test, type Locator, type Page } from '@playwright/test';

// The live 3D watch slows every step: the first test walks a dozen rows and opens the view.
test.setTimeout(120_000);

async function row(page: Page, id: string) {
  const grid = page.getByRole('grid');
  await grid.focus();
  // Up to the first row, the case size.
  for (let i = 0; i < 6; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith('cell-case-size-')) break;
    await page.keyboard.press('PageUp');
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  for (let i = 0; i < 40; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith(`cell-${id}-`)) break;
    await page.keyboard.press('ArrowDown');
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}

/** A point in the void beside the panel (or above it, when it is a bottom sheet). */
async function clickOutside(page: Page, panel: Locator) {
  const box = (await panel.boundingBox())!;
  const view = page.viewportSize()!;
  const beside = box.x > 60;
  await page.mouse.click(
    beside ? box.x / 2 : view.width / 2,
    beside ? box.y + box.height / 2 : box.y / 2,
  );
}

/** The close button is on top of everything at its place and inside the window. */
async function closeReachable(page: Page, close: Locator) {
  await close.click({ trial: true });
  const box = (await close.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
}

test('chaque panneau se ferme d’un clic dans le vide, pas d’un clic dedans ni d’un glisser', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');

  // Paramètres des index : le clic ne fait que refermer, la grille ne bouge pas.
  await row(page, 'numerals');
  const active = await grid.getAttribute('aria-activedescendant');
  await page.getByRole('button', { name: 'Repères horaires' }).click();
  const indices = page.getByRole('dialog', { name: 'Repères horaires', exact: true });
  await expect(indices).toBeVisible();
  await indices.getByRole('heading', { name: 'Repères horaires' }).click();
  await expect(indices).toBeVisible();
  await clickOutside(page, indices);
  await expect(indices).toBeHidden();
  await expect(grid).toHaveAttribute('aria-activedescendant', active!);

  // Dimensions du boîtier.
  await row(page, 'case-size');
  await page.getByRole('button', { name: 'Dimensions du boîtier', exact: true }).click();
  const dimensions = page.getByRole('dialog', { name: 'Boîtier et attaches' });
  await expect(dimensions).toBeVisible();
  await clickOutside(page, dimensions);
  await expect(dimensions).toBeHidden();

  // À propos : modale centrée, le voile la referme et le focus revient au bouton.
  const aboutButton = page.getByRole('button', { name: 'À propos', exact: true });
  await aboutButton.click();
  const about = page.getByRole('dialog', { name: 'À propos d’Épure' });
  await expect(about).toBeVisible();
  await about.getByRole('heading', { name: 'Mentions légales' }).click();
  await expect(about).toBeVisible();
  await clickOutside(page, about);
  await expect(about).toBeHidden();
  await expect(aboutButton).toBeFocused();

  // Vue 3D : tourner la montre garde la fiche ; le clic dans le vide la ferme, pas la vue.
  await grid.focus();
  await page.keyboard.press('Enter');
  const close3d = page.getByRole('button', { name: 'Fermer', exact: true });
  await expect(close3d).toBeVisible();
  const card = page.getByRole('dialog', { name: 'Votre montre' });
  await page.getByRole('button', { name: 'Fiche d’identité', exact: true }).click();
  await expect(card).toBeVisible();
  const watch = (await page.locator('.live-slot').boundingBox())!;
  await page.mouse.move(watch.x + watch.width / 2, watch.y + watch.height / 2);
  await page.mouse.down();
  await page.mouse.move(watch.x + watch.width / 2 + 60, watch.y + watch.height / 2 + 10, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(card).toBeVisible();
  // Les outils de la vue restent actifs à côté de la fiche, qui ne se ferme pas.
  const pause = page.getByRole('button', { name: 'Mettre les aiguilles en pause', exact: true });
  await pause.click();
  await expect(
    page.getByRole('button', { name: 'Relancer les aiguilles', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toBeVisible();
  await clickOutside(page, card);
  await expect(card).toBeHidden();
  await expect(close3d).toBeVisible();

  // Partage.
  await page.getByRole('button', { name: 'Partager la configuration', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Partager votre montre' });
  await expect(share).toBeVisible();
  await clickOutside(page, share);
  await expect(share).toBeHidden();
});

test('la croix reste atteignable dans une petite fenêtre', async ({ page }, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile' ? { width: 375, height: 812 } : { width: 800, height: 600 },
  );
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });

  // Un panneau plus haut que la fenêtre : l'en-tête reste visible, seul le corps défile.
  await row(page, 'numerals');
  await page.getByRole('button', { name: 'Repères horaires' }).click();
  const indices = page.getByRole('dialog', { name: 'Repères horaires', exact: true });
  const closeIndices = indices.getByRole('button', { name: 'Fermer les couleurs', exact: true });
  await closeReachable(page, closeIndices);
  await closeIndices.click();
  await expect(indices).toBeHidden();

  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  const toggle = page.getByRole('button', { name: 'Fiche d’identité', exact: true });
  const card = page.getByRole('dialog', { name: 'Votre montre' });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect(card).toBeVisible();
  const closeCard = card.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
  await closeReachable(page, closeCard);
  await closeCard.click();
  await expect(card).toBeHidden();

  await page.getByRole('button', { name: 'Partager la configuration', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Partager votre montre' });
  const closeShare = share.getByRole('button', { name: 'Fermer le partage', exact: true });
  await closeReachable(page, closeShare);
  await closeShare.click();
  await expect(share).toBeHidden();
});

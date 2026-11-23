import { expect, test } from '@playwright/test';

test('la fiche d’identité accompagne la vue 3D et liste les mouvements', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  const toggle = page.getByRole('button', { name: 'Fiche d’identité', exact: true });
  const card = page.getByRole('dialog', { name: 'Votre montre' });
  // Ouverte d'office sur grand écran, à la demande sur téléphone.
  if (info.project.name === 'mobile') {
    await expect(card).toBeHidden();
    await toggle.click();
  }
  await expect(card).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('Diamètre', { exact: true })).toBeVisible();
  await expect(card.getByText('Seiko NH38A')).toHaveCount(0);
  const movementsTab = card.getByRole('tab', { name: 'Mouvements' });
  await movementsTab.click();
  await expect(movementsTab).toHaveAttribute('aria-selected', 'true');
  await expect(card.getByText('Seiko NH38A')).toBeVisible();
  await expect(card.getByText('Trotteuse de la vue 3D : 6 pas par seconde')).toBeAttached();
  await expect(card.getByText('Diamètre', { exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expect(card.getByRole('tab', { name: 'Caractéristiques' })).toBeFocused();
  await expect(card.getByText('Diamètre', { exact: true })).toBeVisible();

  const watch = await page.locator('.live-slot').boundingBox();
  const panel = await card.boundingBox();
  const overlap =
    Math.min(watch!.x + watch!.width * 0.85, panel!.x + panel!.width) >
      Math.max(watch!.x + watch!.width * 0.15, panel!.x) &&
    Math.min(watch!.y + watch!.height * 0.85, panel!.y + panel!.height) >
      Math.max(watch!.y + watch!.height * 0.15, panel!.y);
  expect(overlap).toBe(false);

  await card.getByRole('button', { name: 'Masquer la fiche d’identité' }).click();
  await expect(card).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('grid').focus();
  await page.keyboard.press('i');
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(toggle).toBeHidden();
});

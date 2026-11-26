import { test, expect, type Page } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(120_000);
async function strapRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 45; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-strap-')) return;
    await page.keyboard.press('ArrowDown');
  }
  throw new Error('Bracelet introuvable');
}
test('matières, réglages, restauration et partage du bracelet', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 30000 });
  await strapRow(page);
  await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Réglages du bracelet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Grainé', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Rallye', exact: true }).click();
  await page.getByRole('button', { name: 'Long · 85 / 125 mm', exact: true }).click();
  await page.getByRole('radio', { name: 'Personnalisée', exact: true }).click();
  await page.getByRole('button', { name: 'Or rose', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(linkPayload(page.url())).toMatchObject({ Q: 'rally', bg: 'long', bi: 'gold-rose' });
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 30000 });
  await strapRow(page);
  const settings = page.getByRole('button', { name: 'Réglages du bracelet', exact: true });
  await settings.click();
  await expect(page.getByRole('button', { name: 'Rallye', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Or rose', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Lisse', exact: true }).click();
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rallye', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: `documentation/strap/panel-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  for (const [type, label, shape] of [
    ['metal', 'Métal', '5 maillons'],
    ['rubber', 'Caoutchouc', 'Cannelé'],
    ['fabric', 'Tissu', 'Rayé'],
  ] as const) {
    await page.getByRole('grid').focus();
    await page.keyboard.press('Home');
    await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
    if (type === 'rubber') await page.keyboard.press('ArrowRight');
    if (type === 'fabric') {
      await page.keyboard.press('End');
    }
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      new RegExp(`cell-strap-${type}`),
    );
    await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
    await settings.click();
    await page.getByRole('button', { name: shape, exact: true }).click();
    await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
    expect(linkPayload(page.url()).P).toBe(type);
    await page.getByRole('grid').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
    const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
    if (await card.count()) await card.click();
    await page.getByRole('grid').focus();
    await page.keyboard.press('5');
    await page.waitForTimeout(650);
    await page.screenshot({ path: `documentation/strap/${label}-${info.project.name}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  }
  expect(errors).toEqual([]);
});

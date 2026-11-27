import { expect, test } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(180_000);

test('le panneau guide le dessus, le profil indépendant et les détails puis les partage', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 30_000 });
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 30; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-case-size-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-case-size-/);
  await page.keyboard.press('ArrowDown');
  await page.locator('button[aria-label="Paramètres du boîtier"][tabindex="0"]').click();
  const tabs = page.getByRole('radiogroup', { name: 'Paramètres du boîtier', exact: true });
  await expect(tabs.getByRole('radio')).toHaveText(['Taille', 'Dessus', 'Profil', 'Détails']);
  // The case row already chooses the shape: the panel does not repeat it.
  await expect(page.getByRole('group', { name: 'Forme du boîtier', exact: true })).toHaveCount(0);
  await tabs.getByRole('radio', { name: 'Profil', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Aligné sur le boîtier', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const thickness = page.getByRole('slider', { name: 'Épaisseur en pointe', exact: true });
  await thickness.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(thickness).toHaveValue('0.7');
  await page.getByRole('button', { name: 'Courbe', exact: true }).click();
  const height = page.getByRole('slider', { name: 'Hauteur des pointes', exact: true });
  await height.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(height).toHaveValue('-3.9');
  await page.getByRole('button', { name: 'Aligné sur le boîtier', exact: true }).click();
  await expect(height).toHaveCount(0);
  await page.getByRole('slider', { name: 'Galbe du dessus', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('img', { name: 'Courbes du profil des cornes et plan du boîtier', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'documentation/case-envelope/settings-profile.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(thickness).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'documentation/case-envelope/settings-profile-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await tabs.getByRole('radio', { name: 'Détails', exact: true }).click();
  await page.getByRole('button', { name: 'Chanfrein', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cornes percées', exact: true }).press('Space');
  await page.screenshot({ path: 'documentation/case-envelope/settings-details.png' });
  await tabs.getByRole('radio', { name: 'Dessus', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Contour du boîtier et des attaches vu de dessus', exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Protections de couronne', exact: true }).press('Space');
  const connection = page.getByRole('slider', { name: 'Fondu du raccord', exact: true });
  await connection.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(connection).toHaveValue('0.99');
  await page.getByRole('button', { name: 'Sans cornes', exact: true }).click();
  // Guards still share the root blend once the lugs are gone.
  await expect(connection).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Largeur des cornes', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Cornes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Classiques', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'documentation/case-envelope/settings-silhouette.png' });
  await page.getByRole('button', { name: 'Fermer les paramètres du boîtier', exact: true }).click();
  const expected = {
    dome: 1,
    integration: 0.99,
    underside: 'flat',
    tipThicknessMm: 0.7,
    tipOffsetMm: -3.9,
    edge: 'chamfer',
    drilled: true,
  };
  await expect.poll(() => linkPayload(page.url()).bj).toMatchObject(expected);
  const shared = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 30_000 });
  expect(linkPayload(page.url()).bj).toMatchObject(expected);
  expect(page.url()).toBe(shared);
  expect(errors).toEqual([]);
});

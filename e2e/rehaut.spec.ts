import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';
test.setTimeout(120_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) => linkPayload(page.url());
async function seek(page: Page, id: string, key = 'ArrowUp') {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 22; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith(`cell-${id}-`)) break;
    await page.keyboard.press(key);
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}
const open = (page: Page) =>
  page.getByRole('button', { name: 'Paramètres du réhaut', exact: true }).click();
const close = (page: Page) =>
  page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();

test('une seule ligne réunit profils, matière et graduations et conserve les anciens liens', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ a: 5, aa: 5, n: 5, x: '#19476B', af: 5 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await seek(page, 'rehaut');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-rehaut-classic');
  await expect(page.getByRole('row', { name: 'Graduations du réhaut', exact: true })).toHaveCount(
    0,
  );
  await open(page);
  await expect(page.getByRole('dialog', { name: 'Réhaut', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Matière', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Graduations', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Graduations', exact: true })).toHaveCount(0);
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText(/Le profil fin ne porte pas de graduations/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tachymètre', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Biseauté', exact: true }).click();
  await expect(page.getByText(/Le profil fin ne porte pas de graduations/)).toHaveCount(0);
  await page.getByRole('region', { name: 'Matière', exact: true }).scrollIntoViewIfNeeded();
  const finish = (name: string) =>
    page
      .getByRole('radiogroup', { name: 'Finition du réhaut', exact: true })
      .getByRole('radio', { name, exact: true });
  await finish('Couleur libre').click();
  await (
    await hexField(page, page.getByRole('region', { name: 'Matière', exact: true }))
  ).fill('#C85432');
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Fin', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(finish('Assorti au cadran')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Biseauté', exact: true }).click();
  await finish('Couleur libre').click();
  await (
    await hexField(page, page.getByRole('region', { name: 'Matière', exact: true }))
  ).fill('#C85432');
  await close(page);
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-rehaut-sloped');
  expect(payload(page)).toMatchObject({
    a: 5,
    aa: 5,
    n: 5,
    x: '#19476B',
    ac: 2,
    ad: 3,
    ae: '#C85432',
    af: 5,
  });
  await open(page);
  await finish('Matière du boîtier').click();
  await close(page);
  expect(payload(page).ad).toBe(2);
  await open(page);
  await finish('Couleur libre').click();
  await expect(
    await hexField(page, page.getByRole('region', { name: 'Matière', exact: true })),
  ).toHaveValue('#C85432');
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  for (const [index, scale] of [
    'Minutes',
    'Minutes chiffrées',
    '24 heures',
    'Tachymètre',
  ].entries()) {
    await page.getByRole('radio', { name: scale, exact: true }).click();
    await close(page);
    expect(payload(page).af).toBe(index + 2);
    await open(page);
    await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  }
  await page.locator('dialog .body').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `documentation/graduations/unified-rehaut-${info.project.name}.png`,
    animations: 'disabled',
  });
  await close(page);
  await grid.focus();
  await page.keyboard.press('Home');
  expect(payload(page).af).toBe(5);
  await expect(page.getByRole('row', { name: 'Graduations du réhaut', exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-dial-shape-/);
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await seek(page, 'rehaut');
  await open(page);
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('radio', { name: 'Tachymètre', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await close(page);
  expect(errors).toEqual([]);
});

test('le rectangle conserve le réhaut et ses graduations avec une seule ligne', async ({
  page,
}) => {
  await page.goto(link({ a: 6, ac: 3, ad: 3, ae: '#FFFF00', af: 4 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await seek(page, 'rehaut');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-rehaut-concave');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-shape-round');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-size-compact');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-shape-rectangle');
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-rehaut-concave');
  expect(payload(page)).toMatchObject({ ac: 3, ad: 3, ae: '#FFFF00', af: 4, ag: 1 });
  await open(page);
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('radio', { name: '24 heures', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

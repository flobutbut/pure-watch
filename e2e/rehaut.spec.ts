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
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith(`cell-${id}-`)) break;
    await page.keyboard.press(key);
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}

test('les profils, graduations et couleurs du réhaut se prévisualisent et survivent au lien', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ a: 5, aa: 5, n: 5, x: '#19476B' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await seek(page, 'rehaut');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-classic',
  );
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-sloped',
  );
  const trigger = page.getByRole('button', { name: 'Matière et couleur du réhaut', exact: true });
  const saved = page.url();
  await trigger.click();
  await page.getByRole('button', { name: 'Couleur libre', exact: true }).click();
  await (await hexField(page)).fill('#C85432');
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(page.url()).toBe(saved);
  await trigger.click();
  await page.getByRole('button', { name: 'Couleur libre', exact: true }).click();
  await (await hexField(page)).fill('#C85432');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({
    a: 5,
    aa: 5,
    n: 5,
    x: '#19476B',
    ac: 2,
    ad: 3,
    ae: '#C85432',
  });
  await trigger.click();
  await page.getByRole('button', { name: 'Matière du boîtier', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Code HEX' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).ad).toBe(2);
  await trigger.click();
  await page.getByRole('button', { name: 'Couleur libre', exact: true }).click();
  await expect(await hexField(page)).toHaveValue('#C85432');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-scale-none',
  );
  for (const [index, scale] of ['minutes', 'five-minute', '24h', 'tachymeter'].entries()) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      `cell-rehaut-scale-${scale}`,
    );
    expect(payload(page).af).toBe(index + 2);
  }
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', /cell-dial-shape-/);
  expect(payload(page).af).toBe(5);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-scale-tachymeter',
  );
  const final = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await seek(page, 'rehaut-scale');
  expect(page.url()).toBe(final);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('le rectangle conserve le réhaut avec une ouverture ronde et chaque taille', async ({
  page,
}) => {
  await page.goto(link({ a: 6, ac: 3, ad: 3, ae: '#FFFF00', af: 4 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await seek(page, 'rehaut-scale');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-scale-24h',
  );
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-shape-round',
  );
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-size-compact',
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-shape-rectangle',
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-concave',
  );
  expect(payload(page)).toMatchObject({ ac: 3, ad: 3, ae: '#FFFF00', af: 4, ag: 1 });
});

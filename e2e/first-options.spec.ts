import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';

test.setTimeout(90_000);
const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const payload = (page: Page) => linkPayload(page.url());
async function row(page: Page, id: string) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 6; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith('cell-case-shape-')) break;
    await page.keyboard.press('PageUp');
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  for (let i = 0; i < 40; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith(`cell-${id}-`)) break;
    const active = await grid.getAttribute('aria-activedescendant');
    await page.keyboard.press('ArrowDown');
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}

test('sans trotteuse : retire la petite seconde, masque la couleur et survit au rechargement', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    link({
      O: [
        { type: 'date', position: '3h' },
        { type: 'small-seconds', position: '6h' },
      ],
    }),
  );
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('row', { name: 'Trotteuse', exact: true })).toHaveCount(0);
  await row(page, 'small-seconds');
  await page.keyboard.press('Home');
  await row(page, 'seconds');
  await page.keyboard.press('End');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-seconds-none',
  );
  expect(payload(page)).toMatchObject({ L: 11, O: [{ type: 'date', position: '3h' }] });
  await expect(
    page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }),
  ).toHaveCount(0);
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await row(page, 'seconds');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-seconds-none',
  );
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('les dimensions indépendantes se ferment avec Échap et reviennent depuis le lien', async ({
  page,
}, testInfo) => {
  await page.goto(link({ A: 9, L: 11 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await row(page, 'case-size');
  await page.getByRole('button', { name: 'Dimensions du boîtier', exact: true }).click();
  await page.getByLabel('Diamètre', { exact: true }).fill('41');
  await page.getByLabel('Épaisseur', { exact: true }).fill('13.54');
  await page.getByLabel('Longueur de corne à corne', { exact: true }).fill('47.5');
  await page.getByLabel('Entre-cornes / bracelet', { exact: true }).fill('21');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(payload(page)).toMatchObject({ b: 41, c: 13.54, d: 47.5, e: 21, T: 21, A: 9, L: 11 });
  await expect(page.locator('.label.active .label-variant')).toContainText('Sur mesure');
  await expect(page.locator('#cell-case-size-40-mm')).toHaveAttribute(
    'aria-label',
    /41 mm · Sur mesure/,
  );
  await expect(page.locator('#cell-case-size-40-mm')).toHaveAttribute('aria-selected', 'false');
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await row(page, 'case-size');
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Dimensions du boîtier', exact: true }).click();
  await expect(page.getByLabel('Épaisseur', { exact: true })).toHaveValue('13.54');
  await page.getByLabel('Épaisseur', { exact: true }).fill('14');
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByLabel('Épaisseur', { exact: true })).toHaveValue('13.54');
  await page.screenshot({
    path: `documentation/first-options/dimensions-${testInfo.project.name}.png`,
  });
  await page.getByLabel('Épaisseur', { exact: true }).fill('');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer les paramètres du boîtier', exact: true }).click();
  expect(page.url()).toBe(saved);
});

test('les jeux mixtes restent inspectables et les anciens liens gardent leurs index', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ A: 9, L: 11, n: 7, p: 2, ag: 2 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await row(page, 'numerals');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-numerals-none',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  const card = page.getByRole('button', { name: 'Fiche d’identité', exact: true });
  if ((await card.getAttribute('aria-pressed')) === 'true') await card.click();
  await page.keyboard.press('1');
  await page.screenshot({
    path: `documentation/first-options/dive-${testInfo.project.name}.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Repères horaires', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Plongée', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Bâtons et points', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).A).toBe(10);
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await page.goto(link({ A: 4 }));
  await row(page, 'numerals');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-numerals-none',
  );
  expect(errors).toEqual([]);
});

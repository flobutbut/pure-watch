import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';

test.setTimeout(60_000);
const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const payload = (page: Page) => linkPayload(page.url());
async function numeralsRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 6; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-numerals-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-numerals-/);
}
const parameters = (page: Page) =>
  page.getByRole('button', {
    name: 'Paramètres des chiffres : taille, position et couleur',
    exact: true,
  });

test('un ancien lien romain complet reste romain, puis change d’écriture sans changer les positions', async ({
  page,
}) => {
  await page.goto(link({ D: 7, E: 4, A: 9, aj: 1.3, ak: 0.85, al: '#C9A24A' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await numeralsRow(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-numerals-all',
  );
  expect(payload(page)).toMatchObject({ D: 2, ao: 2, E: 4, aj: 1.3, ak: 0.85, al: '#C9A24A' });
  await expect(page.getByRole('row', { name: 'Index', exact: true })).toHaveCount(0);
  await parameters(page).click();
  await expect(page.getByRole('button', { name: 'Romains', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Arabes', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({ D: 2, E: 4, aj: 1.3, ak: 0.85, al: '#C9A24A' });
  expect(payload(page).ao).toBeUndefined();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await numeralsRow(page);
  await parameters(page).click();
  await expect(page.getByRole('button', { name: 'Arabes', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('XII seul, XII et VI, puis tous : mêmes positions et index disponibles en romain', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ D: 4, A: 9, x: '#1F4D3A', L: 11, E: 4 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await numeralsRow(page);
  await parameters(page).click();
  await page.getByRole('button', { name: 'Romains', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({ D: 4, ao: 2, A: 9 });
  const grid = page.getByRole('grid');
  await grid.focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-six-twelve');
  expect(payload(page)).toMatchObject({ D: 5, ao: 2 });
  await expect(page.getByRole('row', { name: 'Index', exact: true })).toHaveCount(1);
  await parameters(page).click();
  await expect(page.getByRole('button', { name: 'Romains', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({
    path: `documentation/numeral-system/panel-${testInfo.project.name}.png`,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Arabes', exact: true }).click();
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Romains', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await numeralsRow(page);
  await page.keyboard.press('End');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-all');
  await expect(page.getByRole('row', { name: 'Index', exact: true })).toHaveCount(0);
  expect(payload(page).ao).toBe(2);
  await page.keyboard.press('Home');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-none');
  expect(payload(page).ao).toBe(2);
  await expect(parameters(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

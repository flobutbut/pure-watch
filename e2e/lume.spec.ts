import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';

test.setTimeout(60_000);
const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const payload = (page: Page) => linkPayload(page.url());
const handsPanel = (page: Page) =>
  page.getByRole('button', { name: 'Paramètres des aiguilles', exact: true });
const indicesPanel = (page: Page) =>
  page.getByRole('button', {
    name: 'Paramètres des index : longueur, largeur et position',
    exact: true,
  });
const closePanel = (page: Page) =>
  page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();

test('les pigments associent jour et nuit, se rétablissent et se retrouvent dans le lien', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ A: 9, n: 7 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await handsPanel(page).click();
  await page.getByRole('button', { name: 'Or', exact: true }).click();
  await page.getByRole('button', { name: 'Luminescent', exact: true }).click();
  await page
    .getByRole('group', { name: 'Pigment luminescent' })
    .getByRole('button', { name: 'BGW9', exact: true })
    .click();
  await expect(page.getByText('Blanc de jour · Bleu la nuit', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Aperçu nocturne', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aperçu nocturne', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await closePanel(page);
  expect(payload(page)).toMatchObject({ J: 'gold', K: 'bgw9', as: '#EDF1E9', at: '#65CAFF' });
  expect(payload(page).C).toBeUndefined();
  const grid = page.getByRole('grid');
  await grid.focus();
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-dive');
  await indicesPanel(page).click();
  await page.getByRole('button', { name: 'Or', exact: true }).click();
  await page.getByRole('button', { name: 'Luminescent', exact: true }).click();
  await page
    .getByRole('group', { name: 'Pigment luminescent' })
    .getByRole('button', { name: 'C3', exact: true })
    .click();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `documentation/lume/panel-${info.project.name}.png`,
    animations: 'disabled',
  });
  await closePanel(page);
  const saved = page.url();
  expect(payload(page)).toMatchObject({
    B: 'applied-gold',
    C: 'c3',
    K: 'bgw9',
    at: '#65CAFF',
  });
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await handsPanel(page).click();
  await expect(page.getByRole('button', { name: 'BGW9', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sur mesure', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'C1', exact: true }).click();
  await expect(page.getByText('Blanc de jour · Vert la nuit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Old Radium', exact: true }).click();
  await expect(
    page.getByText('Beige patiné de jour · Vert la nuit', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sans insert', exact: true }).click();
  await page.getByRole('button', { name: 'Acier bleui', exact: true }).click();
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Or', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Luminescent', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'BGW9', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await closePanel(page);
  expect(page.url()).toBe(saved);
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(1);
  const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
  if (await card.count()) await card.click();
  await grid.focus();
  await page.keyboard.press('1');
  await page.keyboard.press('p');
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: 'Aperçu nocturne', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `documentation/lume/night-${info.project.name}.png`,
    animations: 'disabled',
  });
  expect(page.url()).toBe(saved);
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: 'Aperçu nocturne', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(errors).toEqual([]);
});

test('les index imprimés gardent leur couleur et la luminescence peut être retirée sans perdre les teintes', async ({
  page,
}) => {
  await page.goto(link({ A: 9, C: 'custom', aq: '#DCC294', ar: '#65CAFF' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowUp');
  await indicesPanel(page).click();
  await page.getByRole('button', { name: 'Sans insert', exact: true }).click();
  await page.getByRole('button', { name: 'Imprimé', exact: true }).click();
  await (await hexField(page)).fill('#1A2B3C');
  await closePanel(page);
  expect(payload(page)).toMatchObject({
    B: 'printed',
    ap: '#1A2B3C',
    aq: '#EDF1E9',
    ar: '#65CAFF',
  });
  expect(payload(page).C).toBeUndefined();
  await indicesPanel(page).click();
  await page.getByRole('button', { name: 'Luminescent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'BGW9', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await closePanel(page);
  expect(payload(page)).toMatchObject({ B: 'printed', C: 'bgw9', ap: '#1A2B3C' });
});

test('un ancien lien libre est converti vers un pigment sans aucun accès aux couleurs libres', async ({
  page,
}) => {
  await page.goto(link({ K: 'custom', as: '#A35128', at: '#AF43E1' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(['c3', 'bgw9', 'c1', 'old-radium']).toContain(payload(page).K);
  const saved = page.url();
  await handsPanel(page).click();
  await expect(page.getByRole('button', { name: 'Sur mesure', exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Pigment luminescent' }).getByRole('button', { pressed: true }),
  ).toHaveCount(1);
  await closePanel(page);
  expect(page.url()).toBe(saved);
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Hand settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Custom', exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'BGW9', exact: true }).click();
  await page.getByRole('button', { name: 'Close colors', exact: true }).click();
  expect(payload(page)).toMatchObject({ K: 'bgw9', as: '#EDF1E9', at: '#65CAFF' });
});

import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(90_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) => linkPayload(page.url());
const handChoice = (page: Page, part: string, name: string) =>
  page
    .getByRole('radiogroup', { name: `Dessin des ${part}`, exact: true })
    .getByRole('radio', { name, exact: true });
const closePanel = (page: Page) =>
  page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
async function bezelRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 25; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.match(/^cell-bezel-(?!scale-)/)) return;
    await page.keyboard.press('ArrowUp');
  }
  throw new Error('Ligne lunette introuvable');
}
test('les heures et minutes se règlent séparément, se rétablissent et se partagent', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  const saved = page.url();
  const open = () =>
    page.getByRole('button', { name: 'Paramètres des aiguilles', exact: true }).click();
  await open();
  await handChoice(page, 'heures', 'Trois branches').click();
  await handChoice(page, 'minutes', 'Crayon').click();
  await handChoice(page, 'heures', 'Trois branches').press('Home');
  await expect(handChoice(page, 'heures', 'Suivre le jeu choisi')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await handChoice(page, 'heures', 'Suivre le jeu choisi').press('End');
  await expect(handChoice(page, 'heures', 'Trois branches')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('slider', { name: 'Longueur des heures', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Largeur des minutes', exact: true }).press('End');
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(handChoice(page, 'heures', 'Suivre le jeu choisi')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('slider', { name: 'Longueur des heures', exact: true })).toHaveValue(
    '1',
  );
  await handChoice(page, 'heures', 'Trois branches').click();
  await handChoice(page, 'minutes', 'Crayon').click();
  await page
    .getByRole('dialog')
    .locator('.body')
    .evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `documentation/part-adjustments/hands-panel-${info.project.name}.png`,
  });
  await closePanel(page);
  expect(payload(page)).toMatchObject({
    au: { style: 'mercedes', length: 1, width: 1 },
    av: { style: 'pencil', length: 1, width: 1 },
  });
  const shared = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(shared);
  await open();
  await expect(handChoice(page, 'heures', 'Trois branches')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(handChoice(page, 'minutes', 'Crayon')).toHaveAttribute('aria-checked', 'true');
  await closePanel(page);
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowRight');
  expect(payload(page).au).toBeUndefined();
  expect(payload(page).av).toBeUndefined();
  expect(errors).toEqual([]);
});
test('la lunette garde ses paramètres indépendants et masque la forme pendant la rotation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ a: 2, x: '#18334C', w: 17 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await bezelRow(page);
  const saved = page.url();
  const open = () =>
    page.getByRole('button', { name: 'Paramètres de la lunette', exact: true }).click();
  await open();
  await page
    .getByRole('group', { name: 'Forme de la lunette', exact: true })
    .getByRole('button', { name: 'Ronde', exact: true })
    .click();
  await page.getByRole('slider', { name: 'Largeur de la lunette', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Hauteur de la lunette', exact: true }).press('End');
  await page
    .getByRole('group', { name: 'Finition de la lunette', exact: true })
    .getByRole('button', { name: 'Polie', exact: true })
    .click();
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Forme de la lunette', exact: true })
      .getByRole('button', { name: 'Suivre le boîtier', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('slider', { name: 'Largeur de la lunette', exact: true }),
  ).toHaveValue('1');
  await page
    .getByRole('group', { name: 'Forme de la lunette', exact: true })
    .getByRole('button', { name: 'Ronde', exact: true })
    .click();
  await page
    .getByRole('slider', { name: 'Largeur de la lunette', exact: true })
    .press('ArrowRight');
  await page
    .getByRole('group', { name: 'Finition de la lunette', exact: true })
    .getByRole('button', { name: 'Polie', exact: true })
    .click();
  await page.screenshot({
    path: `documentation/part-adjustments/bezel-panel-${info.project.name}.png`,
  });
  await closePanel(page);
  expect(payload(page)).toMatchObject({ a: 2, aw: 'round', ax: 1.01, az: 'polished' });
  const shared = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(shared);
  await bezelRow(page);
  await page.keyboard.press('End');
  await open();
  await expect(page.getByRole('group', { name: 'Forme de la lunette', exact: true })).toHaveCount(
    0,
  );
  await closePanel(page);
  await page.getByRole('grid').focus();
  await page.keyboard.press('Home');
  await open();
  await expect(
    page
      .getByRole('group', { name: 'Forme de la lunette', exact: true })
      .getByRole('button', { name: 'Ronde', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await closePanel(page);
  expect(errors).toEqual([]);
});
test('les nouvelles compositions se rendent de face et de trois quarts', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-11-24T10:10:30'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, config] of [
    [
      'dive',
      {
        n: 7,
        p: 2,
        x: '#111317',
        A: 9,
        C: 'c3',
        K: 'c3',
        au: { style: 'mercedes', length: 1, width: 1 },
        av: { style: 'pencil', length: 1, width: 1 },
        s: 1,
      },
    ],
    [
      'octagon',
      { x: '#18334C', w: 17, aw: 'octagon', ax: 1.2, ay: 1.2, az: 'brushed', I: 1, L: 11 },
    ],
    [
      'cushion-round',
      { a: 2, x: '#1F4D3A', w: 3, aw: 'round', ax: 1.05, ay: 1.2, az: 'polished', L: 11 },
    ],
  ] as const) {
    await page.goto(link(config));
    await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
    const grid = page.getByRole('grid');
    await grid.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toBeVisible();
    await expect(grid).toHaveAttribute('aria-busy', 'false');
    const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
    if (await card.count()) await card.click();
    await grid.focus();
    await page.keyboard.press('1');
    await page.waitForTimeout(650);
    await page.screenshot({
      path: `documentation/part-adjustments/${name}-${info.project.name}.png`,
    });
    await page.keyboard.press('5');
    await page.waitForTimeout(650);
    await page.screenshot({
      path: `documentation/part-adjustments/${name}-quarter-${info.project.name}.png`,
    });
    await page.keyboard.press('Escape');
    await expect(grid).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});

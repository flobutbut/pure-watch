import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';

test.setTimeout(90_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) => linkPayload(page.url());
async function bezelRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 25; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.match(/^cell-bezel-(?!scale-)/)) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-bezel-(?!scale-)/);
}

test('la lunette fixe partage ses graduations et sa couleur sans proposer de rotation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ a: 5, aa: 5, ai: 42 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await bezelRow(page);
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-fixed-scale',
  );
  expect(payload(page)).toMatchObject({ n: 10, a: 5, aa: 5, ai: 42 });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-fixed-bezel-scale-tachymeter',
  );
  for (const [i, [scale, id]] of [
    ['tachymeter', 5],
    ['dive-60', 2],
    ['12h', 3],
    ['24h', 4],
  ].entries()) {
    if (i) await page.keyboard.press('ArrowRight');
    else {
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Home');
    }
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      `cell-fixed-bezel-scale-${scale}`,
    );
    expect(payload(page).p).toBe(id);
  }
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Paramètres de la lunette', exact: true }).click();
  await (await hexField(page)).fill('#3A6382');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({ n: 10, p: 5, q: '#3A6382' });
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Régler la lunette', exact: true })).toHaveCount(0);
  const grid = page.getByRole('grid');
  await grid.focus();
  await page.keyboard.press('b');
  await page.keyboard.press('ArrowRight');
  expect(payload(page).ai).toBe(42);
  await page.keyboard.press('Escape');
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(0);
  await bezelRow(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-bezel-scale-dive-60');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-fixed-bezel-scale-tachymeter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Home');
  expect(payload(page)).toMatchObject({ a: 5, aa: 5, q: '#3A6382', p: 5 });
  await expect(
    page.getByRole('button', { name: 'Paramètres de la lunette', exact: true }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('tachymètre extérieur et insert clair se rendent sur des boîtiers différents', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, config] of [
    [
      'chronograph',
      {
        b: 42,
        c: 13.54,
        d: 47.5,
        f: 2,
        j: 1,
        m: 0,
        n: 10,
        p: 5,
        q: '#111317',
        s: 5,
        x: '#121416',
        z: 4,
        I: 8,
        J: 'lacquer',
        L: 1,
        M: '#F3F1E8',
        N: 0,
        O: [{ type: 'chronograph', position: 'tricompax', counters: 'black', pushers: 'round' }],
      },
    ],
    ['rectangle-light', { a: 6, aa: 6, n: 10, p: 3, q: '#EAE6DC', x: '#1F4D3A', L: 11 }],
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
      path: `documentation/fixed-bezel/${name}-${info.project.name}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('5');
    await page.waitForTimeout(650);
    await page.screenshot({
      path: `documentation/fixed-bezel/${name}-quarter-${info.project.name}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(grid).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});

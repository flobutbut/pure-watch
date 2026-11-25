import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(90_000);
const payload = (page: Page) => linkPayload(page.url());
async function bezelRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 18; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-bezel-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-bezel-/);
}

test('les six lunettes se sélectionnent et se partagent avant la ligne Cristal', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/#v1.' + Buffer.from(JSON.stringify({ a: 5, aa: 5, x: '#123ABC' })).toString('base64url'),
  );
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await bezelRow(page);
  await page.keyboard.press('Home');
  for (const [index, [type, id]] of [
    ['smooth', undefined],
    ['rounded', 8],
    ['stepped', 9],
    ['fluted', 5],
    ['coin', 4],
    ['notched', 6],
  ].entries()) {
    if (index) await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      `cell-bezel-${type}`,
    );
    expect(payload(page).n).toBe(id);
    expect(payload(page)).toMatchObject({ a: 5, aa: 5, x: '#123ABC' });
  }
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await bezelRow(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-notched',
  );
  expect(page.url()).toBe(saved);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', /cell-crystal-/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('la lunette reste disponible avec une ouverture ronde ajustée au rectangle', async ({
  page,
}) => {
  const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
  await page.goto(link({ n: 5 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await bezelRow(page);
  await page.evaluate(
    (url) => {
      location.hash = url.split('#')[1]!;
    },
    link({ a: 6, n: 5, ag: 1 }),
  );
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-fluted',
  );
  expect(payload(page)).toMatchObject({ a: 6, n: 5, ag: 1 });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', /cell-crystal-/);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-fluted',
  );
});

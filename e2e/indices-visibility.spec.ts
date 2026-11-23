import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);
const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const payload = (page: Page) =>
  JSON.parse(Buffer.from(page.url().split('#v1.')[1]!, 'base64url').toString());
async function numeralsRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 3; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-numerals-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-numerals-/);
}

test('la ligne Index disparaît avec tous les chiffres et retrouve le choix mémorisé', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(link({ A: 6 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  const grid = page.getByRole('grid');
  const indices = page.getByRole('row', { name: 'Index', exact: true });
  await numeralsRow(page);
  await expect(indices).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-roman');
  await expect(indices).toHaveCount(0);
  expect(payload(page).A).toBe(6);
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-chapter-ring-railroad');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-roman');
  await page.keyboard.press('Home');
  await expect(indices).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-baguettes');
  await page.keyboard.press('End');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-none');
  await expect(indices).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-all');
  await expect(indices).toHaveCount(0);
  expect(payload(page).A).toBe(8);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(indices).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-none');
  expect(errors).toEqual([]);
});

test('un lien avec index masqués se recharge et restaure les index avec des chiffres partiels', async ({
  page,
}) => {
  await page.goto(link({ A: 5, D: 2 }));
  const grid = page.getByRole('grid');
  const indices = page.getByRole('row', { name: 'Index', exact: true });
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await numeralsRow(page);
  await expect(indices).toHaveCount(0);
  const saved = page.url();
  await page.reload();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  expect(page.url()).toBe(saved);
  await numeralsRow(page);
  await expect(indices).toHaveCount(0);
  await page.goto(link({ A: 5, D: 3 }));
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-numerals-cardinal');
  await expect(indices).toHaveCount(1);
  await grid.focus();
  await page.keyboard.press('ArrowUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-indices-triangles');
  expect(payload(page)).toMatchObject({ A: 5, D: 3 });
  await page.goto(link({ A: 5, D: 2 }));
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await expect(indices).toHaveCount(0);
  expect(payload(page)).toMatchObject({ A: 5, D: 2 });
});

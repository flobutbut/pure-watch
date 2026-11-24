import { expect, test, type Page } from '@playwright/test';
import { hexField } from './hex';
test.setTimeout(90_000);
const hash = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const payload = (page: Page) =>
  JSON.parse(Buffer.from(page.url().split('#v1.')[1]!, 'base64url').toString());
async function dialRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 18; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-finish-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-dial-finish-/);
}

test('les finitions conservent couleur, forme et lien partagé', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(hash({ a: 5, aa: 5, x: '#123ABC' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await dialRow(page);
  await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  const choices = [
    ['guilloche', 4],
    ['clous-de-paris', 10],
    ['linen', 11],
    ['concentric', 12],
    ['vertical-brushed', 13],
    ['hammered', 14],
    ['leather', 15],
    ['circular-brushed', 16],
    ['tapisserie', 17],
    ['waves', 18],
    ['scales', 19],
  ] as const;
  for (const [index, [finish, id]] of choices.entries()) {
    if (index) await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      `cell-dial-finish-${finish}`,
    );
    await expect(
      page.getByRole('button', { name: 'Couleur du cadran', exact: true }),
    ).toHaveAttribute('data-color', '#123ABC');
    expect(payload(page)).toMatchObject({ a: 5, aa: 5, x: '#123ABC', w: id });
  }
  const saved = page.url();
  await page.reload();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await dialRow(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-finish-scales',
  );
  expect(page.url()).toBe(saved);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('la couleur libre du lin se prévisualise et survit au passage par une teinte naturelle', async ({
  page,
}) => {
  await page.goto(hash({ w: 11, x: '#19476B' }));
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await dialRow(page);
  const trigger = page.getByRole('button', { name: 'Couleur du cadran', exact: true });
  const saved = page.url();
  await trigger.click();
  await (await hexField(page)).fill('#DAB988');
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(page.url()).toBe(saved);
  await trigger.click();
  await (await hexField(page)).fill('#DAB988');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({ w: 11, x: '#DAB988' });
  await page.getByRole('grid').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(trigger).toHaveCount(0);
  await expect(page.getByText('Teinte naturelle', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-finish-guilloche',
  );
  await expect(trigger).toHaveAttribute('data-color', '#DAB988');
});

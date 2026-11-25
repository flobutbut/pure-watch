import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
test.setTimeout(90_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) => linkPayload(page.url());
async function opening(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 22; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-size-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-dial-size-/);
}
test('les trois ouvertures se partagent et conservent le boîtier, le réhaut et les couleurs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ a: 3, x: '#F2F0EA', ac: 3, ad: 3, ae: '#173548', af: 3, n: 9 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  await opening(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-size-open',
  );
  await page.keyboard.press('Home');
  for (const [i, size] of ['compact', 'balanced', 'open'].entries()) {
    if (i) await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-activedescendant',
      `cell-dial-size-${size}`,
    );
    expect(payload(page).ag).toBe(i === 2 ? undefined : i + 1);
    expect(payload(page)).toMatchObject({
      a: 3,
      x: '#F2F0EA',
      ac: 3,
      ad: 3,
      ae: '#173548',
      af: 3,
      n: 9,
    });
  }
  await page.keyboard.press('Home');
  const saved = page.url();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-shape-round',
  );
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    /cell-dial-finish-/,
  );
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  await opening(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-size-compact',
  );
  expect(page.url()).toBe(saved);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await page.keyboard.press('5');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

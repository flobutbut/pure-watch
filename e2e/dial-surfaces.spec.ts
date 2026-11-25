import { expect, test } from '@playwright/test';
import { linkPayload } from './link';

test.setTimeout(60_000);
for (const [finish, id] of [
  ['leather', 15],
  ['circular-brushed', 16],
  ['tapisserie', 17],
  ['waves', 18],
  ['scales', 19],
] as const) {
  test(`${finish} se rend en clair et en sombre`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [tone, color] of [
      ['dark', '#1F4D3A'],
      ['light', '#EAE6DC'],
    ] as const) {
      const hash = Buffer.from(JSON.stringify({ w: id, x: color, L: 11 })).toString('base64url');
      await page.goto('/#v1.' + hash);
      await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
      const grid = page.getByRole('grid');
      await grid.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Fermer la vue 3D', exact: true }),
      ).toBeVisible();
      await expect(grid).toHaveAttribute('aria-busy', 'false');
      const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
      if (await card.count()) await card.click();
      await grid.focus();
      await page.keyboard.press('1');
      await page.keyboard.press('p');
      await page.waitForTimeout(650);
      await page.screenshot({
        path: `documentation/dial-surfaces/${finish}-${tone}-${info.project.name}.png`,
        animations: 'disabled',
      });
      const payload = linkPayload(page.url());
      expect(payload).toMatchObject({ w: id, x: color });
      await grid.focus();
      await page.keyboard.press('Escape');
      await expect(grid).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
        0,
      );
    }
    expect(errors).toEqual([]);
  });
}

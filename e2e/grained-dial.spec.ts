import { expect, test } from '@playwright/test';
import { linkPayload } from './link';

test.setTimeout(60_000);
test('le grain reste utilisable sur coussin et rond, avec des teintes sombres et claires', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, shape, color] of [
    ['cushion-green', 2, '#1F4D3A'],
    ['round-cream', 1, '#EAE6DC'],
    ['round-black', 1, '#17191D'],
  ] as const) {
    const hash =
      '#v1.' +
      Buffer.from(JSON.stringify({ a: shape, w: 3, x: color, L: 11 })).toString('base64url');
    await page.goto('/' + hash);
    await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
    const grid = page.getByRole('grid');
    await grid.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
      1,
    );
    await expect(grid).toHaveAttribute('aria-busy', 'false');
    const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
    if (await card.count()) await card.click();
    await grid.focus();
    await page.keyboard.press('1');
    await page.keyboard.press('p');
    await page.waitForTimeout(650);
    await page.screenshot({
      path: `documentation/grained-dial/${name}-${info.project.name}.png`,
      animations: 'disabled',
    });
    const payload = linkPayload(page.url());
    expect(payload.w).toBe(3);
    expect(payload.x).toBe(color);
    await grid.focus();
    await page.keyboard.press('Escape');
    await expect(grid).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});

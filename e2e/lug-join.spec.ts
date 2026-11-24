import { expect, test, type Page } from '@playwright/test';
test.setTimeout(90_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) =>
  JSON.parse(Buffer.from(page.url().split('#v1.')[1]!, 'base64url').toString());
async function lugRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 25; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-lugs-')) return;
    await page.keyboard.press('ArrowUp');
  }
  throw new Error('Ligne Cornes introuvable');
}
test('le raccord se prévisualise, se rétablit, se partage et reste mémorisé sans cornes', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ x: '#18334C', w: 17 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await lugRow(page);
  const saved = page.url();
  const button = page.getByRole('button', { name: 'Paramètres des cornes', exact: true });
  await button.click();
  await page.getByRole('button', { name: 'Affleurant', exact: true }).click();
  expect(page.url()).toBe(saved);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Détaché', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fondu', exact: true }).click();
  await page.waitForTimeout(550);
  await page.screenshot({ path: `documentation/lug-join/panel-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).ba).toBe(3);
  const shared = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(shared);
  await lugRow(page);
  await button.click();
  await expect(page.getByRole('button', { name: 'Fondu', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await page.getByRole('grid').focus();
  await page.keyboard.press('End');
  await expect(button).toHaveCount(0);
  expect(payload(page).ba).toBe(3);
  await page.keyboard.press('Home');
  await button.click();
  await expect(page.getByRole('button', { name: 'Fondu', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(errors).toEqual([]);
});
for (const [name, shape, style] of [
  ['round', 1, 1],
  ['cushion', 2, 2],
  ['square', 5, 4],
] as const) {
  test(`${name}: comparaison des trois raccords`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date('2026-11-24T10:10:30'));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [mode, ba] of [
      ['detached', 1],
      ['flush', 2],
      ['blended', 3],
    ] as const) {
      await page.goto(link({ a: shape, f: style, ba, x: '#18334C', w: 17, I: 1, L: 11 }));
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
      await page.keyboard.press('5');
      await page.waitForTimeout(650);
      await page.screenshot({
        path: `documentation/lug-join/${name}-${mode}-${info.project.name}.png`,
      });
      if (name === 'round') {
        if (mode === 'blended') {
          await page.keyboard.press('1');
          await page.waitForTimeout(650);
          await page.screenshot({
            path: `documentation/lug-join/round-blended-face-${info.project.name}.png`,
          });
        }
        await page.keyboard.press('2');
        await page.waitForTimeout(650);
        await page.screenshot({
          path: `documentation/lug-join/${name}-${mode}-profile-${info.project.name}.png`,
        });
      }
      await page.keyboard.press('Escape');
      await expect(grid).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(
        0,
      );
    }
    expect(errors).toEqual([]);
  });
}

test('raccord fondu sur la configuration signalée : vue de face dégagée', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(new Date('2026-11-24T10:10:30'));
  await page.goto(
    link({
      p: 5,
      q: '#111317',
      w: 9,
      x: '#0B152A',
      z: 4,
      A: 4,
      B: 'printed',
      D: 4,
      I: 4,
      an: 0.98,
      ba: 3,
      am: 1.21,
    }),
  );
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  const grid = page.getByRole('grid');
  await grid.focus();
  await page.keyboard.press('Enter');
  await expect(grid).toHaveAttribute('aria-busy', 'false');
  const card = page.getByRole('button', { name: 'Masquer la fiche d’identité', exact: true });
  if (await card.count()) await card.click();
  await grid.focus();
  await page.keyboard.press('1');
  await page.waitForTimeout(650);
  await page.screenshot({ path: `documentation/lug-join/reported-face-${info.project.name}.png` });
});

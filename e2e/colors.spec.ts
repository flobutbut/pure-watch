import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';

test.setTimeout(60_000);
const payload = (page: Page) => linkPayload(page.url());
async function dialRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 18; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-finish-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /cell-dial-finish-/);
}

test('le cadran se prévisualise, s’annule et se partage avec une teinte libre', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?pilot=cushion');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await dialRow(page);
  const trigger = page.getByRole('button', { name: 'Couleur du cadran', exact: true });
  const original = page.url();
  const background = await page.locator('html').getAttribute('style');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await (await hexField(page)).fill('#7C3AED');
  await expect(page.locator('html')).not.toHaveAttribute('style', background!);
  expect(page.url()).toBe(original);
  await expect(page.locator('.live canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(original);
  await expect(page.locator('html')).toHaveAttribute('style', background!);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await (await hexField(page)).fill('#7C3AED');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `documentation/colors-review/${info.project.name}-dial.png` });
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).x).toBe('#7C3AED');
  const saved = page.url();
  await page.reload();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-hands-dauphine',
  );
  await dialRow(page);
  await expect(trigger).toHaveAttribute('data-color', '#7C3AED');
  await trigger.click();
  await expect(await hexField(page)).toHaveValue('#7C3AED');
  await expect(
    page
      .getByRole('group', { name: 'Couleurs récentes' })
      .getByRole('button', { name: 'Réutiliser #7C3AED' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(saved);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-chapter-ring-ticks',
  );
  expect(errors).toEqual([]);
});

test('métal, laque et trotteuse assortie se retrouvent après rechargement', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  const hands = page.getByRole('button', { name: 'Paramètres des aiguilles', exact: true });
  await hands.click();
  await page.getByRole('button', { name: 'Or', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Code HEX' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).J).toBe('gold');
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }).click();
  await page.getByRole('button', { name: 'Assortie aux aiguilles', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowUp');
  await hands.click();
  await page.getByRole('button', { name: 'Laqué', exact: true }).click();
  await (await hexField(page)).fill('#B83D91');
  await expect
    .poll(async () => {
      const field = await page.getByRole('textbox', { name: 'Code HEX' }).boundingBox();
      const body = await page.locator('dialog[open] .body').boundingBox();
      return field !== null && body !== null && field.y + field.height <= body.y + body.height;
    })
    .toBe(true);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `documentation/colors-review/${info.project.name}-hands.png` });
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page)).toMatchObject({ J: 'lacquer', ab: '#B83D91', M: 'match' });
  await page.reload();
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await expect(hands).toHaveAttribute('data-color', '#B83D91');
  await hands.click();
  await expect(page.getByRole('button', { name: 'Laqué', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(await hexField(page)).toHaveValue('#B83D91');
});

test('les champs et le clavier restent dans le panneau, un code invalide ne s’applique pas', async ({
  page,
}) => {
  await page.goto('/');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await grid.focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Paramètres des aiguilles', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Laqué', exact: true }).click();
  const spectrum = page.getByRole('button', { name: /^Saturation/ });
  await spectrum.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await (await hexField(page)).fill('#GG0000');
  await expect(page.getByRole('textbox', { name: 'Code HEX' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await (await hexField(page)).fill('abc');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(payload(page).ab).toBe('#AABBCC');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toHaveCount(0);
});

test('la teinte naturelle remplace le réglage sans perdre la couleur personnelle', async ({
  page,
}) => {
  await page.goto(`/#v1.${Buffer.from(JSON.stringify({ x: '#124578' })).toString('base64url')}`);
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await dialRow(page);
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-finish-iridescent-oil',
  );
  await expect(page.getByRole('button', { name: 'Couleur du cadran', exact: true })).toHaveCount(0);
  await expect(page.getByText('Teinte naturelle', { exact: true })).toBeVisible();
  await page.keyboard.press('Home');
  await page.getByRole('button', { name: 'Couleur du cadran', exact: true }).click();
  await expect(await hexField(page)).toHaveValue('#124578');
  expect(payload(page).x).toBe('#124578');
});

test('la palette se glisse avec un aperçu avant le relâchement et laisse la montre visible', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await dialRow(page);
  await page.getByRole('button', { name: 'Couleur du cadran', exact: true }).click();
  const before = await page.locator('html').getAttribute('style');
  const spectrum = await page.getByRole('button', { name: /^Saturation/ }).boundingBox();
  expect(spectrum).not.toBeNull();
  await page.mouse.move(spectrum!.x + spectrum!.width * 0.8, spectrum!.y + spectrum!.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(spectrum!.x + spectrum!.width * 0.6, spectrum!.y + spectrum!.height * 0.2, {
    steps: 6,
  });
  await expect(page.locator('html')).not.toHaveAttribute('style', before!);
  await page.mouse.up();
  // The watch deliberately moves while the sheet opens; assess its settled position.
  await expect
    .poll(async () => {
      const watch = (await page.locator('.live-slot').boundingBox())!;
      const panel = (await page.getByRole('dialog').boundingBox())!;
      return (
        Math.min(watch.x + watch.width, panel.x + panel.width) > Math.max(watch.x, panel.x) &&
        Math.min(watch.y + watch.height, panel.y + panel.height) > Math.max(watch.y, panel.y)
      );
    })
    .toBe(false);
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
});

import { expect, test } from '@playwright/test';

const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;

// These are independent fixtures for the immutable v1 wire identifiers.
test('le lien suit les choix, se recharge et se partage dans un autre onglet', async ({
  page,
  context,
}) => {
  await page.goto('/?pilot=black');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
  await expect(page).toHaveURL(/#v1\./);
  expect(new URL(page.url()).searchParams.has('pilot')).toBe(false);
  await grid.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-lollipop');
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-arrow');
  await page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }).click();
  await page.getByRole('button', { name: 'Assortie aux aiguilles' }).click();
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  const shared = page.url();
  await page.reload();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-seconds-arrow');
  await page.getByRole('button', { name: 'Couleur de la trotteuse', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assortie aux aiguilles' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(page.url()).toBe(shared);
  const other = await context.newPage();
  await other.goto(shared);
  await expect(other.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  expect(other.url()).toBe(shared);
  await other.close();
});

test('naviguer entre les lignes ne réécrit pas les valeurs personnalisées du lien', async ({
  page,
}) => {
  await page.goto(link({ x: '#123abc' }));
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  const original = page.url();
  await grid.focus();
  for (let i = 0; i < 12; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-dial-finish-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-dial-finish-matte');
  await expect(
    page.getByRole('button', { name: 'Couleur du cadran', exact: true }),
  ).toHaveAttribute('data-color', '#123abc');
  expect(page.url()).toBe(original);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('précédent et suivant restaurent les configurations des liens', async ({ page }) => {
  await page.goto('/#v1.e30');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await page.goto(link({ I: 1 }));
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
  await page.goBack();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await page.goForward();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
});

test('un lien mal formé affiche un message et une montre utilisable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#v1.!!!');
  await expect(page.getByRole('status')).toContainText('invalide');
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await grid.focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-leaf');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('les options inconnues sont remplacées sans perdre les autres choix', async ({ page }) => {
  await page.goto(link({ a: 2, I: 999, x: '#bad' }));
  await expect(page.getByRole('status')).toContainText('Certaines options');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', 'cell-hands-sword');
  await page.reload();
  await expect(page.getByRole('status')).toHaveCount(0);
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('PageUp');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-shape-cushion');
});

test('un choix masqué reste mémorisé lorsque la ligne réapparaît', async ({ page }) => {
  await page.goto(link({ a: 3, g: 6, h: 3, I: 1 }));
  const grid = page.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-hands-baton');
  await grid.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageUp');
  for (let i = 0; i < 6; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-case-material-'))
      break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-material-ceramic');
  await page.keyboard.press('Home');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-material-steel');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-activedescendant', 'cell-case-finish-polished');
});

test('le comparateur ouvre la configuration sélectionnée, pas seulement le pilote', async ({
  page,
}) => {
  await page.goto('/review.html?pilot=black&scope=hands&hands=leaf');
  const open = page.getByRole('link', { name: 'Ouvrir le pilote dans le configurateur' });
  await expect(open).toHaveAttribute('href', /#v1\./);
  const initial = await open.getAttribute('href');
  await page.locator('#hand-set').selectOption('breguet');
  await expect(open).not.toHaveAttribute('href', initial!);
  await open.click();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-hands-breguet',
  );
  expect(new URL(page.url()).searchParams.has('pilot')).toBe(false);
});

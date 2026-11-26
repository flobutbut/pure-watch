import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';

test.setTimeout(90_000);
const link = (payload: object) =>
  `/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
async function markersRow(page: Page) {
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-activedescendant', /^cell-numerals-/);
}
const open = (page: Page) =>
  page.getByRole('button', { name: 'Repères horaires', exact: true }).click();
const close = (page: Page) =>
  page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();

test('un seul panneau conserve police, index et finitions à travers les dispositions et le rechargement', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ A: 6, E: 4, B: 'printed', ap: '#E8CC99' }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await markersRow(page);
  await expect(page.getByRole('row', { name: 'Index', exact: true })).toHaveCount(0);
  await expect(page.getByRole('row', { name: 'Style des chiffres', exact: true })).toHaveCount(0);
  await page.keyboard.press('End');
  await open(page);
  await expect(page.getByRole('radio', { name: 'Serif classique', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Index', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Baguettes', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Points', exact: true }).click();
  await close(page);
  expect(linkPayload(page.url())).toMatchObject({ A: 4, D: 2, E: 4, B: 'printed', ap: '#E8CC99' });
  await page.getByRole('grid').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await open(page);
  await page.getByRole('radio', { name: 'Index', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Points', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await close(page);
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  expect(errors).toEqual([]);
});

test('le cadran par heure ajoute un chiffre, retire un repère et rétablit les choix des deux onglets', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ D: 8, B: 'printed', O: [{ type: 'small-seconds', position: '6h' }] }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await markersRow(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-numerals-even',
  );
  await open(page);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `documentation/hour-markers/layout-${info.project.name}.png`,
    animations: 'disabled',
  });
  await page.getByRole('radio', { name: 'Art déco', exact: true }).click();
  await page.getByRole('radio', { name: 'Index', exact: true }).click();
  await page.getByRole('radio', { name: 'Points', exact: true }).click();
  await page.getByText('Personnaliser les heures', { exact: true }).click();
  await page.getByRole('button', { name: '1 h · Index', exact: true }).click();
  const kinds = page.getByRole('radiogroup', { name: 'Repère à cette heure', exact: true });
  await kinds.getByRole('radio', { name: 'Chiffre', exact: true }).click();
  await page.getByRole('button', { name: '2 h · Chiffre', exact: true }).click();
  await kinds.getByRole('radio', { name: 'Aucun', exact: true }).click();
  await page.getByRole('button', { name: '6 h · Chiffre', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Une complication occupe cette heure' }),
  ).toBeVisible();
  // The panel previews are throttled; let the new glyph textures reach the canvas.
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `documentation/hour-markers/hours-${info.project.name}.png`,
    animations: 'disabled',
  });
  await close(page);
  expect(linkPayload(page.url())).toMatchObject({
    D: 8,
    A: 4,
    E: 7,
    bf: { hourMarkers: { '1': 'numeral', '2': 'none' } },
  });
  await expect(page.locator('.label.active .label-variant')).toHaveText('Personnalisé');
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await markersRow(page);
  await open(page);
  await page.getByRole('radio', { name: 'Romains', exact: true }).click();
  await page.getByRole('radio', { name: 'Index', exact: true }).click();
  await page.getByRole('radio', { name: 'Triangles', exact: true }).click();
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Points', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Chiffres', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Arabes', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Art déco', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await close(page);
  expect(page.url()).toBe(saved);
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowRight');
  expect(linkPayload(page.url())).not.toHaveProperty('bf.hourMarkers');
  expect(linkPayload(page.url())).toMatchObject({ A: 4, E: 7 });
  expect(errors).toEqual([]);
});

test('les anciens index par heure restent modifiables et peuvent céder leur place à un chiffre', async ({
  page,
}) => {
  await page.goto(
    link({ bf: { indices: { '12': { style: 'triangles', finish: 'applied-gold' } } } }),
  );
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await markersRow(page);
  await open(page);
  await page.getByText('Personnaliser les heures', { exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'Personnaliser ce repère', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page
    .getByRole('radiogroup', { name: 'Repère à cette heure' })
    .getByRole('radio', { name: 'Chiffre', exact: true })
    .click();
  await close(page);
  expect(linkPayload(page.url())).toMatchObject({
    bf: {
      indices: { '12': { style: 'triangles', finish: 'applied-gold' } },
      hourMarkers: { '12': 'numeral' },
    },
  });
});

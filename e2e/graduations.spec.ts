import { expect, test, type Page } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';

test.setTimeout(90_000);
const link = (payload: object) =>
  '/#v1.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
async function seek(page: Page, id: string) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 22; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith(`cell-${id}-`)) break;
    await page.keyboard.press('ArrowUp');
    await expect(grid).not.toHaveAttribute('aria-activedescendant', active!);
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', new RegExp(`^cell-${id}-`));
}
async function slider(page: Page, name: string, value: number) {
  await page.getByRole('slider', { name, exact: true }).evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
const close = (page: Page) =>
  page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();

test('la piste garde sa ligne, son style et ses réglages sans modifier le réhaut', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ ac: 2, af: 4, z: 1, bf: { rehaut: { ink: '#C9A24A', lineWidth: 1.3 } } }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await seek(page, 'chapter-ring');
  const trigger = page.getByRole('button', { name: 'Piste des minutes', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Piste des minutes', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Aucune', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Bâtons', exact: true }).click();
  await slider(page, 'Longueur des petites graduations', 0.65);
  await slider(page, 'Épaisseur des petites graduations', 0.8);
  await slider(page, 'Longueur des grandes graduations', 1.4);
  await slider(page, 'Épaisseur des grandes graduations', 1.6);
  await slider(page, 'Position de la piste', 0.85);
  await page.getByRole('radio', { name: 'Couleur libre', exact: true }).click();
  await (await hexField(page)).fill('#C92750');
  await page.getByRole('radio', { name: 'Les quatre quarts', exact: true }).click();
  await page.locator('dialog .body').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `documentation/graduations/minutes-${info.project.name}.png`,
    animations: 'disabled',
  });
  await close(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-chapter-ring-ticks',
  );
  expect(linkPayload(page.url())).toMatchObject({
    z: 4,
    be: '#C92750',
    af: 4,
    bf: {
      chapterRing: {
        minor: { length: 0.65, lineWidth: 0.8 },
        major: { length: 1.4, lineWidth: 1.6 },
        radius: 0.85,
        accentAt: 'quarters',
      },
      rehaut: { ink: '#C9A24A', lineWidth: 1.3 },
    },
  });
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await seek(page, 'chapter-ring');
  await trigger.click();
  await page.getByRole('radio', { name: 'Points', exact: true }).click();
  await slider(page, 'Taille des petits points', 0.35);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Bâtons', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(
    page.getByRole('slider', { name: 'Longueur des petites graduations', exact: true }),
  ).toHaveValue('0.65');
  await expect(
    page.getByRole('slider', { name: 'Longueur des grandes graduations', exact: true }),
  ).toHaveValue('1.4');
  await close(page);
  expect(page.url()).toBe(saved);
  await page.getByRole('grid').focus();
  await page.keyboard.press('Home');
  await expect(trigger).toHaveCount(1);
  expect(linkPayload(page.url())).toMatchObject({
    af: 4,
    be: '#C92750',
    bf: { chapterRing: { major: { length: 1.4 } } },
  });
  expect(errors).toEqual([]);
});

test('les graduations du réhaut ont leur panneau et préservent sa matière et la piste', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    link({
      ac: 3,
      af: 1,
      ad: 3,
      ae: '#19476B',
      z: 3,
      be: '#F2F1EC',
      bf: { chapterRing: { dotSize: 0.5 } },
    }),
  );
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await seek(page, 'rehaut');
  const trigger = page.getByRole('button', { name: 'Paramètres du réhaut', exact: true });
  await trigger.click();
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: '24 heures', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Couleur des inscriptions', exact: true })
    .getByRole('radio', { name: 'Couleur libre', exact: true })
    .click();
  await (
    await hexField(page, page.getByRole('region', { name: 'Graduations', exact: true }))
  ).fill('#C9A24A');
  await slider(page, 'Longueur des traits', 1.3);
  await slider(page, 'Épaisseur des traits', 1.4);
  await slider(page, 'Taille des inscriptions', 1.2);
  await page.getByRole('radio', { name: 'Les quatre quarts', exact: true }).click();
  await page.locator('dialog .body').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `documentation/graduations/rehaut-${info.project.name}.png`,
    animations: 'disabled',
  });
  await close(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-rehaut-concave',
  );
  expect(linkPayload(page.url())).toMatchObject({
    ac: 3,
    ad: 3,
    ae: '#19476B',
    af: 4,
    z: 3,
    be: '#F2F1EC',
    bf: {
      chapterRing: { dotSize: 0.5 },
      rehaut: {
        ink: '#C9A24A',
        tickLength: 1.3,
        lineWidth: 1.4,
        labelSize: 1.2,
        accentAt: 'quarters',
      },
    },
  });
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  expect(page.url()).toBe(saved);
  await seek(page, 'rehaut');
  await trigger.click();
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: 'Tachymètre', exact: true }).click();
  await slider(page, 'Longueur des traits', 0.6);
  await page.getByRole('radio', { name: 'Biseauté', exact: true }).click();
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(page.getByRole('radio', { name: '24 heures', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('slider', { name: 'Longueur des traits', exact: true })).toHaveValue(
    '1.3',
  );
  await expect(page.getByRole('radio', { name: 'Concave', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await close(page);
  expect(page.url()).toBe(saved);
  await trigger.click();
  await page.getByRole('region', { name: 'Graduations', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: 'Sans graduations', exact: true }).click();
  await close(page);
  expect(linkPayload(page.url()).af).toBeUndefined();
  await expect(trigger).toHaveCount(1);
  await page.getByRole('grid').focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('row', { name: 'Paramètres du réhaut', exact: true })).toHaveCount(0);
  expect(linkPayload(page.url())).toMatchObject({
    z: 3,
    be: '#F2F1EC',
    bf: { rehaut: { tickLength: 1.3 } },
  });
  expect(errors).toEqual([]);
});

test('changer le style depuis le panneau en aperçu synchronise la grille et le lien', async ({
  page,
}) => {
  await page.goto(link({ ac: 2 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 20_000 });
  await seek(page, 'chapter-ring');
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Piste des minutes', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Points', exact: true }).click();
  await slider(page, 'Taille des petits points', 0.25);
  await slider(page, 'Taille des grands points', 1.15);
  await close(page);
  expect(linkPayload(page.url())).toMatchObject({
    z: 3,
    bf: { chapterRing: { minor: { dotSize: 0.25 }, major: { dotSize: 1.15 } } },
  });
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-chapter-ring-dots',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeHidden();
});

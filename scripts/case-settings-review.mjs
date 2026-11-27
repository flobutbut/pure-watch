import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'documentation/case-envelope';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const construction = {
    attachment: 'lugs',
    dome: 0.69,
    integration: 1,
    transition: 0.07,
    lugWidthMm: 2.6,
    taper: 0.65,
    swell: 0,
    tipRound: 0.1,
    underside: 'curved',
    tipThicknessMm: 1.5,
    tipOffsetMm: -3.9,
    edge: 'sharp',
    edgeSizeMm: 0.5,
    drilled: false,
  };
  const hash = '#v1.' + Buffer.from(JSON.stringify({ bj: construction })).toString('base64url');
  await page.goto('http://127.0.0.1:5173/' + hash);
  await page.locator('#boot').waitFor({ state: 'hidden', timeout: 30_000 });
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 30; i++) {
    if ((await grid.getAttribute('aria-activedescendant'))?.startsWith('cell-case-size-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await page.keyboard.press('ArrowDown');
  await page.locator('button[aria-label="Paramètres du boîtier"][tabindex="0"]').click();
  const tabs = page.getByRole('radiogroup', { name: 'Paramètres du boîtier', exact: true });
  if ((await tabs.getByRole('radio').allTextContents()).join('|') !== 'Taille|Forme|Profil|Détails')
    throw new Error('Incorrect case navigation');
  await page.getByRole('button', { name: 'Effilées', exact: true }).click();
  if (
    await page
      .locator('.label-name')
      .filter({ hasText: /^Attaches$/ })
      .count()
  )
    throw new Error('Duplicate attachment row');
  await page.screenshot({ path: `${out}/settings-silhouette.png` });
  await tabs.getByRole('radio', { name: 'Profil', exact: true }).click();
  if (
    (await page.getByRole('slider', { name: 'Galbe du dessus', exact: true }).inputValue()) !==
    '0.69'
  )
    throw new Error('Drawing reset top profile');
  if (
    (await page.getByRole('slider', { name: 'Épaisseur en pointe', exact: true }).inputValue()) !==
    '1.5'
  )
    throw new Error('Drawing reset thickness');
  if (
    (await page.getByRole('slider', { name: 'Hauteur des pointes', exact: true }).inputValue()) !==
    '-3.9'
  )
    throw new Error('Drawing reset tip height');
  await page.locator('dialog h2').focus();
  await page.screenshot({ path: `${out}/settings-profile.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/settings-profile-mobile.png` });
  const before = await tabs.boundingBox();
  await page
    .getByRole('slider', { name: 'Épaisseur en pointe', exact: true })
    .scrollIntoViewIfNeeded();
  const after = await tabs.boundingBox();
  if (!before || !after || Math.abs(before.y - after.y) > 1)
    throw new Error('Case navigation scrolls with the controls');
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
    throw new Error('Mobile layout overflows');
  await page.screenshot({ path: `${out}/settings-profile-mobile-scrolled.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  await tabs.getByRole('radio', { name: 'Détails', exact: true }).click();
  await page.screenshot({ path: `${out}/settings-details.png` });
  await writeFile(
    `${out}/settings-checks.json`,
    JSON.stringify({ errors, fixedNavigation: true, mobileOverflow: false }, null, 2) + '\n',
  );
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Desktop/mobile case settings and fixed navigation verified.');
} finally {
  await browser.close();
}

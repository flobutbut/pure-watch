/** Compare side profiles on the same case, then inspect independent face contours. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out = 'documentation/case-profile';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const profiles = [
  ['straight', 'Droit'],
  ['curved', 'Galbé'],
  ['faceted', 'Facetté'],
  ['stepped', 'Étagé'],
];
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  await page.evaluate(() => {
    const r = window.__cushionReview;
    r.config.case.lugs = 'curved';
    r.config.crown.style = 'fluted';
    r.config.dial.color = '#173548';
    r.config.dial.indices.numerals = 'none';
    r.config.dial.indices.style = 'baton-facet';
    r.config.dial.chapterRing = 'none';
  });
  for (const shape of ['round', 'cushion', 'tonneau', 'square', 'rectangle']) {
    for (const [profile] of profiles) {
      await page.evaluate(
        async ({ shape, profile }) => {
          const r = window.__cushionReview;
          r.config.case.shape = shape;
          r.config.case.profile = profile;
          r.config.crown.style = shape === 'square' ? 'guarded' : 'fluted';
          await r.setFinish('refined');
          r.setView('quarter');
        },
        { shape, profile },
      );
      await page.locator('#after').screenshot({ path: `${out}/${shape}-${profile}-quarter.png` });
      if (shape === 'round' || shape === 'cushion') {
        await page.evaluate(() => window.__cushionReview.setView('profile'));
        await page.locator('#after').screenshot({ path: `${out}/${shape}-${profile}-profile.png` });
      }
    }
  }
  const gallery = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
  const cards = [];
  for (const view of ['quarter', 'profile'])
    for (const [profile, label] of profiles) {
      const bytes = await readFile(`${out}/round-${profile}-${view}.png`);
      cards.push(
        `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${label}</figcaption></figure>`,
      );
    }
  await gallery.setContent(
    `<html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#e4e8eb;color:#202832;font-family:system-ui}main{width:1660px;padding:24px;box-sizing:border-box}h1{font-size:24px;font-weight:450;margin:0 0 8px}p{font-size:14px;opacity:.7;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;border:1px solid #20283218;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:12px}img{display:block;width:100%}figcaption{font-size:16px}</style><main><h1>Profil du boîtier</h1><p>Même forme de face, même lunette et même épaisseur · quatre carrures indépendantes</p><section>${cards.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${out}/comparison.png` });
  await gallery.close();
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify({ profiles: profiles.map(([p]) => p), errors }, null, 2) + '\n',
  );
  await browser.close();
}

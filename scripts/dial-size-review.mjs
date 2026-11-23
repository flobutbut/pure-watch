/** Aperture proportions on a fixed case and independent dial contour. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out = 'documentation/dial-size';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const sizes = [
  ['compact', 'Compacte'],
  ['balanced', 'Équilibrée'],
  ['open', 'Ouverte'],
];
const errors = [],
  dimensions = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=tonneau&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  await page.evaluate(() => {
    const r = window.__cushionReview;
    r.config.bezel.type = 'rounded';
    r.config.crown.style = 'fluted';
    r.config.dial.finish = 'sunburst';
    r.config.dial.color = '#173548';
    r.config.dial.indices.style = 'baton-facet';
    r.config.dial.indices.numerals = 'none';
    r.config.dial.chapterRing = 'none';
    r.config.rehaut.profile = 'concave';
  });
  for (const [size] of sizes) {
    await page.evaluate(async (size) => {
      const r = window.__cushionReview;
      r.config.dial.size = size;
      await r.setFinish('refined');
      r.setView('quarter');
    }, size);
    await page.locator('#after').screenshot({ path: `${out}/tonneau-${size}.png` });
    dimensions[size] = await page.evaluate(() => window.__cushionReview.panes[1].model.dimensions);
  }
  for (const shape of ['round', 'cushion', 'square', 'rectangle']) {
    await page.evaluate(async (shape) => {
      const r = window.__cushionReview;
      r.config.case.shape = shape;
      r.config.dial.shape = shape === 'rectangle' ? 'round' : shape;
      r.config.dial.size = 'balanced';
      await r.setFinish('refined');
      r.setView('quarter');
    }, shape);
    await page.locator('#after').screenshot({ path: `${out}/${shape}-balanced.png` });
  }
  await page.selectOption('#quality', 'transmission');
  await page.waitForFunction(() => window.__cushionReview.ready);
  await page.locator('#after').screenshot({ path: `${out}/rectangle-round-transmission.png` });
  const gallery = await browser.newPage({ viewport: { width: 1400, height: 700 } }),
    cards = [];
  for (const [size, name] of sizes) {
    const bytes = await readFile(`${out}/tonneau-${size}.png`);
    cards.push(
      `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name}</figcaption></figure>`,
    );
  }
  await gallery.setContent(
    `<html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui}main{width:1300px;box-sizing:border-box;padding:24px}h1{font-size:24px;font-weight:450;margin:0 0 8px}p{font-size:13px;opacity:.7;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;border:1px solid #20283218;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px}img{display:block;width:100%;height:390px;object-fit:contain}figcaption{font-size:16px}</style><main><h1>Ouverture du cadran · boîtier tonneau</h1><p>Même boîtier de 40 mm, même cadran rond · métal préservé sur les flancs, verre et aiguilles ajustés</p><section>${cards.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${out}/comparison.png` });
  await gallery.close();
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify({ dimensions, errors }, null, 2) + '\n');
  await browser.close();
}

/** Native rehaut profiles, decals and shaped apertures. Requires Vite on port 5173. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const output = 'documentation/rehaut-review';
const scenes = [
  ['classic', 'Fin · assorti au cadran', 'none', 'dial', '#111317'],
  ['sloped', 'Biseauté · minutes chiffrées', 'five-minute', 'custom', '#EEE9DB'],
  ['concave', 'Concave · 24 heures', '24h', 'custom', '#163C61'],
  ['stepped', 'À palier · tachymètre', 'tachymeter', 'metal', '#111317'],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const errors = [],
  metrics = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [profile, , scale, finish, color] of scenes) {
    await page.evaluate(
      async ({ profile, scale, finish, color }) => {
        const r = window.__cushionReview;
        r.config.rehaut = { profile, scale, finish, color };
        r.config.dial.finish = 'sunburst';
        r.config.dial.indices.numerals = 'cardinal';
        r.config.dial.indices.style = 'baton';
        r.config.dial.chapterRing = 'none';
        await r.setFinish('refined');
      },
      { profile, scale, finish, color },
    );
    for (const view of ['front', 'quarter']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.locator('#after').screenshot({ path: `${output}/${profile}-${view}.png` });
    }
    metrics[profile] = await page.evaluate(() => window.__cushionReview.metrics(1));
  }
  for (const [shape, profile, scale] of [
    ['square', 'sloped', 'five-minute'],
    ['rectangle', 'concave', '24h'],
    ['tonneau', 'stepped', 'tachymeter'],
  ]) {
    await page.evaluate(
      async ({ shape, profile, scale }) => {
        const r = window.__cushionReview;
        r.config.case.shape = r.config.dial.shape = shape;
        r.config.rehaut = { profile, scale, finish: 'custom', color: '#EEE9DB' };
        await r.setFinish('refined');
        r.setView('quarter');
      },
      { shape, profile, scale },
    );
    await page.locator('#after').screenshot({ path: `${output}/${shape}.png` });
  }
  await page.selectOption('#quality', 'transmission');
  await page.waitForFunction(() => window.__cushionReview.ready);
  await page.locator('#after').screenshot({ path: `${output}/transmission.png` });
  const gallery = await browser.newPage({ viewport: { width: 1250, height: 1250 } });
  const cells = [];
  for (const [profile, name] of scenes) {
    const bytes = await readFile(`${output}/${profile}-quarter.png`);
    cells.push(
      `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name}</figcaption></figure>`,
    );
  }
  await gallery.setContent(
    `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui,sans-serif}main{width:1100px;padding:28px}h1{font-size:25px;font-weight:450;margin:0 0 6px}p{font-size:13px;opacity:.7;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}figure{margin:0;border:1px solid #20283215;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px}img{display:block;width:100%;height:440px;object-fit:contain}figcaption{font-size:16px}</style><main><h1>Réhauts · profils, couleurs et graduations</h1><p>Même montre · décor imprimé sur la surface inclinée, sous le verre</p><section>${cells.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${output}/overview.png` });
  await gallery.close();
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(
    `${output}/measurements.json`,
    JSON.stringify({ metrics, errors }, null, 2) + '\n',
  );
  await browser.close();
}

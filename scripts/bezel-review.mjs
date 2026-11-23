/** Native bezel geometry comparison under identical studio lighting. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const output = 'documentation/bezel-review';
const styles = [
  ['smooth', 'Lisse'],
  ['rounded', 'Bombée'],
  ['stepped', 'Double filet'],
  ['fluted', 'Cannelée'],
  ['coin', 'Moletée'],
  ['notched', 'Crantée'],
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
  for (const [style] of styles) {
    await page.evaluate(async (style) => {
      const review = window.__cushionReview;
      review.config.bezel.type = style;
      await review.setFinish('refined');
    }, style);
    for (const view of ['front', 'quarter']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.waitForTimeout(150);
      await page.locator('#after').screenshot({ path: `${output}/${style}-${view}.png` });
    }
    metrics[style] = await page.evaluate(() => window.__cushionReview.metrics(1));
  }
  for (const [shape, dial, style, material] of [
    ['square', 'square', 'fluted', 'steel'],
    ['rectangle', 'rectangle', 'stepped', 'steel'],
    ['cushion', 'round', 'coin', 'steel'],
    ['tonneau', 'round', 'notched', 'ceramic'],
  ]) {
    await page.evaluate(
      async ({ shape, dial, style, material }) => {
        const r = window.__cushionReview;
        r.config.case.shape = shape;
        r.config.dial.shape = dial;
        r.config.case.material = material;
        r.config.bezel.type = style;
        await r.setFinish('refined');
        r.setView('quarter');
      },
      { shape, dial, style, material },
    );
    await page.waitForTimeout(150);
    await page.locator('#after').screenshot({ path: `${output}/${shape}-${style}.png` });
  }
  const gallery = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
  const cells = [];
  for (const [style, name] of styles) {
    const bytes = await readFile(`${output}/${style}-quarter.png`);
    cells.push(
      `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name}</figcaption></figure>`,
    );
  }
  await gallery.setContent(
    `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui,sans-serif}main{width:1200px;padding:28px}h1{font-weight:450;font-size:25px;margin:0 0 6px}p{font-size:13px;margin:0 0 20px;opacity:.7}section{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0;border:1px solid #20283215;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px}img{display:block;width:100%;height:330px;object-fit:contain}figcaption{font-size:16px}</style><main><h1>Six styles de lunette</h1><p>Même montre, même matière, même studio · profils et usinages en 3D</p><section>${cells.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${output}/overview.png` });
  await gallery.close();
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await writeFile(
    `${output}/measurements.json`,
    JSON.stringify({ browser: browser.version(), metrics, errors }, null, 2) + '\n',
  );
  await browser.close();
}

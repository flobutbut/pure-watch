/** Native 3D material comparison under identical studio lighting. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const output = 'documentation/dial-finishes';
const finishes = [
  ['guilloche', 'Guilloché'],
  ['clous-de-paris', 'Clous de Paris'],
  ['linen', 'Lin'],
  ['concentric', 'Cerclé'],
  ['vertical-brushed', 'Brossé vertical'],
  ['hammered', 'Martelé'],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const errors = [],
  metrics = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text());
  });
  await page.goto(
    'http://127.0.0.1:5173/review.html?scope=dial&body=cushion&dial=cushion&quality=fallback',
  );
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [finish] of finishes) {
    await page.evaluate(async (finish) => {
      const review = window.__cushionReview;
      review.config.dial.finish = finish;
      review.config.dial.color = '#19476B';
      review.config.dial.indices.style = 'baton';
      review.config.dial.indices.numerals = 'cardinal';
      await review.setFinish('refined');
    }, finish);
    for (const view of ['front', 'quarter']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.waitForTimeout(120);
      await page.locator('#after').screenshot({ path: `${output}/${finish}-${view}.png` });
    }
    metrics[finish] = await page.evaluate(() => window.__cushionReview.metrics(1));
  }
  await page.selectOption('#quality', 'transmission');
  await page.waitForFunction(() => window.__cushionReview.ready);
  for (const [finish, shape, color] of [
    ['guilloche', 'square', '#1C50B9'],
    ['hammered', 'rectangle', '#D8B681'],
    ['linen', 'round', '#F2F0EA'],
  ]) {
    await page.evaluate(
      async ({ finish, shape, color }) => {
        const review = window.__cushionReview;
        review.config.case.shape = review.config.dial.shape = shape;
        review.config.dial.finish = finish;
        review.config.dial.color = color;
        await review.setFinish('refined');
        review.setView('quarter');
      },
      { finish, shape, color },
    );
    await page.waitForTimeout(120);
    await page
      .locator('#after')
      .screenshot({ path: `${output}/${finish}-${shape}-transmission.png` });
  }
  const gallery = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
  const cells = [];
  for (const [finish, name] of finishes) {
    const bytes = await readFile(`${output}/${finish}-quarter.png`);
    cells.push(
      `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name}</figcaption></figure>`,
    );
  }
  await gallery.setContent(
    `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui,sans-serif}main{width:1200px;padding:28px}h1{font-weight:450;font-size:25px;margin:0 0 6px}p{font-size:13px;margin:0 0 20px;opacity:.7}section{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0;border:1px solid #20283215;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px}img{display:block;width:100%;height:330px;object-fit:contain}figcaption{font-size:16px}</style><main><h1>Six nouvelles finitions de cadran</h1><p>Même teinte, même montre, même éclairage · reliefs et reflets procéduraux</p><section>${cells.join('')}</section></main>`,
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

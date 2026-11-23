/** Compare MSAA ink coverage under identical studio conditions. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const output = 'documentation/light-dial-print';
const scenes = [
  ['cream-sans', '#EAE6DC', 'sans', 'all', 'railroad', 'round'],
  ['white-geometric', '#FFFFFF', 'geometric', 'cardinal', 'ticks', 'round'],
  ['cream-roman', '#F2E8D5', 'serif', 'roman', 'dots', 'cushion'],
  ['white-art-deco', '#FFFFFF', 'art-deco', 'all', 'five-minute', 'square'],
  ['dark-control', '#111317', 'sans', 'all', 'railroad', 'round'],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [name, color, font, numerals, chapter, shape] of scenes) {
    await page.evaluate(
      async ({ color, font, numerals, chapter, shape }) => {
        const r = window.__cushionReview;
        r.config.case.shape = r.config.dial.shape = shape;
        r.config.dial.color = color;
        r.config.dial.finish = 'matte';
        r.config.dial.indices.numerals = numerals;
        r.config.dial.indices.numeralFont = font;
        r.config.dial.indices.style = 'baton';
        r.config.dial.chapterRing = chapter;
        await r.setFinish('refined');
        r.setView('front');
      },
      { color, font, numerals, chapter, shape },
    );
    for (const [label, coverage] of [
      ['before', true],
      ['after', false],
    ]) {
      await page.evaluate(async (coverage) => {
        const r = window.__cushionReview;
        const material = r.panes[1].model.layers.print.children[0].material;
        material.alphaToCoverage = coverage;
        material.needsUpdate = true;
        r.setView('front');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, coverage);
      await page.locator('#after').screenshot({ path: `${output}/${name}-${label}.png` });
    }
  }
  await page.selectOption('#quality', 'transmission');
  await page.waitForFunction(() => window.__cushionReview.ready);
  await page.evaluate(async () => {
    const r = window.__cushionReview;
    r.config.dial.color = '#EAE6DC';
    r.config.dial.finish = 'sunburst';
    await r.setFinish('refined');
    r.setView('quarter');
    r.panes[1].model.layers.print.children[0].material.alphaToCoverage = false;
    r.panes[1].model.layers.print.children[0].material.needsUpdate = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.locator('#after').screenshot({ path: `${output}/cream-transmission-quarter.png` });
  const gallery = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const cells = [];
  for (const name of ['cream-sans', 'white-geometric'])
    for (const label of ['before', 'after']) {
      const bytes = await readFile(`${output}/${name}-${label}.png`);
      cells.push(
        `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name === 'cream-sans' ? 'Crème' : 'Blanc'} · ${label === 'before' ? 'Avant' : 'Après'}</figcaption></figure>`,
      );
    }
  await gallery.setContent(
    `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui,sans-serif}main{width:1300px;padding:24px}h1{font-size:23px;font-weight:450;margin:0 0 8px}p{font-size:12px;opacity:.7;margin:0 0 18px}section{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0;text-align:center;border:1px solid #20283218;border-radius:12px;padding-bottom:12px;overflow:hidden}img{display:block;width:100%;height:380px;object-fit:contain}figcaption{font-size:14px}</style><main><h1>Lisibilité des cadrans clairs</h1><p>Même couleur d'encre, même police, même éclairage · correction de la couverture des traits</p><section>${cells.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${output}/comparison.png` });
  await gallery.close();
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(
    `${output}/checks.json`,
    JSON.stringify({ browser: browser.version(), errors }, null, 2) + '\n',
  );
  await browser.close();
}

/** Rotating ring review on circular and shaped cases. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out = 'documentation/rotating-bezel';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const errors = [],
  cards = [],
  checks = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=transmission');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [shape, scale, colour, angle, label] of [
    ['round', 'dive-60', '#102E3C', 0, 'Plongée · 60 min'],
    ['square', '24h', '#173C31', 45, 'Carré · 24 h'],
    ['tonneau', '12h', '#EAE5D7', 90, 'Tonneau · 12 h'],
    ['rectangle', 'dive-60', '#15171A', 330, 'Rectangle · plongée'],
  ]) {
    const data = await page.evaluate(
      async ({ shape, scale, colour, angle }) => {
        const r = window.__cushionReview;
        r.config.case.shape = shape;
        r.config.case.profile = 'faceted';
        r.config.case.lugs = 'curved';
        r.config.bezel = {
          ...r.config.bezel,
          type: 'rotating',
          scale,
          color: colour,
          angleDeg: angle,
        };
        r.config.dial.shape = shape;
        r.config.dial.finish = 'matte';
        r.config.dial.color = '#111317';
        r.config.dial.indices.style = 'baton-facet';
        r.config.dial.indices.numerals = 'none';
        r.config.dial.chapterRing = 'ticks';
        r.config.rehaut.profile = 'classic';
        r.config.rehaut.scale = 'none';
        await r.setFinish('refined');
        r.setView('quarter');
        const model = r.panes[1].model;
        const ring = model.layers.case.getObjectByName('rotating-bezel');
        const initial = ring.rotation.z;
        const identity = ring.children[0].geometry.uuid;
        model.setBezelAngle(angle + 30);
        const changed = ring.rotation.z !== initial;
        const reused = ring.children[0].geometry.uuid === identity;
        model.setBezelAngle(angle);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          dialShape: model.dimensions.dialShape,
          printed: !!ring.getObjectByName('bezel-graduations'),
          rotation: ring.rotation.z,
          changed,
          reused,
        };
      },
      { shape, scale, colour, angle },
    );
    checks.push({ shape, scale, ...data });
    if (data.dialShape !== 'round' || !data.printed || !data.changed || !data.reused)
      throw Error(JSON.stringify(data));
    const path = `${out}/${shape}-${scale}.png`;
    await page.locator('#after').screenshot({ path });
    const bytes = await readFile(path);
    cards.push(
      `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${label}</figcaption></figure>`,
    );
  }
  const gallery = await browser.newPage({ viewport: { width: 1600, height: 650 } });
  await gallery.setContent(
    `<html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#e4e8eb;color:#202832;font-family:system-ui}main{width:1580px;padding:24px;box-sizing:border-box}h1{font-size:24px;font-weight:450;margin:0 0 8px}p{font-size:14px;opacity:.7;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;border:1px solid #20283218;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px}img{display:block;width:100%}figcaption{font-size:15px}</style><main><h1>Lunettes tournantes</h1><p>Anneau circulaire indépendant · insert personnalisé · repère réglable · verre avec transmission</p><section>${cards.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${out}/comparison.png` });
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2) + '\n');
  await browser.close();
}

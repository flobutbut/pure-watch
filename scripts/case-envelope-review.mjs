/** Production geometry contact sheet. Run against the local Vite review page. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const out = 'documentation/case-envelope';
const shapeNames = {
  round: 'Rond',
  cushion: 'Coussin',
  tonneau: 'Tonneau',
  square: 'Carré',
  rectangle: 'Rectangle',
  octagon: 'Octogonal',
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    (process.env.EPURE_REVIEW_URL ?? 'http://127.0.0.1:5173') +
      '/review.html?body=round&dial=round&quality=fallback',
  );
  await page.waitForFunction(() => window.__cushionReview?.ready, null, { timeout: 120_000 });
  const shots = [];
  for (const shape of process.env.EPURE_CASE_REVIEW_QUICK
    ? ['round', 'square']
    : ['round', 'cushion', 'tonneau', 'square', 'rectangle', 'octagon']) {
    for (const join of ['detached', 'blended']) {
      await page.evaluate(
        async ({ shape, join }) => {
          const r = window.__cushionReview;
          Object.assign(r.config.case, { shape, lugs: 'curved', lugJoin: join, profile: 'curved' });
          Object.assign(r.config.case.construction, {
            attachment: 'lugs',
            dome: 0.5,
            integration: join === 'blended' ? 1 : 0,
            edge: 'rounded',
            taper: 0.25,
            underside: 'flat',
            tipThicknessMm: 2.6,
          });
          r.config.crown.guard = true;
          r.config.crown.style = 'fluted';
          r.config.crown.position = shape === 'tonneau' ? '4h' : '3h';
          r.config.dial.color = '#173548';
          await r.setFinish('refined');
          r.setView('quarter');
        },
        { shape, join },
      );
      await page.waitForTimeout(100);
      const path = `${out}/${shape}-${join}.png`;
      await page.locator('#after').screenshot({ path });
      shots.push({
        path,
        label: `${shapeNames[shape]} · ${join === 'blended' ? 'Intégré' : 'Détaché'}`,
      });
    }
  }
  for (const profile of ['straight', 'curved']) {
    await page.evaluate(async (profile) => {
      const r = window.__cushionReview;
      Object.assign(r.config.case, {
        shape: 'round',
        lugs: 'faceted',
        lugJoin: 'blended',
        profile,
      });
      Object.assign(r.config.case.construction, {
        attachment: 'lugs',
        dome: profile === 'straight' ? 0 : 1,
        integration: 0.8,
        edge: 'chamfer',
        edgeSizeMm: 0.4,
      });
      await r.setFinish('refined');
      r.setView('profile');
      for (const pane of r.panes) {
        pane.camera.up.set(0, 0, 1);
        pane.camera.lookAt(pane.controls.target);
        pane.renderer.render(pane.scene, pane.camera);
      }
    }, profile);
    await page.waitForTimeout(100);
    const path = `${out}/profile-${profile}.png`;
    await page.locator('#after').screenshot({ path });
    shots.push({ path, label: `Chanfrein continu · ${profile === 'straight' ? 'Plat' : 'Bombé'}` });
  }
  await page.evaluate(() => {
    const r = window.__cushionReview;
    for (const pane of r.panes) {
      pane.camera.up.set(0, 1, 0);
      pane.model.layers.strap.visible = false;
    }
    r.setView('back');
  });
  await page.waitForTimeout(100);
  await page.locator('#after').screenshot({ path: `${out}/back-solid.png` });
  shots.push({ path: `${out}/back-solid.png`, label: 'Fond · surface arrière' });
  const back = await page.evaluate(() => {
    const model = window.__cushionReview.panes[1].model;
    const triangles = [];
    for (const layer of [model.layers.case, model.layers.lugs])
      layer.traverse((o) => {
        if (!o.geometry || !o.name.startsWith('envelope')) return;
        const p = o.geometry.getAttribute('position');
        const count = o.geometry.index?.count ?? p.count;
        const at = (i) => o.geometry.index?.getX(i) ?? i;
        for (let i = 0; i < count; i += 3)
          if (
            (p.getX(at(i + 1)) - p.getX(at(i))) * (p.getY(at(i + 2)) - p.getY(at(i))) -
              (p.getY(at(i + 1)) - p.getY(at(i))) * (p.getX(at(i + 2)) - p.getX(at(i))) <
            -1e-9
          )
            triangles.push([0, 1, 2].map((k) => [p.getX(at(i + k)), p.getY(at(i + k))]));
      });
    return { triangles, radius: model.dimensions.caseRadius };
  });
  const half = back.radius * 1.4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}"><rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="#e4e8eb"/><g fill="none" stroke="#3c5267" stroke-width="0.025">${back.triangles.map((t) => `<polygon points="${t.map((p) => p.map((v) => v.toFixed(4)).join(',')).join(' ')}"/>`).join('')}</g></svg>`;
  await writeFile(`${out}/back-mesh.svg`, svg);
  const gallery = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await gallery.setContent(
    `<img id="back" width="750" height="750" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
  );
  await gallery.locator('#back').screenshot({ path: `${out}/back-mesh.png` });
  shots.push({ path: `${out}/back-mesh.png`, label: 'Maillage arrière · surface et raccords' });
  const cards = await Promise.all(
    shots.map(
      async ({ path, label }) =>
        `<figure><img src="data:image/png;base64,${(await readFile(path)).toString('base64')}"><figcaption>${label}</figcaption></figure>`,
    ),
  );
  await gallery.setContent(
    `<html lang="fr"><meta charset="utf-8"><style>body{margin:0;background:#e4e8eb;color:#202832;font-family:system-ui}main{width:1500px;padding:24px;box-sizing:border-box}h1{font-size:24px;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;text-align:center}img{width:100%;display:block}figcaption{padding:8px}</style><main><h1>Carrure, cornes et protège-couronne · enveloppe commune</h1><section>${cards.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${out}/comparison.png` });
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify({ errors }, null, 2) + '\n');
  await browser.close();
}

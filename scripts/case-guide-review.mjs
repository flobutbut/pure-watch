/** Side/front regression views for the flat-underneath construction and curved alternative. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'documentation/case-envelope';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready, null, { timeout: 120_000 });
  for (const underside of ['flat', 'curved']) {
    await page.evaluate(async (underside) => {
      const r = window.__cushionReview;
      Object.assign(r.config.case.construction, {
        attachment: 'lugs',
        dome: 0,
        integration: 1,
        transition: 0.6,
        lugWidthMm: 3.6,
        taper: 0.7,
        swell: 0.13,
        tipRound: 0,
        underside,
        tipThicknessMm: 1.32,
        tipOffsetMm: -2,
        edge: 'rounded',
        edgeSizeMm: 0.5,
        drilled: false,
      });
      if (underside === 'curved')
        Object.assign(r.config.case.construction, {
          dome: 0.69,
          transition: 0.07,
          lugWidthMm: 2.6,
          taper: 0.65,
          swell: 0,
          tipRound: 0.1,
          tipThicknessMm: 1.5,
          tipOffsetMm: -3.9,
          edge: 'sharp',
        });
      Object.assign(r.config.crown, { guard: true, style: 'fluted' });
      await r.setFinish('refined');
      r.setView('profile');
      const p = r.panes[1];
      p.camera.up.set(0, 1, 0);
      p.camera.zoom = 1;
      p.controls.target.set(0, 0, -1);
      p.camera.position.set(112, 0, -1);
      p.camera.updateProjectionMatrix();
      p.controls.update();
      p.renderer.render(p.scene, p.camera);
    }, underside);
    await page.locator('#after').screenshot({ path: `${out}/guide-${underside}-profile.png` });
    if (underside === 'flat') {
      await page.evaluate(() => {
        const r = window.__cushionReview;
        r.setView('front');
        const p = r.panes[1];
        p.controls.target.set(0, 12, 0);
        p.camera.position.set(0, 12, 112);
        p.camera.zoom = 1.7;
        p.camera.updateProjectionMatrix();
        p.controls.update();
        p.renderer.render(p.scene, p.camera);
      });
      await page.locator('#after').screenshot({ path: `${out}/guide-flat-front.png` });
      await page.evaluate(() => {
        const r = window.__cushionReview;
        r.setView('quarter');
        const p = r.panes[1];
        p.camera.zoom = 1.2;
        p.camera.updateProjectionMatrix();
        p.renderer.render(p.scene, p.camera);
      });
      await page.locator('#after').screenshot({ path: `${out}/guide-flat-quarter.png` });
    }
  }
  await writeFile(`${out}/guide-checks.json`, JSON.stringify({ errors }, null, 2) + '\n');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Flat and curved guide views captured.');
} finally {
  await browser.close();
}

/** Run with Vite on 127.0.0.1:5173. Optional PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 1500, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (e) => {
  if (e.type() === 'error') errors.push(e.text());
});
const pilot = process.argv.includes('--black') ? 'black' : 'cushion';
const output = pilot === 'black' ? 'documentation/black-review' : 'documentation/cushion-review';
await mkdir(output, { recursive: true });
const results = {
  browser: browser.version(),
  viewport: { width: 1500, height: 1100 },
  captures: [],
  benchmark: {},
  errors,
};
try {
  for (const quality of ['transmission', 'fallback']) {
    await page.goto(`http://127.0.0.1:5173/review.html?pilot=${pilot}&quality=${quality}`);
    await page.waitForFunction(() => window.__cushionReview?.ready);
    await page.waitForTimeout(300);
    for (const view of ['front', 'quarter', 'profile', 'back']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.waitForTimeout(150);
      const file = `${quality}-${view}.png`;
      await page.screenshot({ path: `${output}/${file}`, fullPage: true });
      results.captures.push(file);
    }
    await page.evaluate(() => window.__cushionReview.setView('quarter'));
    results.gpu = await page.evaluate(() => {
      const gl = window.__cushionReview.panes[1].renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext
        ? {
            vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
          }
        : null;
    });
    results.benchmark[quality] = {
      before: await page.evaluate(() => window.__cushionReview.benchmark(0, 30)),
      after: await page.evaluate(() => window.__cushionReview.benchmark(1, 30)),
    };
    // Actual animation and synchronized camera verification.
    const start = await page.evaluate(() => ({
      angle: window.__cushionReview.panes[1].model.layers.seconds.children[0].rotation.z,
      camera: window.__cushionReview.panes[1].camera.position.toArray(),
    }));
    await page.click('#rotate');
    await page.click('#hands');
    await page.waitForTimeout(600);
    const end = await page.evaluate(() => ({
      angle: window.__cushionReview.panes[1].model.layers.seconds.children[0].rotation.z,
      cameras: window.__cushionReview.panes.map((p) => p.camera.position.toArray()),
    }));
    if (
      start.angle === end.angle ||
      JSON.stringify(start.camera) === JSON.stringify(end.cameras[1]) ||
      end.cameras[0].some((v, i) => Math.abs(v - end.cameras[1][i]) > 1e-8)
    )
      throw new Error(
        `Animation or synchronized rotation failed: ${JSON.stringify({ start, end })}`,
      );
    await page.screenshot({ path: `${output}/${quality}-rotation.png`, fullPage: true });
    await page.click('#rotate');
    await page.click('#hands');
    await page.evaluate(() => window.__cushionReview.setView('quarter'));
    await page.evaluate(() => window.__cushionReview.setFinish('geometry'));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${output}/${quality}-geometry-only.png`, fullPage: true });
    // Review runtime resources after repeated rebuilding.
    results.benchmark[quality].afterRebuild = await page.evaluate(() =>
      window.__cushionReview.metrics(1),
    );
  }
  await page.goto(`http://127.0.0.1:5173/?pilot=${pilot}`);
  await page.waitForSelector('#boot.done');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fermer', exact: true }).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${output}/configurator.png`, fullPage: true });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.getByRole('grid').waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}

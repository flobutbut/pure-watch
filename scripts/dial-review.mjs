/** Aperture comparison at the same camera, lighting and time. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'documentation/dial-review';
const finishesOnly = process.argv.includes('--finishes-only');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const results = { browser: browser.version(), combinations: {}, errors };
try {
  for (const [body, dial] of finishesOnly
    ? []
    : [
        ['round', 'round'],
        ['cushion', 'cushion'],
        ['tonneau', 'tonneau'],
        ['octagon', 'octagon'],
        ['square', 'square'],
        ['rectangle', 'rectangle'],
        ['round', 'square'],
        ['round', 'rectangle'],
        ['square', 'tonneau'],
      ]) {
    await page.goto(
      `http://127.0.0.1:5173/review.html?scope=dial&body=${body}&dial=${dial}&quality=fallback`,
    );
    await page.waitForFunction(() => window.__cushionReview?.ready);
    for (const view of ['front', 'quarter', 'profile']) {
      await page.evaluate((value) => window.__cushionReview.setView(value), view);
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${output}/${body}-${dial}-${view}.png`, fullPage: true });
    }
    results.combinations[`${body}/${dial}`] = await page.evaluate(() => ({
      before: window.__cushionReview.metrics(0),
      after: window.__cushionReview.metrics(1),
    }));
  }
  for (const [body, dial, finish, indices] of [
    ['square', 'square', 'fume', 'baton'],
    ['rectangle', 'rectangle', 'sunburst', 'dauphine'],
  ]) {
    await page.goto(`http://127.0.0.1:5173/review.html?scope=dial&body=${body}&dial=${dial}`);
    await page.waitForFunction(() => window.__cushionReview?.ready);
    await page.evaluate(
      async ({ finish, indices }) => {
        const review = window.__cushionReview;
        review.config.dial.finish = finish;
        review.config.dial.indices.style = indices;
        review.config.dial.indices.numerals = 'none';
        review.config.dial.chapterRing = 'railroad';
        await review.setFinish('refined');
        review.setView('quarter');
      },
      { finish, indices },
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${output}/${body}-${finish}-transmission.png`, fullPage: true });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  if (!finishesOnly)
    await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}

/** Crown-to-case junction audit. Requires Vite. */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const output = 'documentation/crown-review';
await mkdir(output, { recursive: true });
const before = process.argv.includes('--before');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await page.goto('http://127.0.0.1:5173/review.html?scope=dial&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [shape, position] of before
    ? [
        ['square', '4h'],
        ['rectangle', '3h'],
      ]
    : [
        ['square', '3h'],
        ['square', '4h'],
        ['rectangle', '3h'],
        ['rectangle', '4h'],
        ['round', '3h'],
        ['tonneau', '4h'],
        ['octagon', '2h'],
        ['cushion', '2h'],
      ]) {
    await page.evaluate(
      async ({ shape, position }) => {
        const review = window.__cushionReview;
        review.config.case.shape = shape;
        review.config.case.lugs = 'none';
        review.config.dial.shape = shape;
        review.config.crown.style = 'guarded';
        review.config.crown.position = position;
        await review.setFinish('refined');
        document.querySelector('h1').textContent = `Couronne protégée · ${shape} · ${position}`;
      },
      { shape, position },
    );
    for (const view of ['front', 'quarter']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.waitForTimeout(150);
      await page.screenshot({
        path: `${output}/${before ? 'before-' : ''}${shape}-${position}-${view}.png`,
        fullPage: true,
      });
    }
  }
} finally {
  await browser.close();
}

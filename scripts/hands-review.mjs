/** Visual hand audit, isolated from case/glass changes. Requires the local Vite server. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const initial = process.argv.includes('--initial');
const output = 'documentation/hands-review';
await mkdir(output, { recursive: true });
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
const results = { browser: browser.version(), sets: {}, errors };
try {
  await page.goto('http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=syringe');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const set of ['baton', 'sword', 'dauphine', 'leaf', 'syringe', 'breguet']) {
    await page.selectOption('#hand-set', set);
    await page.waitForFunction(() => window.__cushionReview.ready);
    await page.waitForTimeout(150);
    for (const view of initial ? ['quarter'] : ['front', 'quarter', 'profile']) {
      await page.evaluate((view) => window.__cushionReview.setView(view), view);
      await page.waitForTimeout(100);
      await page.screenshot({
        path: `${output}/${initial ? 'initial-' : ''}${set}-${view}.png`,
        fullPage: true,
      });
    }
    results.sets[set] = await page.evaluate(() => ({
      before: window.__cushionReview.metrics(0),
      after: window.__cushionReview.metrics(1),
    }));
    if (!initial) {
      const start = await page.evaluate(() =>
        window.__cushionReview.panes[1].model.layers.hands.children
          .slice(0, 2)
          .map((o) => o.rotation.z),
      );
      await page.click('#hands');
      await page.waitForTimeout(400);
      const end = await page.evaluate(() =>
        window.__cushionReview.panes[1].model.layers.hands.children
          .slice(0, 2)
          .map((o) => o.rotation.z),
      );
      if (start.some((v, i) => v === end[i])) throw new Error(`Frozen hands: ${set}`);
      await page.click('#hands');
    }
  }
  if (!initial) {
    await page.goto('http://127.0.0.1:5173/?pilot=black');
    await page.waitForSelector('#boot.done');
    const grid = page.getByRole('grid');
    await grid.focus();
    for (const [index, set] of [
      'baton',
      'dauphine',
      'sword',
      'leaf',
      'breguet',
      'syringe',
    ].entries()) {
      if (index > 0) await page.keyboard.press('ArrowRight');
      const selected = await grid.getAttribute('aria-activedescendant');
      if (selected !== `cell-hands-${set}`) throw new Error(`Hand selection failed: ${selected}`);
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Fermer', exact: true }).waitFor();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${output}/watch-${set}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      // The product's close transition takes 450 ms, during which the grid is inert.
      await page.waitForTimeout(500);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await writeFile(
    `${output}/${initial ? 'initial-' : ''}measurements.json`,
    JSON.stringify(results, null, 2) + '\n',
  );
  await browser.close();
}

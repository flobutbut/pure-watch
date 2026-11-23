/** Header, contextual navigation hints and light/dark layout review. Requires Vite. */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'documentation/chrome-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const errors = [];
const configuration = (color) =>
  `http://127.0.0.1:5173/#v1.${Buffer.from(JSON.stringify({ a: 2, b: 38, c: 10.5, d: 45, f: 4, g: 2, h: 2, j: 1, n: 9, s: 1, w: 12, x: color, z: 1, A: 2, I: 2, L: 1, M: '#68DCC7', N: 0, ac: 2, ad: 3, ae: '#EAE6DC', af: 2 })).toString('base64url')}`;
try {
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1440, height: 1000 } }],
    ['mobile', { ...devices['Pixel 7'] }],
  ]) {
    const page = await browser.newPage(options);
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [tone, color] of [
      ['dark', '#173548'],
      ['light', '#EEE9DB'],
    ]) {
      await page.goto(configuration(color));
      await page.locator('#boot').waitFor({ state: 'hidden', timeout: 15000 });
      await page.screenshot({
        path: `${output}/${name}-${tone}-${tone === 'light' ? 'inspect' : 'grid'}.png`,
      });
      if (tone === 'dark') {
        await page.getByRole('grid').press('Enter');
        await page.getByRole('button', { name: 'Fermer', exact: true }).waitFor();
        await page.screenshot({ path: `${output}/${name}-inspect.png` });
      }
    }
    await page.close();
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(
    `${output}/checks.json`,
    JSON.stringify({ browser: browser.version(), errors }, null, 2) + '\n',
  );
  await browser.close();
}

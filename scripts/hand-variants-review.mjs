/** Visual audit of the new native 3D geometries. Requires Vite on 5173. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = 'documentation/hand-variants';
await mkdir(output, { recursive: true });
const hands = [
  ['spear', 'Lance'],
  ['pencil', 'Crayon'],
  ['spade', 'Pique'],
  ['art-deco', 'Art déco'],
  ['skeleton', 'Ajourées'],
  ['cathedral', 'Cathédrale'],
];
const seconds = [
  ['baton', 'Bâton'],
  ['diamond', 'Losange'],
  ['teardrop', 'Goutte'],
  ['ring-tail', 'Contrepoids ajouré'],
  ['lightning', 'Éclair'],
];
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const errors = [];
const metrics = {};
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=spear');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [kind, choices] of [
    ['hands', hands],
    ['seconds', seconds],
  ]) {
    for (const [id] of choices) {
      await page.evaluate(
        async ({ kind, id }) => {
          const review = window.__cushionReview;
          if (kind === 'hands') review.config.hands.set = id;
          else review.config.hands.second.style = id;
          await review.setFinish('refined');
          for (const pane of review.panes) {
            pane.model.layers.hands.visible = kind === 'hands';
            pane.model.layers.seconds.visible = kind === 'seconds';
            pane.model.setAngles({ hour: -35, minute: 35, second: 0 });
          }
          review.setView('front');
        },
        { kind, id },
      );
      await page.waitForTimeout(120);
      await page.locator('#after').screenshot({ path: `${output}/${kind}-${id}.png` });
      metrics[`${kind}/${id}`] = await page.evaluate(() => window.__cushionReview.metrics(1));
    }
  }
  const galleryPage = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  for (const [kind, title, choices] of [
    ['hands', 'Six nouveaux jeux d’aiguilles', hands],
    ['seconds', 'Cinq nouvelles trotteuses', seconds],
  ]) {
    const cells = [];
    for (const [id, name] of choices) {
      const bytes = await readFile(`${output}/${kind}-${id}.png`);
      cells.push(
        `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name}</figcaption></figure>`,
      );
    }
    await galleryPage.setContent(
      `<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#17212B;color:#EEF0F3;font-family:system-ui,sans-serif}main{width:1200px;padding:32px}h1{font-weight:400;font-size:25px;margin:0 0 20px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{margin:0;background:#1C2834;border-radius:14px;padding:12px 12px 18px;text-align:center}img{display:block;width:100%;height:320px;object-fit:contain}figcaption{font-size:16px;letter-spacing:.03em}</style><main><h1>${title}</h1><section>${cells.join('')}</section></main>`,
    );
    await galleryPage.locator('main').screenshot({ path: `${output}/${kind}-overview.png` });
  }
  await galleryPage.close();
  const payload = {
    a: 3,
    j: 4,
    w: 3,
    x: '#1C50B9',
    A: 3,
    I: 12,
    J: 'lacquer',
    M: '#FFC000',
    ab: '#F2F0EA',
    L: 9,
  };
  await page.goto(
    `http://127.0.0.1:5173/#v1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`,
  );
  await page.locator('#boot').waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fermer', exact: true }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${output}/watch-cathedral.png` });
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await writeFile(
    `${output}/measurements.json`,
    JSON.stringify({ browser: browser.version(), metrics, errors }, null, 2) + '\n',
  );
  await browser.close();
}

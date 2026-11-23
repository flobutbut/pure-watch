/** Compare print filtering at full and grid sizes, without changing geometry or glass. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out = 'documentation/print-softness';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const choices = [
  ['current', -0.5, false],
  ['after', 0, true],
];
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  await page.evaluate(async () => {
    const r = window.__cushionReview;
    r.config.dial.color = '#F2F0EA';
    r.config.dial.finish = 'matte';
    r.config.dial.indices.numerals = 'all';
    r.config.dial.indices.numeralFont = 'sans';
    r.config.dial.chapterRing = 'railroad';
    await r.setFinish('refined');
    r.setView('front');
  });
  for (const [name, bias, smooth] of choices) {
    await page.evaluate(
      async ({ name, bias, smooth }) => {
        const r = window.__cushionReview;
        const { ShaderChunk } = await import('/node_modules/three/build/three.module.js');
        const m = r.panes[1].model.layers.print.children[0].material;
        if (name === 'after') {
          const { sharpPrint } = await import('/src/render3d/textures.ts');
          sharpPrint(m);
          m.needsUpdate = true;
          r.setView('front');
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          return;
        }
        m.alphaToCoverage = smooth;
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            ShaderChunk.map_fragment.replace(
              'texture2D( map, vMapUv )',
              `texture2D( map, vMapUv, ${bias.toFixed(2)} )`,
            ),
          );
          if (smooth)
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <alphatest_fragment>',
              `float inkEdge = clamp(0.5 * fwidth(diffuseColor.a), 0.04, 0.15); diffuseColor.a = smoothstep(alphaTest - inkEdge, alphaTest + inkEdge, diffuseColor.a); if(diffuseColor.a == 0.0) discard;`,
            );
        };
        m.customProgramCacheKey = () => name;
        m.needsUpdate = true;
        r.setView('front');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      },
      { name, bias, smooth },
    );
    for (const size of [640, 220]) {
      await page.evaluate(async (size) => {
        const r = window.__cushionReview;
        const c = r.panes[1].renderer.domElement;
        c.style.width = `${size}px`;
        c.style.height = `${size}px`;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        r.setView('front');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, size);
      await page.locator('#after').screenshot({ path: `${out}/${name}-${size}.png` });
    }
  }
  await page.selectOption('#quality', 'transmission');
  await page.waitForFunction(() => window.__cushionReview.ready);
  await page.evaluate(() => window.__cushionReview.setView('quarter'));
  await page.locator('#after').screenshot({ path: `${out}/transmission-after.png` });
  const gallery = await browser.newPage({ viewport: { width: 1250, height: 1000 } });
  const cards = [];
  for (const [name] of choices) {
    const big = await readFile(`${out}/${name}-640.png`),
      small = await readFile(`${out}/${name}-220.png`);
    cards.push(
      `<figure><h2>${name === 'current' ? 'Avant' : 'Après'}</h2><img class="large" src="data:image/png;base64,${big.toString('base64')}"><img class="small" src="data:image/png;base64,${small.toString('base64')}"></figure>`,
    );
  }
  await gallery.setContent(
    `<html><style>body{margin:0;background:#E4E8EB;color:#202832;font-family:system-ui}main{width:1000px;padding:20px;box-sizing:border-box}h1{font-size:23px;font-weight:450}section{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0;text-align:center}h2{font-size:14px;font-weight:400}.large{width:100%;display:block}.small{width:220px;height:220px;display:block;margin:auto}</style><main><h1>Encre · accentuation et contours</h1><section>${cards.join('')}</section></main>`,
  );
  await gallery.locator('main').screenshot({ path: `${out}/comparison.png` });
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify({ errors }, null, 2) + '\n');
  await browser.close();
}

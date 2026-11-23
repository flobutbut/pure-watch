import { expect, test } from '@playwright/test';
test.setTimeout(90_000);

test('l’encre conserve son cœur opaque avec des contours lissés sur cadrans et réhauts', async ({
  page,
}) => {
  await page.goto('/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [color, font, chapter, target] of [
    ['#EAE6DC', 'sans', 'railroad', 'dial'],
    ['#FFFFFF', 'art-deco', 'ticks', 'dial'],
    ['#111317', 'serif', 'dots', 'dial'],
    ['#EAE6DC', 'sans', 'none', 'rehaut'],
  ]) {
    const coverage = await page.evaluate(
      async ({ color, font, chapter, target }) => {
        const review = window.__cushionReview;
        review.config.dial.color = color;
        review.config.dial.finish = 'matte';
        review.config.dial.chapterRing = chapter;
        review.config.dial.indices.numerals = 'all';
        review.config.dial.indices.numeralFont = font;
        review.config.rehaut = {
          profile: 'sloped',
          scale: target === 'rehaut' ? 'five-minute' : 'none',
          finish: 'custom',
          color,
        };
        await review.setFinish('refined');
        review.setView('front');
        const pane = review.panes[1];
        pane.model.showOnly([target === 'rehaut' ? 'rehaut' : 'print']);
        const mesh =
          target === 'rehaut'
            ? pane.model.layers.rehaut.getObjectByName('rehaut-graduations')
            : pane.model.layers.print.children[0];
        if (target === 'rehaut')
          for (const child of pane.model.layers.rehaut.children) child.visible = child === mesh;
        const material = mesh.material;
        const canvas = document.createElement('canvas');
        canvas.width = pane.renderer.domElement.width;
        canvas.height = pane.renderer.domElement.height;
        const ctx = canvas.getContext('2d')!;
        const capture = () => {
          pane.renderer.render(pane.scene, pane.camera);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(pane.renderer.domElement, 0, 0);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        };
        const actual = capture();
        // The same texture, lighting and geometry with a hard 50% cutoff defines the
        // interiors of the strokes. Smoothing may affect the fringe, never these cores.
        material.alphaToCoverage = false;
        material.alphaTest = 0.5;
        material.needsUpdate = true;
        const reference = capture();
        let core = 0,
          opaqueCore = 0,
          softEdge = 0;
        for (let i = 3; i < actual.length; i += 4) {
          if (reference[i]! >= 250) {
            core++;
            if (actual[i]! >= 250) opaqueCore++;
          }
          if (actual[i]! > 8 && actual[i]! < 245) softEdge++;
        }
        return {
          core,
          coreCoverage: opaqueCore / core,
          softEdge,
          transparent: material.transparent,
        };
      },
      { color: color!, font: font!, chapter: chapter!, target: target! },
    );
    expect(
      coverage.core,
      `${color}/${font}/${target}: printed strokes are present`,
    ).toBeGreaterThan(100);
    expect(coverage.transparent).toBe(false);
    expect(
      coverage.coreCoverage,
      `${color}/${font}/${target}: stroke interiors stay solid`,
    ).toBeGreaterThan(0.98);
    expect(
      coverage.softEdge,
      `${color}/${font}/${target}: edge pixels are antialiased`,
    ).toBeGreaterThan(10);
  }
});

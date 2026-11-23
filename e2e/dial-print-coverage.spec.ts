import { expect, test } from '@playwright/test';
test.setTimeout(90_000);

test('les chiffres et pistes gardent une encre opaque sur cadrans crème, blancs et noirs', async ({
  page,
}) => {
  await page.goto('/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready);
  for (const [color, font, chapter] of [
    ['#EAE6DC', 'sans', 'railroad'],
    ['#FFFFFF', 'art-deco', 'ticks'],
    ['#111317', 'serif', 'dots'],
  ]) {
    const coverage = await page.evaluate(
      async ({ color, font, chapter }) => {
        const review = window.__cushionReview;
        review.config.dial.color = color;
        review.config.dial.finish = 'matte';
        review.config.dial.chapterRing = chapter;
        review.config.dial.indices.numerals = 'all';
        review.config.dial.indices.numeralFont = font;
        await review.setFinish('refined');
        review.setView('front');
        const pane = review.panes[1];
        // Isolate the actual print layer: alpha measures lost ink independently of lighting,
        // the case and the hands. It must also remain opaque for the glass transmission pass.
        pane.model.showOnly(['print']);
        const material = pane.model.layers.print.children[0].material;
        pane.renderer.render(pane.scene, pane.camera);
        const canvas = document.createElement('canvas');
        canvas.width = pane.renderer.domElement.width;
        canvas.height = pane.renderer.domElement.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(pane.renderer.domElement, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0,
          solid = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i]! > 8) ink++;
          if (pixels[i]! >= 250) solid++;
        }
        return { ink, solidFraction: solid / ink, transparent: material.transparent };
      },
      { color: color!, font: font!, chapter: chapter! },
    );
    expect(coverage.ink, `${color}/${font}: glyphs and minute track are present`).toBeGreaterThan(
      100,
    );
    expect(coverage.transparent).toBe(false);
    expect(
      coverage.solidFraction,
      `${color}/${font}: printed strokes must not be perforated`,
    ).toBeGreaterThan(0.95);
  }
});

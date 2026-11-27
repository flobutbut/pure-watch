/** Focused regression capture and CPU/storage benchmark for the reported rounded shoulder. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'documentation/case-envelope';
const tag = process.env.EPURE_SURFACE_TAG ?? 'after';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review.html?body=round&dial=round&quality=fallback');
  await page.waitForFunction(() => window.__cushionReview?.ready, null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const r = window.__cushionReview;
    Object.assign(r.config.case.construction, {
      attachment: 'lugs',
      dome: 0.81,
      integration: 0.93,
      lugWidthMm: 3.6,
      taper: 0.16,
      swell: 0,
      tipRound: 0.33,
      underside: 'flat',
      tipThicknessMm: 1.32,
      transition: 0.6,
      edge: 'rounded',
      edgeSizeMm: 0.5,
      drilled: false,
    });
    r.config.crown.guard = true;
    await r.setFinish('refined');
    r.setView('quarter');
    const pane = r.panes[1];
    pane.camera.position.set(48, 65, 82);
    pane.controls.target.set(0, 7, 0);
    pane.camera.zoom = 1.7;
    pane.camera.updateProjectionMatrix();
    pane.controls.update();
    pane.renderer.render(pane.scene, pane.camera);
  });
  await page.locator('#after').screenshot({ path: `${out}/surface-${tag}.png` });
  const metrics = await page.evaluate(async () => {
    const { buildCaseEnvelope } = await import('/src/render3d/parts/case-envelope.ts');
    const { watchDimensions } = await import('/src/core/geometry/dimensions.ts');
    const r = window.__cushionReview,
      lib = r.panes[1].lib;
    const samples = [];
    let triangles = 0,
      vertices = 0,
      bytes = 0,
      meshes = 0;
    for (let i = 0; i < 9; i++) {
      const config = structuredClone(r.config);
      config.case.construction.integration += (i + 1) * 0.0001;
      const start = performance.now();
      const groups = buildCaseEnvelope(config, watchDimensions(config), lib);
      const elapsed = performance.now() - start;
      if (i >= 3) samples.push(elapsed);
      for (const group of Object.values(groups))
        group.traverse((o) => {
          if (!o.geometry) return;
          if (i === 8) {
            meshes++;
            vertices += o.geometry.getAttribute('position').count;
            triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
            for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
            bytes += o.geometry.index?.array.byteLength ?? 0;
          }
          o.geometry.dispose();
        });
    }
    samples.sort((a, b) => a - b);
    return {
      triangles,
      vertices,
      bytes,
      meshes,
      generationMedianMs: (samples[2] + samples[3]) / 2,
      samples,
    };
  });
  if (process.env.EPURE_SURFACE_DIAGNOSTIC) {
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const pane = window.__cushionReview.panes[1];
      for (const [key, layer] of Object.entries(pane.model.layers)) {
        if (!['case', 'lugs'].includes(key)) layer.visible = false;
        layer.traverse((o) => {
          if (!o.geometry) return;
          if (!o.name.startsWith('envelope')) o.visible = false;
          else o.material = new THREE.MeshNormalMaterial();
        });
      }
      pane.renderer.render(pane.scene, pane.camera);
    });
    await page.locator('#after').screenshot({ path: `${out}/surface-normals.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${out}/surface-${tag}.json`, JSON.stringify(metrics, null, 2) + '\n');
  console.log(JSON.stringify({ tag, ...metrics }));
} finally {
  await browser.close();
}

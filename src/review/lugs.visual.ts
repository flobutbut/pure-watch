import { test, expect } from '@playwright/test';
import { CASE_SHAPES } from '../core/geometry/case-shape';

for (const shape of CASE_SHAPES)
  for (const view of ['front', 'quarter']) {
    test(`${shape}/${view}: every lug and connection`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/lugs-review.html?shape=${shape}&view=${view}`);
      await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
      await expect(page.locator('figure canvas')).toHaveCount(24);
      await page.screenshot({
        path: `documentation/lug-audit/${shape}-${view}.png`,
        fullPage: true,
      });
      if (shape === 'round' && view === 'quarter')
        await page.locator('section[data-style="teardrop"]').screenshot({
          path: 'documentation/lug-audit/round-teardrop-quarter.png',
        });
      expect(errors).toEqual([]);
    });
  }

test('round/quarter: detail of the inner lug root', async ({ page }) => {
  await page.goto('/lugs-review.html?shape=round&view=quarter&detail=root');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
  await page.locator('section[data-style="teardrop"]').screenshot({
    path: 'documentation/lug-audit/round-teardrop-root.png',
  });
});

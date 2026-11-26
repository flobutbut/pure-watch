import type { Locator, Page } from '@playwright/test';

/** The HEX field lives in the folded « Avancé » section of the colour panel. */
export async function hexField(page: Page, scope = page.locator('dialog')) {
  const advanced: Locator = scope.locator('details.advanced');
  if (!(await advanced.evaluate((details: HTMLDetailsElement) => details.open)))
    await advanced.locator('summary').click();
  return scope.getByRole('textbox', { name: 'Code HEX' });
}

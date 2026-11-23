import type { Page } from '@playwright/test';

/** The HEX field lives in the folded « Avancé » section of the colour panel. */
export async function hexField(page: Page) {
  const advanced = page.locator('dialog details.advanced');
  if (!(await advanced.evaluate((details: HTMLDetailsElement) => details.open)))
    await advanced.locator('summary').click();
  return page.getByRole('textbox', { name: 'Code HEX' });
}

import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test.describe('navigateur anglophone', () => {
  test.use({ locale: 'en-US' });

  test('le site s’affiche en anglais et le pied de page repasse en français, choix retenu', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Share the configuration' })).toBeVisible();
    await expect(page.getByRole('grid', { name: /^Configurator:/ })).toBeVisible();
    await expect(page.locator('.label.active .label-name')).toHaveText('Hands');

    const language = page.getByRole('group', { name: 'Language' });
    await expect(language.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const about = page.getByRole('dialog', { name: 'About Épure' });
    await expect(about.getByText('Legal notice')).toBeVisible();
    await about.getByRole('button', { name: 'Close About' }).click();

    await language.getByRole('button', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('.label.active .label-name')).toHaveText('Aiguilles');
    await expect(page.getByRole('button', { name: 'Partager la configuration' })).toBeVisible();

    await page.reload();
    await expect(page.locator('#boot .label')).not.toHaveText(/workshop/);
    await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('group', { name: 'Langue' })).toBeVisible();
    await expect(page.locator('.label.active .label-name')).toHaveText('Aiguilles');
  });

  test('la fiche d’identité et les mouvements sont rédigés en anglais', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
    await page.getByRole('grid').press('Enter');
    const toggle = page.getByRole('button', { name: 'Watch details', exact: true });
    await expect(toggle).toBeVisible();
    // Wide screens open the card with the 3D view; phones keep it behind its button.
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
    const card = page.getByRole('dialog', { name: 'Your watch' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Lug-to-lug length')).toBeVisible();
    await card.getByRole('tab', { name: 'Movements' }).click();
    await expect(card.getByRole('list', { name: 'Compatible movements' })).toBeVisible();
    await expect(card.getByText(/vph/).first()).toBeVisible();
  });
});

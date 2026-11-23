import { expect, test } from '@playwright/test';
test.setTimeout(90_000);
const link =
  '/#v1.' +
  Buffer.from(JSON.stringify({ a: 3, x: '#173548', ac: 3, ad: 3, ae: '#EAE6DC', af: 3 })).toString(
    'base64url',
  );

test('le partage copie le lien courant, les aides suivent la vue et le favicon porte Épure', async ({
  page,
  request,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedLink = text;
        },
      },
      configurable: true,
    });
  });
  await page.goto(link);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  const share = page.getByRole('button', { name: 'Partager la configuration', exact: true });
  await expect(share).toBeVisible();
  await expect(page.getByText('ÉPURE', { exact: true })).toBeVisible();
  const mobile = testInfo.project.name === 'mobile';
  await expect(
    page.getByText(
      mobile ? 'Glisser pour explorer · Toucher la montre pour la voir en 3D' : /^↑ ↓ Pièces$/,
      { exact: mobile },
    ),
  ).toBeVisible();
  const before = page.url();
  await share.click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-link', before);
  await expect(page.getByRole('status')).toHaveText('Lien de la configuration copié');
  expect(page.url()).toBe(before);
  await page.getByRole('grid').press('ArrowRight');
  const changed = page.url();
  expect(changed).not.toBe(before);
  await share.click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-link', changed);
  await page.getByRole('grid').press('Enter');
  const close = page.getByRole('button', { name: 'Fermer', exact: true });
  await expect(close).toBeVisible();
  await expect(
    page.getByText(mobile ? 'Glisser pour tourner · Pincer pour zoomer' : /^← ↑ ↓ → Tourner$/, {
      exact: mobile,
    }),
  ).toBeVisible();
  const headerBox = await share.boundingBox();
  const closeBox = await close.boundingBox();
  expect(closeBox!.y).toBeGreaterThan(headerBox!.y + headerBox!.height);
  const iconHref = await page.locator('link[rel="icon"]').getAttribute('href');
  const icon = await request.get(iconHref!);
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('viewBox="0 0 40 40"');
  expect(await icon.text()).not.toContain('#863bff');
});

test('un presse-papiers refusé affiche un lien sélectionné et Échap conserve la vue 3D', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
      configurable: true,
    });
  });
  await page.goto(link);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  await page.getByRole('grid').press('Enter');
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  const current = page.url();
  await page.getByRole('button', { name: 'Partager la configuration', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Partager votre montre' });
  await expect(dialog).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Lien de la configuration', exact: true });
  await expect(input).toHaveValue(current);
  const selection = await input.evaluate((element: HTMLInputElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    length: element.value.length,
  }));
  expect(selection).toEqual({ start: 0, end: current.length, length: current.length });
  await page.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText(/Le lien est sélectionné/);
  await input.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Partager la configuration', exact: true }),
  ).toBeFocused();
  expect(page.url()).toBe(current);
});

test('le partage natif utilise la configuration et une annulation ne copie rien', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        document.documentElement.dataset.nativeShare = JSON.stringify(data);
        if (document.documentElement.dataset.cancelShare === 'yes')
          throw new DOMException('Cancelled', 'AbortError');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          document.documentElement.dataset.unwantedCopy = 'yes';
        },
      },
    });
  });
  await page.goto(link);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  const share = page.getByRole('button', { name: 'Partager la configuration', exact: true });
  await share.click();
  const sent = JSON.parse((await page.locator('html').getAttribute('data-native-share'))!);
  expect(sent).toMatchObject({ url: page.url(), title: 'Épure · Ma montre' });
  await page.evaluate(() => {
    document.documentElement.dataset.cancelShare = 'yes';
  });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-unwanted-copy', 'yes');
});

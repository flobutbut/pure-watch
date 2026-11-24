import { expect, test } from '@playwright/test';
test.setTimeout(90_000);
const link =
  '/#v1.' +
  Buffer.from(JSON.stringify({ a: 3, x: '#173548', ac: 3, ad: 3, ae: '#EAE6DC', af: 3 })).toString(
    'base64url',
  );
/** Shared links carry a marker that opens them on the 3D preview. */
const shared = (url: string) => {
  const target = new URL(url);
  target.searchParams.set('view', '3d');
  return target.href;
};

test('le partage ouvre une modale qui copie le lien courant, les aides suivent la vue et le favicon porte Épure', async ({
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
  const dialog = page.getByRole('dialog', { name: 'Partager votre montre' });
  await share.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Lien de la configuration' })).toHaveValue(
    shared(before),
  );
  await dialog.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-link', shared(before));
  await expect(dialog.getByRole('status')).toHaveText('Lien de la configuration copié');
  expect(page.url()).toBe(before);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(share).toBeFocused();
  await page.getByRole('grid').press('ArrowRight');
  const changed = page.url();
  expect(changed).not.toBe(before);
  await share.click();
  await dialog.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-link', shared(changed));
  await dialog.getByRole('button', { name: 'Fermer le partage', exact: true }).click();
  await expect(dialog).not.toBeVisible();
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

test('la modale de partage propose les réseaux sociaux et l’e-mail avec le lien courant', async ({
  page,
}) => {
  await page.goto(link);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  const current = page.url();
  const encoded = encodeURIComponent(shared(current));
  await page.getByRole('button', { name: 'Partager la configuration', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Partager votre montre' });
  for (const [name, prefix] of [
    ['WhatsApp', 'https://wa.me/'],
    ['Facebook', 'https://www.facebook.com/sharer/'],
    ['X', 'https://x.com/intent/tweet'],
    ['LinkedIn', 'https://www.linkedin.com/sharing/'],
    ['Telegram', 'https://t.me/share/url'],
  ]) {
    const anchor = dialog.getByRole('link', { name: `Partager sur ${name}`, exact: true });
    await expect(anchor).toHaveAttribute('target', '_blank');
    await expect(anchor).toHaveAttribute('rel', /noopener/);
    const href = (await anchor.getAttribute('href'))!;
    expect(href.startsWith(prefix)).toBe(true);
    expect(href).toContain(encoded);
  }
  const mail = dialog.getByRole('link', { name: 'Partager par e-mail', exact: true });
  const mailHref = (await mail.getAttribute('href'))!;
  expect(mailHref.startsWith('mailto:?subject=')).toBe(true);
  expect(mailHref).toContain(encoded);
});

test('le pied de page ouvre la modale À propos avec le contact et les mentions légales', async ({
  page,
}) => {
  await page.goto(link);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  const about = page.getByRole('button', { name: 'À propos', exact: true });
  await about.click();
  const dialog = page.getByRole('dialog', { name: 'À propos d’Épure' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tous droits réservés', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Mentions légales' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'f.butour@gmail.com' }).first()).toHaveAttribute(
    'href',
    /^mailto:f\.butour@gmail\.com/,
  );
  const current = page.url();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(about).toBeFocused();
  expect(page.url()).toBe(current);
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
  await expect(input).toHaveValue(shared(current));
  const selection = await input.evaluate((element: HTMLInputElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    length: element.value.length,
  }));
  const length = shared(current).length;
  expect(selection).toEqual({ start: 0, end: length, length });
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

test('le partage natif reste accessible depuis la modale et une annulation ne copie rien', async ({
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
  const dialog = page.getByRole('dialog', { name: 'Partager votre montre' });
  const more = dialog.getByRole('button', { name: 'Autres applications…', exact: true });
  await share.click();
  await more.click();
  const sent = JSON.parse((await page.locator('html').getAttribute('data-native-share'))!);
  expect(sent).toMatchObject({ url: shared(page.url()), title: 'Épure · Ma montre' });
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.cancelShare = 'yes';
  });
  await share.click();
  await more.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-unwanted-copy', 'yes');
});

test('un lien reçu s’ouvre sur l’aperçu 3D, puis la page reprend son adresse', async ({ page }) => {
  await page.goto(`/?view=3d${link.slice(1)}`);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  const close = page.getByRole('button', { name: 'Fermer', exact: true });
  await expect(close).toBeVisible();
  // The marker only opens the preview once: the address bar is the configuration alone.
  expect(new URL(page.url()).searchParams.has('view')).toBe(false);
  expect(new URL(page.url()).hash).toBe(link.slice(1));
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15000 });
  await expect(page.getByRole('grid')).toBeFocused();
  await expect(close).not.toBeVisible();
});

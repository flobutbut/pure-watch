import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { linkPayload } from './link';
import { hexField } from './hex';
test.setTimeout(90_000);
const link = (data: object) => '/#v1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
const payload = (page: Page) => linkPayload(page.url());
async function bezelRow(page: Page) {
  const grid = page.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 25; i++) {
    const active = await grid.getAttribute('aria-activedescendant');
    if (active?.startsWith('cell-bezel-') && !active.startsWith('cell-bezel-scale-')) break;
    await page.keyboard.press('ArrowUp');
  }
  await expect(grid).toHaveAttribute('aria-activedescendant', /^cell-bezel-(?!scale-)/);
}

test('la lunette tournante conserve sa couleur, sa graduation et sa position dans le lien', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(link({ a: 5, aa: 5 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await bezelRow(page);
  await page.keyboard.press('End');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-rotating',
  );
  expect(payload(page)).toMatchObject({ a: 5, aa: 5, n: 7 });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-bezel-scale-dive-60',
  );
  await page.keyboard.press('End');
  expect(payload(page).p).toBe(4);
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Paramètres de la lunette', exact: true }).click();
  await (await hexField(page)).fill('#316C4E');
  await page.getByRole('button', { name: 'Fermer les couleurs', exact: true }).click();
  expect(payload(page).q).toBe('#316C4E');
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  const clockwise = page.getByRole('button', {
    name: 'Tourner la lunette dans le sens horaire',
    exact: true,
  });
  await clockwise.click();
  await expect(page.getByLabel('Position de la lunette')).toHaveText('3°');
  expect(payload(page).ai).toBe(3);
  await page.getByRole('button', { name: 'Régler la lunette', exact: true }).click();
  await page.getByRole('grid').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Position de la lunette')).toHaveText('6°');
  const saved = page.url();
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  expect(page.url()).toBe(saved);
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Position de la lunette')).toHaveText('6°');
  await page.getByRole('button', { name: 'Réinitialiser la lunette', exact: true }).click();
  expect(payload(page).ai).toBeUndefined();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Fermer la vue 3D', exact: true })).toHaveCount(0);
  await bezelRow(page);
  await page.keyboard.press('Home');
  expect(payload(page)).toMatchObject({ a: 5, aa: 5, p: 4, q: '#316C4E' });
  expect(payload(page).n).toBeUndefined();
  for (let i = 0; i < 10; i++) {
    if (
      (await page.getByRole('grid').getAttribute('aria-activedescendant'))?.startsWith(
        'cell-dial-shape-',
      )
    )
      break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-activedescendant',
    'cell-dial-shape-square',
  );
  expect(errors).toEqual([]);
});

async function arc(page: Page, info: TestInfo, from: number, to: number) {
  // Aim at the ring where the scene draws it: its size and place on screen depend on
  // the view, the open settings panel and the display scale. The camera stays put
  // during the drag, so every point is read once, before the page gets busy turning it.
  const angles = Array.from({ length: 13 }, (_, i) => from + ((to - from) * i) / 12);
  const points = await page.locator('.live canvas').evaluate(
    (canvas, list) =>
      list.map((degrees) =>
        (
          canvas as HTMLCanvasElement & {
            bezelPoint(degrees: number): { x: number; y: number } | null;
          }
        ).bezelPoint(degrees)!,
      ),
    angles,
  );
  const start = points[0]!;
  const mobile = info.project.use.isMobile;
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  if (cdp)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1 }],
    });
  else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
  }
  for (let i = 1; i <= 12; i++) {
    const p = points[i]!;
    if (cdp)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...p, id: 1 }],
      });
    else await page.mouse.move(p.x, p.y);
  }
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else await page.mouse.up();
}

test('le glisser tourne réellement l’anneau, en sens unique pour la plongée et dans les deux sens pour 24 h', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(link({ n: 7 }));
  await expect(page.locator('#boot')).toBeHidden({ timeout: 15_000 });
  await page.getByRole('grid').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Régler la lunette', exact: true }).click();
  // The control brings the camera to the front; wait for its deliberate transition.
  await page.waitForTimeout(750);
  // The caseback occludes the ring: dragging there must not turn a hidden part.
  await page.getByRole('grid').focus();
  await page.keyboard.press('4');
  await page.waitForTimeout(750);
  await arc(page, info, 0, -45);
  expect(payload(page).ai).toBeUndefined();
  await page.keyboard.press('1');
  await page.waitForTimeout(750);
  await expect(
    page.getByRole('button', { name: 'Tourner la lunette dans le sens horaire', exact: true }),
  ).toHaveCount(0);
  await arc(page, info, 0, 45);
  expect(payload(page).ai).toBeUndefined();
  await arc(page, info, 0, -45);
  await expect.poll(() => payload(page).ai ?? 0).toBeGreaterThan(300);
  expect(payload(page).ai).toBeLessThan(330);
  await page.evaluate(
    (hash) => {
      location.hash = hash;
    },
    link({ n: 7, p: 4 }).split('#')[1]!,
  );
  await expect(
    page.getByRole('button', { name: 'Tourner la lunette dans le sens horaire', exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await arc(page, info, 0, 45);
  await expect.poll(() => payload(page).ai ?? 0).toBeGreaterThan(30);
  expect(payload(page).ai).toBeLessThan(60);
  await page.screenshot({
    path: `documentation/rotating-bezel/${info.project.name}-interaction.png`,
  });
  expect(errors).toEqual([]);
});

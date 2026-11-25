import * as THREE from 'three';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import rawCatalog from './data/catalog.json';
import { parseCatalog } from './core/catalog/load';
import { defaultConfig } from './core/config/defaults';
import { detailsSchema } from './core/config/details';
import { subdialAppearance, reserveAppearance, subdialInk } from './core/config/subdials';
import { colorChoice, withColorChoice } from './core/config/colors';
import { encodeConfigHash, decodeConfigHash } from './core/config/url';
import { watchDimensions } from './core/geometry/dimensions';
import { visibleRows } from './core/rules/visibility';
import { identitySections } from './ui/identity/identity';
import { colorForRow } from './ui/grid/row-settings';
import { MaterialLibrary } from './render3d/materials';
import { dialPatternData } from './render3d/dial-patterns';
import * as textures from './render3d/textures';
import { buildCounters, buildSubdial, SUNKEN_DEPTH } from './render3d/parts/subdial';
import { subdialCircle } from './core/config/small-seconds';
import { subdialHand } from './core/config/subdial-hand';
import { buildHands } from './render3d/parts/hands';
import { buildReserveSurface, buildReservePrint, reserveSvg } from './render3d/parts/power-reserve';
import { reserveCircle } from './core/config/power-reserve';
import { chronoCounters } from './core/config/chronograph';
import { subdialStyle, SUBDIAL_STYLES } from './core/config/subdial-style';
import { buildDial } from './render3d/parts/dial';

const catalog = parseCatalog(rawCatalog);
beforeEach(() => {
  vi.spyOn(textures, 'radialGradientTexture').mockImplementation(() => new THREE.CanvasTexture());
  vi.spyOn(textures, 'radialOcclusionTexture').mockImplementation(() => new THREE.CanvasTexture());
  vi.spyOn(textures, 'svgTexture').mockImplementation(() => ({
    texture: new THREE.CanvasTexture(),
    ready: Promise.resolve(),
  }));
});
afterEach(() => vi.restoreAllMocks());

it('uses the existing sub-dial rows and leaves untouched links unchanged', () => {
  const config = defaultConfig();
  expect(
    encodeConfigHash(withColorChoice(config, 'subdials', colorChoice(config, 'subdials'))),
  ).toBe('#2');
  expect(
    catalog.rows.some(
      (row) => row.id === 'small-seconds-finish' || row.id === 'chronograph-finish',
    ),
  ).toBe(false);
  config.complications = [{ type: 'small-seconds', position: '6h' }];
  expect(colorForRow('small-seconds-style', config)).toBe('subdials');
  expect(visibleRows(catalog.rows, config).some((row) => row.id === 'seconds')).toBe(false);
  expect(visibleRows(catalog.rows, config).some((row) => row.id === 'small-seconds-style')).toBe(
    false,
  );
  config.complications = [{ type: 'chronograph', position: 'tricompax' }];
  expect(colorForRow('chronograph-counters', config)).toBe('subdials');
  expect(visibleRows(catalog.rows, config).some((row) => row.id === 'seconds')).toBe(true);
  expect(visibleRows(catalog.rows, config).some((row) => row.id === 'chronograph-counters')).toBe(
    false,
  );
});

it.each(SUBDIAL_STYLES)(
  'shares the %s construction style across all three mini-dials and saves it in links',
  (style) => {
    const config = defaultConfig();
    config.complications = [
      { type: 'small-seconds', position: '3h', style: 'azure' },
      { type: 'power-reserve', position: '9h', style: 'fuel' },
    ];
    config.details = { subdials: { subdialStyle: style }, reserve: { subdialStyle: style } };
    expect(subdialCircle(config, 20)?.style).toBe(style);
    expect(reserveCircle(config, 20)?.style).toBe(style);
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    config.complications = [
      { type: 'chronograph', position: 'vertical', counters: 'light' },
      { type: 'power-reserve', position: '9h', style: 'fuel' },
    ];
    expect(subdialStyle(config)).toBe(style);
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    const traits = identitySections(visibleRows(catalog.rows, config), config).flatMap(
      (s) => s.traits,
    );
    expect(traits.filter((trait) => trait.label === 'Relief du sous-cadran')).toHaveLength(2);
  },
);

it('retains historical small-seconds, panda and reserve styles when the new choice is absent', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'chronograph', position: 'tricompax', counters: 'black' }];
  expect(subdialStyle(config)).toBe('flat');
  expect(subdialAppearance(config).config.dial.finish).toBe('azure');
  expect(subdialStyle(config, 'reserve')).toBe('flat');
  config.details = { subdials: { finish: 'guilloche-chevron' } };
  expect(subdialStyle(config)).toBe('flat');
  config.details.subdials!.subdialStyle = 'sunken';
  expect(subdialStyle(config)).toBe('sunken');
});

it('cuts real recesses and lowers every counter and reserve hand and print to their floors', () => {
  const config = defaultConfig();
  config.complications = [
    { type: 'chronograph', position: 'vertical' },
    { type: 'power-reserve', position: '9h' },
  ];
  config.details = { subdials: { subdialStyle: 'sunken' }, reserve: { subdialStyle: 'sunken' } };
  const library = new MaterialLibrary();
  const d = watchDimensions(config);
  const parts = buildDial(config, d, library, { print: true, printSize: 1 });
  const circles = [
    ...chronoCounters(config, d.dialSafeRadius),
    reserveCircle(config, d.dialSafeRadius)!,
  ];
  const geometry = (parts.dial.children[0] as THREE.Mesh).geometry;
  const p = geometry.getAttribute('position'),
    index = geometry.getIndex()!;
  for (const circle of circles) {
    let covered = false;
    const cross = (a: number, b: number) =>
      (p.getX(b) - p.getX(a)) * (circle.y - p.getY(a)) -
      (p.getY(b) - p.getY(a)) * (circle.x - p.getX(a));
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const signs = [cross(a!, b!), cross(b!, c!), cross(c!, a!)];
      if (signs.every((x) => x >= 0) || signs.every((x) => x <= 0)) covered = true;
    }
    expect(covered).toBe(false);
  }
  const hands = buildHands(config, d, library);
  for (const kind of ['seconds', 'minutes']) {
    const hand =
      hands.seconds.getObjectByName(`${kind}-counter`) ??
      hands.group.getObjectByName(`${kind}-counter`);
    expect(hand!.position.z).toBeCloseTo(-SUNKEN_DEPTH + 0.2);
  }
  expect(hands.group.getObjectByName('reserve-hand')!.position.z).toBeCloseTo(-SUNKEN_DEPTH + 0.2);
  for (const name of ['chrono-print', 'reserve-print']) {
    for (const print of parts.print.getObjectByName(name)!.children)
      expect(print.position.z).toBeCloseTo(-SUNKEN_DEPTH + 0.012);
  }
  library.dispose();
});

it('treats azurage as a finish, with independent fumé on chronograph and reserve surfaces', () => {
  const config = defaultConfig();
  config.complications = [
    { type: 'chronograph', position: 'vertical' },
    { type: 'power-reserve', position: '9h' },
  ];
  const settings = {
    subdialStyle: 'flat' as const,
    finish: 'azure' as const,
    surface: { fume: 0.4 },
  };
  config.details = { subdials: settings, reserve: settings };
  expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  const library = new MaterialLibrary(),
    d = watchDimensions(config);
  const counters = buildCounters(config, d, library, {
    print: false,
    fontCss: Promise.resolve(''),
  })!;
  const reserve = buildReserveSurface(config, d, library)!;
  for (const mesh of [...counters.surface.children, ...reserve.surface.children] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshPhysicalMaterial
  >[]) {
    expect(mesh.material.normalMap).toBeTruthy();
    expect(mesh.material.map).toBeTruthy();
    expect(mesh.material.roughnessMap).toBeTruthy();
    expect(mesh.position.z).toBeCloseTo(0.004);
  }
  const original = library.dial(
    subdialAppearance(config).config,
    chronoCounters(config, d.dialSafeRadius)[0]!.r,
  );
  expect(original.bumpMap).toBeNull();
  expect(original.normalMap).toBeTruthy();
  const traits = identitySections(visibleRows(catalog.rows, config), config).flatMap(
    (s) => s.traits,
  );
  expect(traits.filter((trait) => trait.value === 'Azuré')).toHaveLength(2);
  library.dispose();
});

it('moves legacy azured construction into the finish while retaining an explicitly selected finish', () => {
  const migrated = detailsSchema.parse({
    subdials: { subdialStyle: 'azure', color: '#F2F0EA' },
    reserve: { subdialStyle: 'azure', finish: 'guilloche-woven-3' },
  });
  expect(migrated.subdials).toEqual({ subdialStyle: 'flat', finish: 'azure', color: '#F2F0EA' });
  expect(migrated.reserve).toEqual({ subdialStyle: 'flat', finish: 'guilloche-woven-3' });
});

it('reads the retired railway graphic as a flat mini-dial without losing other settings', () => {
  const parsed = detailsSchema.parse({
    subdials: { subdialStyle: 'rail', finish: 'guilloche-woven-3' },
    reserve: { subdialStyle: 'rail', handColor: '#F0561D' },
  });
  expect(parsed.subdials).toEqual({ subdialStyle: 'flat', finish: 'guilloche-woven-3' });
  expect(parsed.reserve).toEqual({ subdialStyle: 'flat', handColor: '#F0561D' });
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position: '6h', style: 'rail' }];
  expect(subdialStyle(config)).toBe('flat');
});

it('keeps reserve surface, scale and hand independent from the small-seconds settings', () => {
  const config = defaultConfig();
  config.complications = [
    { type: 'small-seconds', position: '3h', style: 'sunken' },
    { type: 'power-reserve', position: '9h', style: 'arc' },
  ];
  const library = new MaterialLibrary();
  expect(buildReserveSurface(config, watchDimensions(config), library)).toBeNull();
  const changed = withColorChoice(config, 'powerReserve', {
    ...colorChoice(config, 'powerReserve'),
    color: '#173745',
    complications: config.complications.map((c) =>
      c.type === 'power-reserve' ? { ...c, style: 'fuel' } : c,
    ),
    details: {
      subdials: {
        finish: 'guilloche-chevron',
        color: '#F2F0EA',
        hand: { style: 'triangle', color: '#2F6BD8' },
      },
      reserve: {
        finish: 'guilloche-honeycomb',
        surface: { fume: 0.3 },
        handStyle: 'diamond',
        handColor: '#F0561D',
      },
    },
  });
  expect(reserveAppearance(changed).config.dial).toMatchObject({
    finish: 'guilloche-honeycomb',
    color: '#173745',
  });
  expect(subdialAppearance(changed).config.dial).toMatchObject({
    finish: 'guilloche-chevron',
    color: '#F2F0EA',
  });
  expect(decodeConfigHash(encodeConfigHash(changed), catalog)).toEqual({
    config: changed,
    notice: '',
  });
  const disc = buildReserveSurface(changed, watchDimensions(changed), library)!.surface
    .children[0] as THREE.Mesh;
  expect((disc.material as THREE.MeshPhysicalMaterial).normalMap).toBeTruthy();
  const hands = buildHands(changed, watchDimensions(changed), library);
  const reserveBlade = hands.group.getObjectByName('reserve-blade') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshPhysicalMaterial
  >;
  const secondsBlade = hands.seconds.getObjectByName('second-blade') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshPhysicalMaterial
  >;
  expect(reserveBlade.material.color.getHexString()).toBe('f0561d');
  expect(secondsBlade.material.color.getHexString()).toBe('2f6bd8');
  const rows = visibleRows(catalog.rows, changed);
  expect(rows.some((row) => row.id === 'power-reserve-style')).toBe(false);
  const traits = identitySections(rows, changed).flatMap((section) => section.traits);
  expect(traits).toContainEqual({ label: 'Échelle de réserve', value: 'Jauge E – F' });
  expect(traits).toContainEqual({ label: 'Aiguille de réserve', value: 'Losange' });
  library.dispose();
});

it('keeps old small-seconds hands and edits them from the sub-dial settings independently', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position: '6h' }];
  config.hands.second = { ...config.hands.second, style: 'triangle', color: '#F0561D' };
  expect(subdialHand(config)).toEqual({ style: 'triangle', color: '#F0561D' });
  const changed = withColorChoice(config, 'subdials', {
    ...colorChoice(config, 'subdials'),
    details: { subdials: { hand: { style: 'diamond', color: '#253F79' } } },
  });
  expect(changed.hands).toBe(config.hands);
  expect(decodeConfigHash(encodeConfigHash(changed), catalog)).toEqual({
    config: changed,
    notice: '',
  });
  const library = new MaterialLibrary();
  const hands = buildHands(changed, watchDimensions(changed), library);
  const blade = hands.seconds.getObjectByName('second-blade') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshPhysicalMaterial
  >;
  expect(blade.material.color.getHexString()).toBe('253f79');
  expect(blade.parent!.position.y).toBeLessThan(0);
  const traits = identitySections(visibleRows(catalog.rows, changed), changed).flatMap(
    (s) => s.traits,
  );
  expect(traits).toContainEqual({ label: 'Aiguille des sous-cadrans', value: 'Losange' });
  library.dispose();
});

it('changes the chronograph counter hands without altering its central seconds hand', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'chronograph', position: 'tricompax' }];
  config.details = { subdials: { hand: { style: 'arrow', color: '#F0561D' } } };
  const library = new MaterialLibrary();
  const hands = buildHands(config, watchDimensions(config), library);
  for (const kind of ['seconds', 'minutes', 'hours']) {
    const blade = (hands.seconds.getObjectByName(`${kind}-counter-blade`) ??
      hands.group.getObjectByName(`${kind}-counter-blade`)) as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshPhysicalMaterial
    >;
    expect(blade.material.color.getHexString()).toBe('f0561d');
  }
  hands.setAngles({ hour: 30, minute: 120, second: 90 });
  expect(hands.seconds.getObjectByName('second-blade')!.parent!.rotation.z).toBe(0);
  expect(hands.seconds.getObjectByName('seconds-counter')!.rotation.z).toBeCloseTo(-Math.PI / 2);
  config.details.subdials!.hand!.style = 'none';
  const hidden = buildHands(config, watchDimensions(config), library);
  hidden.setAngles({ hour: 30, minute: 120, second: 90 });
  expect(hidden.seconds.getObjectByName('seconds-counter')).toBeUndefined();
  expect(hidden.seconds.getObjectByName('second-blade')!.parent!.rotation.z).toBe(0);
  library.dispose();
});

it('retains independent surfaces, colours and identity details in shared links', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position: '6h', style: 'sunken' }];
  config.details = {
    dial: { fume: 0.8 },
    subdials: {
      finish: 'guilloche-fans',
      color: '#F2F0EA',
      surface: { fume: 0.25, grainSize: 0.8 },
    },
  };
  expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  const mini = subdialAppearance(config);
  expect(mini.config.dial).toMatchObject({
    finish: 'guilloche-fans',
    color: '#F2F0EA',
    shape: 'round',
  });
  expect(mini.config.details?.dial).toEqual({ fume: 0.25, grainSize: 0.8 });
  expect(config.dial.finish).toBe('matte');
  const traits = identitySections(visibleRows(catalog.rows, config), config).flatMap(
    (s) => s.traits,
  );
  expect(traits).toContainEqual({
    label: 'Finition des sous-cadrans',
    value: 'Guilloché · éventails',
  });
  expect(traits).toContainEqual({ label: 'Intensité du fumé', value: '25 %' });
  expect(detailsSchema.safeParse({ subdials: { finish: 'not-a-finish' } }).success).toBe(false);
});

it('changes only the sub-dial colour and can restore its matching mode', () => {
  const config = defaultConfig();
  const changed = withColorChoice(config, 'subdials', {
    ...colorChoice(config, 'subdials'),
    color: '#C9A24A',
  });
  expect(changed.dial).toBe(config.dial);
  expect(changed.details?.subdials?.color).toBe('#C9A24A');
  expect(
    withColorChoice(changed, 'subdials', { color: 'match', finish: '', details: {} }).details,
  ).toBeUndefined();
});

it.each(['small-seconds', 'chronograph', 'power-reserve'] as const)(
  'customises %s markings independently and restores automatic contrast',
  async (type) => {
    const config = defaultConfig();
    config.complications = [{ type, position: type === 'chronograph' ? 'vertical' : '9h' }];
    const reserve = type === 'power-reserve';
    config.details = reserve
      ? { reserve: { color: '#111317', ink: '#D3AA54' } }
      : { subdials: { color: '#111317', ink: '#D3AA54' } };
    expect(subdialInk(config, reserve)).toBe('#D3AA54');
    const library = new MaterialLibrary(),
      d = watchDimensions(config);
    const options = { print: true, fontCss: Promise.resolve('') };
    if (reserve) buildReservePrint(config, d, options.fontCss);
    else if (type === 'chronograph') buildCounters(config, d, library, options);
    else buildSubdial(config, d, library, options);
    const markup = await Promise.all(
      vi.mocked(textures.svgTexture).mock.calls.map(([svg]) => Promise.resolve(svg)),
    );
    expect(markup.some((svg) => svg.includes('#D3AA54'))).toBe(true);
    if (reserve) config.details.reserve!.ink = 'auto';
    else config.details.subdials!.ink = 'auto';
    expect(subdialInk(config, reserve)).toBe('#F2F1EC');
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
    library.dispose();
  },
);

it('restores the default low-reserve accent in automatic mode', () => {
  const font = { family: 'Arial', weight: 400 };
  expect(reserveSvg(5, 'fuel', '#111317', font, '', { lowColor: 'auto' })).toBe(
    reserveSvg(5, 'fuel', '#111317', font),
  );
});

it('centres a radial pattern on a small-seconds disc with its own physical texture span', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position: '9h', style: 'flat' }];
  config.details = { subdials: { finish: 'guilloche-spiral-diamonds', color: '#F2F0EA' } };
  const d = watchDimensions(config),
    circle = subdialCircle(config, d.dialSafeRadius)!;
  const library = new MaterialLibrary();
  const parts = buildSubdial(config, d, library, { print: false, fontCss: Promise.resolve('') })!;
  const disc = parts.surface.children[0] as THREE.Mesh<
    THREE.CircleGeometry,
    THREE.MeshPhysicalMaterial
  >;
  expect(disc.position.x).toBe(circle.x);
  expect(disc.geometry.getAttribute('uv').getX(0)).toBe(0.5);
  expect(disc.geometry.getAttribute('uv').getY(0)).toBe(0.5);
  expect((disc.material.normalMap as THREE.DataTexture).image.data).toBe(
    dialPatternData('guilloche-spiral-diamonds', Number((circle.r * 2).toFixed(3))).normal,
  );
  expect(disc.material.color.getHexString()).toBe('f2f0ea');
  library.dispose();
});

it('keeps a sunken bowl and centres its new finish at the bottom of the recess', () => {
  const config = defaultConfig();
  config.complications = [{ type: 'small-seconds', position: '6h', style: 'sunken' }];
  config.details = { subdials: { finish: 'guilloche-chevron' } };
  const library = new MaterialLibrary();
  const parts = buildSubdial(config, watchDimensions(config), library, {
    print: false,
    fontCss: Promise.resolve(''),
  })!;
  const floor = parts.surface.children.find((o) =>
    (o as THREE.Mesh).geometry.getAttribute('color'),
  ) as THREE.Mesh;
  expect(floor.position.z).toBe(-SUNKEN_DEPTH);
  const uv = floor.geometry.getAttribute('uv');
  const values = Array.from({ length: uv.count }, (_, i) => [uv.getX(i), uv.getY(i)]).flat();
  expect(Math.min(...values)).toBeCloseTo(0);
  expect(Math.max(...values)).toBeCloseTo(1);
  library.dispose();
});

it('applies the chosen finish to all chronograph counters and keeps panda colours and legible ink', async () => {
  const config = defaultConfig();
  config.complications = [{ type: 'chronograph', position: 'tricompax', counters: 'black' }];
  config.details = { subdials: { finish: 'guilloche-honeycomb' } };
  const library = new MaterialLibrary();
  const parts = buildCounters(config, watchDimensions(config), library, {
    print: true,
    fontCss: Promise.resolve(''),
  })!;
  const discs = parts.surface.children as THREE.Mesh<
    THREE.CircleGeometry,
    THREE.MeshPhysicalMaterial
  >[];
  expect(discs).toHaveLength(3);
  expect(
    discs.every(
      (disc) => disc.material.normalMap && disc.material.color.getHexString() === '17191d',
    ),
  ).toBe(true);
  expect(new Set(discs.map((disc) => disc.material)).size).toBe(1);
  const markup = await Promise.all(
    vi.mocked(textures.svgTexture).mock.calls.map(([svg]) => Promise.resolve(svg)),
  );
  expect(markup.every((svg) => svg.includes('stroke="#F2F1EC"'))).toBe(true);
  library.dispose();
});

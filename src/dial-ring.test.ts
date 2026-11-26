import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import rawCatalog from './data/catalog.json';
import { parseCatalog } from './core/catalog/load';
import { applyVariant, variantIndexFromConfig } from './core/nav/selection';
import { visibleRows } from './core/rules/visibility';
import { settingsForRow } from './ui/grid/row-settings';
import { identitySections } from './ui/identity/identity';
import { ringMaskSvg } from './render3d/parts/dial-ring';
import { colorChoice, withColorChoice } from './core/config/colors';
import { defaultConfig } from './core/config/defaults';
import {
  dialRing,
  moveRing,
  RING_MIN_WIDTH,
  RING_RAISED_HEIGHT,
  ringSliderRange,
  ringSliderValue,
  ringLift,
  ringRadii,
  ringToneColor,
} from './core/config/dial-ring';
import { ringAppearance, ringInk } from './core/config/subdials';
import { decodeConfigHash, encodeConfigHash } from './core/config/url';
import type { WatchConfig } from './core/config/types';

const catalog = parseCatalog(rawCatalog);
const row = (id: string) => catalog.rows.find((r) => r.id === id)!;
const pick = (config: WatchConfig, variantId: string) =>
  applyVariant(
    config,
    row('dial-ring'),
    row('dial-ring').variants.findIndex((v) => v.id === variantId),
  );
const roundTrip = (config: WatchConfig) => decodeConfigHash(encodeConfigHash(config), catalog);

describe('panneaux des lignes', () => {
  it('ouvre les réglages de la date depuis sa ligne', () => {
    const config = defaultConfig();
    expect(settingsForRow('date', config)).toBeNull();
    config.complications = [{ type: 'date', position: '3h' }];
    expect(settingsForRow('date', config)).toBe('date');
  });
});

describe('anneau du cadran', () => {
  it('est une ligne du cadran, sans anneau par défaut', () => {
    const config = defaultConfig();
    expect(visibleRows(catalog.rows, config).map((r) => r.id)).toContain('dial-ring');
    expect(dialRing(config)).toBeNull();
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(0);
    expect(settingsForRow('dial-ring', config)).toBeNull();
  });

  it('est un anneau unique, ajouté avec ses proportions, puis retiré', () => {
    expect(row('dial-ring').variants.map((v) => v.id)).toEqual(['none', 'ring']);
    let config = pick(defaultConfig(), 'ring');
    expect(dialRing(config)).toEqual({ inner: 0.69, outer: 0.95, relief: 'flat' });
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(1);
    expect(settingsForRow('dial-ring', config)).toBe('ring');

    config = pick(config, 'none');
    expect(dialRing(config)).toBeNull();
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(0);
    expect(roundTrip(config).notice).toBe('');
  });

  it('se règle par trois curseurs : intérieur, position, extérieur', () => {
    const ring = { inner: 0.6, outer: 0.8, relief: 'flat' } as const;
    // L'intérieur à zéro ferme l'anneau en disque plein.
    expect(ringSliderRange(ring, 'inner').min).toBe(0);
    expect(moveRing(ring, 'inner', 0)).toEqual({ inner: 0, outer: 0.8 });
    // L'extérieur va jusqu'au rehaut, pas au-delà.
    expect(ringSliderRange(ring, 'outer').max).toBe(1);
    expect(moveRing(ring, 'outer', 1.2)).toEqual({ inner: 0.6, outer: 1 });
    // La position fait glisser la bande, à épaisseur constante, sans sortir du cadran.
    expect(ringSliderValue(ring, 'position')).toBeCloseTo(0.7);
    expect(moveRing(ring, 'position', 0.5)).toEqual({ inner: 0.4, outer: 0.6 });
    expect(moveRing(ring, 'position', 1)).toEqual({ inner: 0.8, outer: 1 });
    expect(moveRing(ring, 'position', 0)).toEqual({ inner: 0, outer: 0.2 });
  });

  it('descend jusqu’à un cercle fin, un bord poussant l’autre', () => {
    const ring = { inner: 0.6, outer: 0.8, relief: 'flat' } as const;
    expect(RING_MIN_WIDTH).toBeLessThanOrEqual(0.01);
    expect(moveRing(ring, 'inner', 0.9)).toEqual({ inner: 0.9, outer: 0.91 });
    expect(moveRing(ring, 'outer', 0.3)).toEqual({ inner: 0.29, outer: 0.3 });
    expect(moveRing(ring, 'inner', 1)).toEqual({ inner: 0.99, outer: 1 });
    // Un réglage hors bornes (lien modifié à la main) reste un anneau dessinable.
    const crossed = withColorChoice(pick(defaultConfig(), 'ring'), 'ring', {
      ...colorChoice(pick(defaultConfig(), 'ring'), 'ring'),
      details: { ring: { shape: 'ring', inner: 0.9, outer: 0.5 } },
    });
    expect(dialRing(crossed)).toMatchObject({ inner: 0.49, outer: 0.5 });
  });

  it('change de réglages en gardant matière et couleur', () => {
    const ring = pick(defaultConfig(), 'ring');
    const tuned = withColorChoice(ring, 'ring', {
      ...colorChoice(ring, 'ring'),
      color: '#C0A060',
      details: {
        ring: { shape: 'ring', inner: 0.1, outer: 0.2, relief: 'raised', finish: 'sunburst' },
      },
    });
    expect(dialRing(tuned)).toEqual({ inner: 0.1, outer: 0.2, relief: 'raised' });
    expect(tuned.details?.ring?.color).toBe('#C0A060');
    // Choisir à nouveau l'anneau dans la grille le ramène à ses proportions d'origine.
    const again = pick(tuned, 'ring');
    expect(dialRing(again)).toEqual({ inner: 0.69, outer: 0.95, relief: 'raised' });
    expect(again.details?.ring).toMatchObject({ color: '#C0A060', finish: 'sunburst' });
  });

  it('passe dans le lien', () => {
    const config = withColorChoice(pick(defaultConfig(), 'ring'), 'ring', {
      color: '#2255AA',
      finish: '',
      details: {
        ring: {
          shape: 'ring',
          inner: 0,
          outer: 0.455,
          relief: 'raised',
          finish: 'grained',
          surface: { grainSize: 1.5 },
        },
      },
    });
    expect(roundTrip(config)).toEqual({ config, notice: '' });
  });

  it.each([
    ['hours', {}, { inner: 0.69, outer: 0.95 }],
    ['outer', {}, { inner: 0.88, outer: 1 }],
    ['center', {}, { inner: 0, outer: 0.6 }],
    ['outer', { diameter: 0.9, width: 0.2 }, { inner: 0.7, outer: 0.9 }],
    ['center', { diameter: 0.5, width: 0.8 }, { inner: 0, outer: 0.5 }],
  ] as const)('lit un ancien lien « %s » %o aux mêmes bords', (shape, sizes, edges) => {
    const old = pick(defaultConfig(), 'ring');
    old.details = { ring: { shape, ...sizes, color: '#2255AA' } as never };
    const { config, notice } = roundTrip(old);
    expect(notice).toBe('');
    expect(config.details?.ring).toEqual({ shape: 'ring', ...edges, color: '#2255AA' });
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(1);
  });

  it('calcule ses rayons, et soulève ce qui repose dessus en relief', () => {
    const flat = pick(defaultConfig(), 'ring');
    const radii = ringRadii(flat, 10)!;
    expect(radii.inner).toBeCloseTo(6.9);
    expect(radii).toMatchObject({ outer: 9.5, relief: 'flat' });
    expect(ringLift(flat, 10, 8)).toBe(0);

    const raised = withColorChoice(flat, 'ring', {
      ...colorChoice(flat, 'ring'),
      details: { ring: { shape: 'ring', relief: 'raised' } },
    });
    expect(ringLift(raised, 10, 8)).toBe(RING_RAISED_HEIGHT);
    expect(ringLift(raised, 10, 5)).toBe(0);
  });

  it('se lit ton sur ton, et imprime à une encre lisible sur lui', () => {
    const dark = pick(defaultConfig(), 'ring');
    dark.dial.color = '#111317';
    const tone = ringToneColor(dark);
    expect(tone).not.toBe('#111317');
    expect(ringAppearance(dark).color).toBe(tone);

    const light = withColorChoice(dark, 'ring', {
      ...colorChoice(dark, 'ring'),
      color: '#F4F2EC',
    });
    expect(ringAppearance(light).color).toBe('#F4F2EC');
    // Anneau clair sur cadran noir : l'impression passe à l'encre sombre sur la bande.
    expect(ringInk(light)).toBe('#1B1F27');
  });

  it('découpe le guichet et les sous-cadrans dans son masque', () => {
    const svg = ringMaskSvg(12, { inner: 6, outer: 9 }, [
      [new THREE.Vector2(7, 0), new THREE.Vector2(8, 1), new THREE.Vector2(8, -1)],
    ]);
    expect(svg).toContain('<circle r="9.000" fill="#FFF"/>');
    expect(svg).toContain('<circle r="6.000" fill="#000"/>');
    expect(svg).toContain('<path d="M7.000 0.000L8.000 -1.000L8.000 1.000Z" fill="#000"/>');
    expect(ringMaskSvg(12, { inner: 6, outer: 9 }, [], true)).toContain(
      '<circle r="9.000" fill="#000"/>',
    );
  });

  it('figure dans la fiche, avec ses bords', () => {
    const config = withColorChoice(pick(defaultConfig(), 'ring'), 'ring', {
      color: '#F4F2EC',
      finish: '',
      details: { ring: { shape: 'ring', relief: 'raised', finish: 'sunburst' } },
    });
    const traits = identitySections(visibleRows(catalog.rows, config), config)
      .flatMap((s) => s.traits)
      .map((t) => `${t.label} : ${t.value}`);
    const start = traits.indexOf('Anneau : Anneau');
    expect(start).toBeGreaterThan(-1);
    expect(traits.slice(start + 1, start + 5)).toEqual([
      'Relief de l’anneau : En relief',
      'Intérieur : 69 % du rayon',
      'Extérieur : 95 % du rayon',
      'Finition de l’anneau : Soleillé',
    ]);
    expect(traits[start + 5]).toMatch(/^Couleur de l’anneau : /);
  });
});

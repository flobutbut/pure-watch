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
  RING_RAISED_HEIGHT,
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

  it('ajoute une forme type avec ses proportions, puis la retire', () => {
    let config = pick(defaultConfig(), 'hours');
    expect(dialRing(config)).toEqual({
      shape: 'hours',
      diameter: 0.95,
      width: 0.26,
      relief: 'flat',
    });
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(1);
    expect(settingsForRow('dial-ring', config)).toBe('ring');

    config = pick(config, 'none');
    expect(dialRing(config)).toBeNull();
    expect(variantIndexFromConfig(row('dial-ring'), config)).toBe(0);
    expect(roundTrip(config).notice).toBe('');
  });

  it('change de forme en gardant matière et couleur, pas les proportions', () => {
    const hours = pick(defaultConfig(), 'hours');
    const tuned = withColorChoice(hours, 'ring', {
      ...colorChoice(hours, 'ring'),
      color: '#C0A060',
      details: {
        ring: { shape: 'hours', diameter: 0.8, width: 0.1, relief: 'raised', finish: 'sunburst' },
      },
    });
    expect(dialRing(tuned)).toMatchObject({ diameter: 0.8, width: 0.1, relief: 'raised' });
    expect(tuned.details?.ring?.color).toBe('#C0A060');

    const center = pick(tuned, 'center');
    expect(dialRing(center)).toEqual({
      shape: 'center',
      diameter: 0.6,
      width: 1,
      relief: 'raised',
    });
    expect(center.details?.ring).toMatchObject({ color: '#C0A060', finish: 'sunburst' });
    expect(variantIndexFromConfig(row('dial-ring'), center)).toBe(3);
  });

  it('passe dans le lien', () => {
    const config = withColorChoice(pick(defaultConfig(), 'outer'), 'ring', {
      color: '#2255AA',
      finish: '',
      details: {
        ring: {
          shape: 'outer',
          diameter: 0.9,
          width: 0.2,
          relief: 'raised',
          finish: 'grained',
          surface: { grainSize: 1.5 },
        },
      },
    });
    expect(roundTrip(config)).toEqual({ config, notice: '' });
  });

  it('calcule ses rayons, et soulève ce qui repose dessus en relief', () => {
    const flat = pick(defaultConfig(), 'hours');
    expect(ringRadii(flat, 10)).toEqual({ inner: 6.9, outer: 9.5, relief: 'flat' });
    expect(ringLift(flat, 10, 8)).toBe(0);

    const raised = withColorChoice(flat, 'ring', {
      ...colorChoice(flat, 'ring'),
      details: { ring: { shape: 'hours', relief: 'raised' } },
    });
    expect(ringLift(raised, 10, 8)).toBe(RING_RAISED_HEIGHT);
    expect(ringLift(raised, 10, 5)).toBe(0);
    // Un disque central part du centre, même avec une largeur plus grande que son rayon.
    expect(ringRadii(pick(defaultConfig(), 'center'), 10)?.inner).toBe(0);
  });

  it('se lit ton sur ton, et imprime à une encre lisible sur lui', () => {
    const dark = pick(defaultConfig(), 'hours');
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

  it('figure dans la fiche, sous sa forme', () => {
    const config = withColorChoice(pick(defaultConfig(), 'hours'), 'ring', {
      color: '#F4F2EC',
      finish: '',
      details: { ring: { shape: 'hours', relief: 'raised', finish: 'sunburst' } },
    });
    const traits = identitySections(visibleRows(catalog.rows, config), config)
      .flatMap((s) => s.traits)
      .map((t) => `${t.label} : ${t.value}`);
    const start = traits.indexOf('Anneau : Anneau des heures');
    expect(start).toBeGreaterThan(-1);
    expect(traits.slice(start + 1, start + 5)).toEqual([
      'Relief de l’anneau : En relief',
      'Diamètre : 95 % du cadran',
      'Largeur : 26 % du rayon',
      'Finition de l’anneau : Soleillé',
    ]);
    expect(traits[start + 5]).toMatch(/^Couleur de l’anneau : /);
  });
});

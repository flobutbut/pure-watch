import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { movementFit } from '../movement/compatibility';
import { MOVEMENTS } from '../movement/movements';
import {
  applyVariant,
  selectionFromConfig,
  syncSelection,
  variantIndexFromConfig,
} from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { complicationHours, resolveLayout } from './complications';
import { dateComplication } from './date';
import { defaultConfig } from './defaults';
import { smallSeconds, subdialCircle } from './small-seconds';
import type { WatchConfig } from './types';
import { decodeConfigHash, encodeConfigHash } from './url';

const catalog = parseCatalog(rawCatalog);
const row = (id: string) => catalog.rows.find((r) => r.id === id)!;
const pick = (config: WatchConfig, rowId: string, variantId: string) =>
  applyVariant(
    config,
    row(rowId),
    row(rowId).variants.findIndex((v) => v.id === variantId),
  );

describe('petite seconde', () => {
  it('se place, prend son style et libère le centre', () => {
    let config = defaultConfig();
    const visible = () => visibleRows(catalog.rows, config).map((r) => r.id);
    expect(visible()).toContain('small-seconds');
    expect(visible()).not.toContain('small-seconds-style');

    config = pick(config, 'small-seconds', '9h');
    expect(smallSeconds(config)).toEqual({ position: '9h', style: 'flat' });
    // Its style is edited inside the complication panel, rather than on a grid row.
    expect(visible()).not.toContain('small-seconds-style');
    expect(variantIndexFromConfig(row('small-seconds-style'), config)).toBe(0);
    expect(complicationHours(config)).toEqual([9]);

    config = pick(config, 'small-seconds-style', 'sunken');
    const circle = subdialCircle(config, 20)!;
    expect(circle).toMatchObject({ x: -10, style: 'sunken' });
    expect(circle.r).toBeCloseTo(5.6);

    config = pick(config, 'small-seconds', 'none');
    expect(config.complications).toEqual([]);
  });

  it('voyage dans le lien de configuration', () => {
    const config = pick(
      pick(pick(defaultConfig(), 'small-seconds', '12h'), 'small-seconds-style', 'rail'),
      'date',
      '6h',
    );
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  });

  it('demande un calibre à petite seconde', () => {
    const config = pick(defaultConfig(), 'small-seconds', '6h');
    for (const id of ['nh35', 'nh36', 'nh38']) {
      const fit = movementFit(config, MOVEMENTS[id]!);
      expect(fit.fit).toBe('no');
      expect(fit.notes[0]).toMatch(/petite seconde/);
    }
  });
});

describe('partage des emplacements', () => {
  it('déloge la date vers la première position libre', () => {
    const dated = pick(defaultConfig(), 'date', '6h');
    const moved = pick(dated, 'small-seconds', '6h');
    expect(smallSeconds(moved)?.position).toBe('6h');
    expect(dateComplication(moved)?.position).toBe('3h');
    // L'inverse : la date choisie à 3 h déplace la petite seconde.
    const back = pick(pick(defaultConfig(), 'small-seconds', '3h'), 'date', '3h');
    expect(smallSeconds(back)?.position).toBe('6h');
    expect(dateComplication(back)?.position).toBe('3h');
  });

  it('garde les réglages de la complication déplacée', () => {
    let config = pick(defaultConfig(), 'date', '12h');
    config = pick(pick(config, 'date-disc', 'black'), 'small-seconds', '12h');
    expect(dateComplication(config)).toEqual({ position: '3h', window: 'framed', disc: 'black' });
  });

  it('retire une complication qui ne trouve plus de place', () => {
    const config = defaultConfig();
    config.complications = [
      { type: 'small-seconds', position: '3h' },
      { type: 'date', position: '3h' },
    ];
    // Aucune position de date ne reste libre si toutes sont prises.
    const full = resolveLayout(
      {
        ...config,
        complications: [
          { type: 'small-seconds', position: '3h' },
          { type: 'date', position: '3h' },
          { type: 'x', position: '4h30' },
          { type: 'y', position: '6h' },
          { type: 'z', position: '12h' },
        ],
      },
      'small-seconds',
    );
    expect(full.complications.map((c) => c.type)).toEqual(['small-seconds', 'x', 'y', 'z']);
    expect(resolveLayout(config, 'small-seconds').complications).toEqual([
      { type: 'small-seconds', position: '3h' },
      { type: 'date', position: '4h30' },
    ]);
  });

  it('remet la ligne Date sur la position réellement portée', () => {
    const before = pick(defaultConfig(), 'date', '6h');
    const after = pick(before, 'small-seconds', '6h');
    const selection = selectionFromConfig(catalog, before);
    const synced = syncSelection(catalog, before, after, selection, 'small-seconds');
    expect(row('date').variants[synced['date']!]!.id).toBe('3h');
    expect(synced['small-seconds']).toBe(selection['small-seconds']);
    expect(synced['hands']).toBe(selection['hands']);
  });
});

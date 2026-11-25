import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { movementFit } from '../movement/compatibility';
import { MOVEMENTS } from '../movement/movements';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { chronoCounters, chronograph } from './chronograph';
import { complicationHours } from './complications';
import { dateComplication } from './date';
import { defaultConfig } from './defaults';
import { powerReserve } from './power-reserve';
import { smallSeconds } from './small-seconds';
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
const visible = (config: WatchConfig) => visibleRows(catalog.rows, config).map((r) => r.id);

describe('chronographe', () => {
  it('se place par disposition, avec ses compteurs et ses poussoirs', () => {
    let config = defaultConfig();
    expect(visible(config)).toEqual(expect.arrayContaining(['small-seconds', 'crown-position']));
    config = pick(config, 'chronograph', 'tricompax');
    expect(chronograph(config)).toEqual({
      layout: 'tricompax',
      counters: 'match',
      pushers: 'round',
    });
    expect(complicationHours(config).sort()).toEqual([3, 6, 9]);
    expect(chronoCounters(config, 20).map((c) => `${c.position}:${c.kind}`)).toEqual([
      '9h:seconds',
      '3h:minutes',
      '6h:hours',
    ]);
    // Petite seconde et position de couronne n'ont plus de sens : leurs lignes disparaissent.
    expect(visible(config)).not.toContain('small-seconds');
    expect(visible(config)).not.toContain('crown-position');
    expect(visible(config)).not.toContain('chronograph-counters');
    expect(visible(config)).toContain('chronograph-pushers');
    expect(variantIndexFromConfig(row('chronograph-counters'), config)).toBe(0);
    config = pick(pick(config, 'chronograph-counters', 'black'), 'chronograph-pushers', 'pump');
    config = pick(config, 'chronograph', 'vertical');
    expect(chronograph(config)).toEqual({ layout: 'vertical', counters: 'black', pushers: 'pump' });
    config = pick(config, 'chronograph', 'none');
    expect(config.complications).toEqual([]);
  });

  it('remplace la petite seconde et ramène la couronne à 3 h', () => {
    let config = pick(defaultConfig(), 'small-seconds', '6h');
    config = pick(config, 'crown-position', '4h');
    config = pick(config, 'chronograph', 'bicompax');
    expect(smallSeconds(config)).toBeNull();
    expect(config.crown.position).toBe('3h');
  });

  it('déloge la date et la réserve vers les heures libres', () => {
    let config = pick(pick(defaultConfig(), 'date', '6h'), 'power-reserve', '9h');
    config = pick(config, 'chronograph', 'tricompax');
    expect(dateComplication(config)?.position).toBe('4h30');
    expect(powerReserve(config)?.position).toBe('12h');
    // L'inverse : une date à 3 h fait passer le bicompax en vertical.
    config = pick(pick(defaultConfig(), 'chronograph', 'bicompax'), 'date', '3h');
    expect(chronograph(config)?.layout).toBe('vertical');
  });

  it('voyage dans le lien de configuration', () => {
    let config = pick(defaultConfig(), 'chronograph', 'tricompax');
    config = pick(pick(config, 'chronograph-counters', 'light'), 'chronograph-pushers', 'pump');
    config = pick(config, 'date', '4h30');
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  });

  it('demande un calibre chronographe, ou un quartz à vérifier', () => {
    const config = pick(defaultConfig(), 'chronograph', 'bicompax');
    for (const id of ['nh35', 'nh36', 'nh38']) {
      const fit = movementFit(config, MOVEMENTS[id]!);
      expect(fit.fit).toBe('no');
      expect(fit.notes[0]).toMatch(/chronographe/);
    }
    const quartz = movementFit(config, MOVEMENTS['quartz']!);
    expect(quartz.fit).toBe('check');
    expect(quartz.notes[0]).toMatch(/mécaquartz/);
  });
});

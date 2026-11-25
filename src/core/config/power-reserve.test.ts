import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { movementFit } from '../movement/compatibility';
import { MOVEMENTS } from '../movement/movements';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { chronoCounters } from './chronograph';
import { COMPLICATION_POSITIONS, complicationHours, resolveLayout } from './complications';
import { DATE_POSITIONS, DATE_WINDOW_SIZE } from './date';
import { defaultConfig } from './defaults';
import {
  POWER_RESERVE_POSITIONS,
  powerReserve,
  RESERVE_HALF_ANGLE,
  RESERVE_LEVEL,
  reserveAngle,
  reserveGauge,
} from './power-reserve';
import { smallSeconds, SMALL_SECONDS_POSITIONS, SUBDIAL_RADIUS } from './small-seconds';
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

describe('réserve de marche', () => {
  it('se place, prend son échelle et se retire', () => {
    let config = defaultConfig();
    const visible = () => visibleRows(catalog.rows, config).map((r) => r.id);
    expect(visible()).not.toContain('power-reserve-style');
    config = pick(config, 'power-reserve', '9h');
    expect(powerReserve(config)).toEqual({ position: '9h', style: 'arc' });
    // Its style is edited inside the complication panel, rather than on a grid row.
    expect(visible()).not.toContain('power-reserve-style');
    expect(variantIndexFromConfig(row('power-reserve-style'), config)).toBe(0);
    expect(complicationHours(config)).toEqual([9]);
    config = pick(config, 'power-reserve-style', 'fuel');
    expect(powerReserve(config)?.style).toBe('fuel');
    config = pick(config, 'power-reserve', 'none');
    expect(config.complications).toEqual([]);
  });

  it('indique l’énergie restante, du vide à gauche au plein à droite', () => {
    expect(reserveAngle(0)).toBe(-RESERVE_HALF_ANGLE);
    expect(reserveAngle(1)).toBe(RESERVE_HALF_ANGLE);
    expect(reserveAngle()).toBeCloseTo(
      -RESERVE_HALF_ANGLE + 2 * RESERVE_HALF_ANGLE * RESERVE_LEVEL,
    );
  });

  it('voyage dans le lien de configuration', () => {
    const config = pick(
      pick(pick(defaultConfig(), 'power-reserve', '12h'), 'power-reserve-style', 'segments'),
      'small-seconds',
      '6h',
    );
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  });

  it('demande un calibre à indicateur, et refuse le quartz', () => {
    const config = pick(defaultConfig(), 'power-reserve', '9h');
    for (const id of ['nh35', 'nh36', 'nh38']) {
      const fit = movementFit(config, MOVEMENTS[id]!);
      expect(fit.fit).toBe('no');
      expect(fit.notes.join(' ')).toMatch(/indicateur de réserve/);
    }
    const quartz = movementFit(config, MOVEMENTS['quartz']!);
    expect(quartz.fit).toBe('no');
    expect(quartz.notes[0]).toMatch(/pile/);
    // Sans réserve, le quartz reste à vérifier.
    expect(movementFit(defaultConfig(), MOVEMENTS['quartz']!).fit).toBe('check');
  });

  it('partage les positions avec la petite seconde', () => {
    const config = pick(pick(defaultConfig(), 'small-seconds', '9h'), 'power-reserve', '9h');
    expect(powerReserve(config)?.position).toBe('9h');
    expect(smallSeconds(config)?.position).toBe('6h'); // première place libre préférée
  });
});

/** Boîtes englobantes de ce que dessine une complication, en fraction du rayon du cadran. */
function boxes(type: string, position: string) {
  const config = defaultConfig();
  config.complications = [{ type, position }];
  if (type === 'date') {
    const [x, y] = DATE_POSITIONS[position]!;
    const { width, height } = DATE_WINDOW_SIZE;
    return [{ x0: x - width / 2, x1: x + width / 2, y0: y - height / 2, y1: y + height / 2 }];
  }
  if (type === 'small-seconds') {
    const [x, y] = SMALL_SECONDS_POSITIONS[position]!;
    const r = SUBDIAL_RADIUS;
    return [{ x0: x - r, x1: x + r, y0: y - r, y1: y + r }];
  }
  if (type === 'chronograph')
    return chronoCounters(config, 1).map((c) => ({
      x0: c.x - c.r,
      x1: c.x + c.r,
      y0: c.y - c.r,
      y1: c.y + c.r,
    }));
  const g = reserveGauge(config, 1)!;
  const side = g.r * Math.sin((RESERVE_HALF_ANGLE * Math.PI) / 180);
  return [{ x0: g.x - side, x1: g.x + side, y0: g.y - g.r * 0.25, y1: g.y + g.r }];
}

describe('emplacements des complications', () => {
  const types = Object.keys(COMPLICATION_POSITIONS);
  // Paires qui peuvent coexister : heures occupées disjointes, et pas d'exclusion.
  const pairs = types.flatMap((a, i) =>
    types.slice(i + 1).flatMap((b) =>
      COMPLICATION_POSITIONS[a]!.flatMap((pa) =>
        COMPLICATION_POSITIONS[b]!.filter((pb) => {
          const config = defaultConfig();
          config.complications = [
            { type: a, position: pa },
            { type: b, position: pb },
          ];
          return resolveLayout(config, a) === config;
        }).map((pb) => [a, pa, b, pb] as const),
      ),
    ),
  );

  it.each(pairs)('%s à %s et %s à %s ne se chevauchent pas', (a, pa, b, pb) => {
    for (const p of boxes(a, pa))
      for (const q of boxes(b, pb)) {
        const apart = p.x1 <= q.x0 || q.x1 <= p.x0 || p.y1 <= q.y0 || q.y1 <= p.y0;
        expect(apart).toBe(true);
      }
  });

  it('restent toutes dans le cadran, en deçà des index', () => {
    for (const type of types)
      for (const position of COMPLICATION_POSITIONS[type]!)
        for (const b of boxes(type, position)) {
          const corner = Math.max(
            ...[b.x0, b.x1].flatMap((x) => [b.y0, b.y1].map((y) => Math.hypot(x, y))),
          );
          expect(corner).toBeLessThan(0.9);
        }
  });

  it('couvrent toutes les complications du catalogue', () => {
    expect(POWER_RESERVE_POSITIONS).toHaveProperty('9h');
    expect(Object.keys(COMPLICATION_POSITIONS)).toEqual([
      'date',
      'small-seconds',
      'power-reserve',
      'chronograph',
    ]);
  });
});

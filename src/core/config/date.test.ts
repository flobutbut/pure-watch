import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { movementFit } from '../movement/compatibility';
import { MOVEMENTS } from '../movement/movements';
import { applyVariant, variantIndexFromConfig } from '../nav/selection';
import { visibleRows } from '../rules/visibility';
import { dateComplication, dateHour } from './date';
import { defaultConfig } from './defaults';
import { decodeConfigHash, encodeConfigHash } from './url';
import { getAtPath, setAtPath } from './path';

const catalog = parseCatalog(rawCatalog);
const row = (id: string) => catalog.rows.find((r) => r.id === id)!;
const pick = (config: ReturnType<typeof defaultConfig>, rowId: string, variantId: string) =>
  applyVariant(
    config,
    row(rowId),
    row(rowId).variants.findIndex((v) => v.id === variantId),
  );

describe('complications par type', () => {
  it('lit, crée, complète et retire un élément typé', () => {
    const empty = defaultConfig();
    expect(getAtPath(empty, 'complications.date')).toBeNull();
    expect(getAtPath(empty, 'complications.date.position')).toBeUndefined();

    const dated = setAtPath(empty, 'complications.date', { position: '3h' });
    expect(dated.complications).toEqual([{ type: 'date', position: '3h' }]);
    expect(empty.complications).toEqual([]);

    const styled = setAtPath(dated, 'complications.date.disc', 'black');
    const moved = setAtPath(styled, 'complications.date', { position: '6h' });
    expect(moved.complications).toEqual([{ type: 'date', position: '6h', disc: 'black' }]);

    expect(setAtPath(moved, 'complications.date', null).complications).toEqual([]);
    // Régler le style d'une date absente ne crée pas de guichet incomplet.
    expect(setAtPath(empty, 'complications.date.disc', 'black').complications).toEqual([]);
  });

  it('garde les autres complications à leur place', () => {
    const config = defaultConfig();
    config.complications = [{ type: 'moon', position: '6h' }];
    const next = setAtPath(config, 'complications.date', { position: '3h' });
    expect(next.complications.map((c) => c.type)).toEqual(['moon', 'date']);
  });
});

describe('date', () => {
  it('ajoute la date et ses réglages, puis la retire', () => {
    let config = defaultConfig();
    const visible = () => visibleRows(catalog.rows, config).map((r) => r.id);
    expect(visible()).toContain('date');
    expect(visible()).not.toContain('date-disc');
    expect(dateComplication(config)).toBeNull();

    config = pick(config, 'date', '4h30');
    expect(visible()).toEqual(expect.arrayContaining(['date-window', 'date-disc', 'date-loupe']));
    expect(dateComplication(config)).toEqual({ position: '4h30', window: 'framed', disc: 'white' });
    // Valeurs par défaut = première variante de chaque ligne.
    expect(variantIndexFromConfig(row('date-window'), config)).toBe(0);
    expect(variantIndexFromConfig(row('date-disc'), config)).toBe(0);

    config = pick(pick(config, 'date-disc', 'dial'), 'date', '6h');
    expect(dateComplication(config)).toEqual({ position: '6h', window: 'framed', disc: 'dial' });
    expect(variantIndexFromConfig(row('date'), config)).toBe(3);

    config = pick(config, 'date', 'none');
    expect(config.complications).toEqual([]);
    expect(variantIndexFromConfig(row('date'), config)).toBe(0);
  });

  it('retire l’index et le chiffre de l’heure occupée', () => {
    const at = (id: string) => dateHour(pick(defaultConfig(), 'date', id));
    expect([at('3h'), at('4h30'), at('6h'), at('12h'), at('none')]).toEqual([3, null, 6, 0, null]);
  });

  it('voyage dans le lien de configuration', () => {
    let config = pick(defaultConfig(), 'date', '12h');
    config = pick(
      pick(pick(config, 'date-window', 'plain'), 'date-disc', 'black'),
      'date-loupe',
      'cyclops',
    );
    expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
  });

  it('signale le mouvement qui convient', () => {
    const notes = (position: string, movement: string) =>
      movementFit(pick(defaultConfig(), 'date', position), MOVEMENTS[movement]!);
    expect(notes('3h', 'nh35').notes.join(' ')).not.toMatch(/Date|guichet/);
    expect(notes('6h', 'nh35').notes.join(' ')).toMatch(/Date à 6 h/);
    expect(notes('3h', 'nh38').fit).toBe('no');
  });
});

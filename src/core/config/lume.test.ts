import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { colorChoice, withColorChoice } from './colors';
import { defaultConfig } from './defaults';
import {
  hasLume,
  LUME_PIGMENTS,
  pigmentChoice,
  lumeChoice,
  enableLume,
  normalizeLume,
} from './lume';
import { decodeConfigHash, encodeConfigHash } from './url';

const catalog = parseCatalog(rawCatalog);
describe('matières et luminescence indépendantes', () => {
  it.each(LUME_PIGMENTS)(
    '$name impose son couple de couleurs, le partage et le retrouve après désactivation',
    (pigment) => {
      const config = defaultConfig();
      const next = withColorChoice(config, 'hands', {
        ...colorChoice(config, 'hands'),
        lume: { kind: pigment.id, day: '#FF0000', night: '#000000' },
      });
      expect(colorChoice(next, 'hands').lume).toEqual(pigmentChoice(pigment));
      const loaded = decodeConfigHash(encodeConfigHash(next), catalog).config;
      expect(colorChoice(loaded, 'hands').lume).toEqual(pigmentChoice(pigment));
      expect(enableLume({ ...pigmentChoice(pigment), kind: null })).toEqual(pigmentChoice(pigment));
    },
  );
  it('un ancien lien libre migre vers une référence et devient stable au rechargement', () => {
    const oldHash =
      '#v1.' +
      btoa(JSON.stringify({ K: 'custom', as: '#A35128', at: '#AF43E1' })).replace(/=+$/, '');
    const loaded = decodeConfigHash(oldHash, catalog);
    expect(loaded.notice).toBe('adjusted');
    const next = loaded.config;
    expect(LUME_PIGMENTS.map((p) => p.id)).toContain(next.hands.lume);
    expect(normalizeLume(next)).toBe(next);
    expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
    expect(enableLume({ ...lumeChoice(next.hands), kind: null })).toEqual(lumeChoice(next.hands));
    next.hands.lume = 'BG W9';
    expect(lumeChoice(next.hands)).toEqual(pigmentChoice(LUME_PIGMENTS[1]));
  });
  it.each(['indices', 'hands'] as const)(
    '%s conserve les autres pièces et les couleurs après désactivation',
    (target) => {
      const original = defaultConfig();
      const choice = {
        ...colorChoice(original, target),
        finish: target === 'indices' ? 'applied-gold' : 'blued',
        lume: pigmentChoice(LUME_PIGMENTS[1]),
      };
      const next = withColorChoice(original, target, choice);
      expect(target === 'indices' ? next.hands : next.dial).toBe(
        target === 'indices' ? original.hands : original.dial,
      );
      const part = target === 'indices' ? next.dial.indices : next.hands;
      expect(hasLume(part)).toBe(true);
      expect(part).toMatchObject({ lumeColor: '#EDF1E9', lumeEmission: '#65CAFF' });
      expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({
        config: next,
        notice: '',
      });
      const off = withColorChoice(next, target, {
        ...choice,
        lume: { ...choice.lume, kind: null },
      });
      expect(colorChoice(off, target).lume).toEqual({ ...choice.lume, kind: null });
      expect(original.hands.lume).toBeNull();
      expect(original.dial.indices.lume).toBeNull();
    },
  );
  it('garde les liens existants sans inserts et les anciens noms de lume lisibles', () => {
    const original = decodeConfigHash('#v1.e30', catalog).config;
    expect(encodeConfigHash(original)).toBe('#v1.e30');
    expect(hasLume(original.hands)).toBe(false);
    expect(hasLume(original.dial.indices)).toBe(false);
    original.dial.indices.lume = 'c3';
    original.hands.lume = 'bgw9';
    const next = decodeConfigHash(encodeConfigHash(original), catalog);
    expect(next).toEqual({ config: normalizeLume(original), notice: '' });
    expect(hasLume(next.config.hands)).toBe(true);
  });
  it('index imprimés : couleur indépendante des chiffres et des inserts', () => {
    const config = defaultConfig();
    const next = withColorChoice(config, 'indices', {
      ...colorChoice(config, 'indices'),
      finish: 'printed',
      color: '#123ABC',
    });
    expect(next.dial.indices).toMatchObject({
      finish: 'printed',
      color: '#123ABC',
      numeralColor: 'match',
      lume: null,
    });
    expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
  });
});

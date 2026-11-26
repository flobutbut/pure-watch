import { describe, expect, it } from 'vitest';
import { defaultConfig } from './defaults';
import { isFlatInk, materialSchema, numeralMaterial, type MaterialSettings } from './material';

const withNumerals = (numerals: MaterialSettings) => {
  const config = defaultConfig();
  config.details = { numerals };
  return config;
};

describe('matière des chiffres', () => {
  it('reste une encre mate à la couleur des chiffres sans réglage', () => {
    const config = defaultConfig();
    config.dial.indices.numeralColor = '#AA3311';
    const material = numeralMaterial(config);
    expect(material).toEqual({ kind: 'ink', effect: 'matte', color: '#AA3311' });
    expect(isFlatInk(material)).toBe(true);
  });

  it('prend l’effet et la teinte par défaut de chaque matière', () => {
    expect(numeralMaterial(withNumerals({ kind: 'metal' }))).toMatchObject({
      kind: 'metal',
      effect: 'polished',
      metal: 'steel',
    });
    // Un effet d'une autre matière retombe sur celui par défaut.
    expect(numeralMaterial(withNumerals({ kind: 'metal', effect: 'varnished' }))).toMatchObject({
      effect: 'polished',
    });
    expect(numeralMaterial(withNumerals({ kind: 'lume' }))).toMatchObject({
      kind: 'lume',
      pigment: 'c3',
    });
    expect(isFlatInk(numeralMaterial(withNumerals({ kind: 'ink', effect: 'varnished' })))).toBe(
      false,
    );
  });

  it('« Comme les index » reprend leur finition', () => {
    const config = withNumerals({ follow: 'indices' });
    config.dial.indices.finish = 'applied-gold';
    expect(numeralMaterial(config)).toMatchObject({ kind: 'metal', metal: 'gold' });
    config.dial.indices.finish = 'applied-lacquer';
    config.dial.indices.color = '#123456';
    expect(numeralMaterial(config)).toEqual({
      kind: 'ink',
      effect: 'varnished',
      color: '#123456',
    });
    config.dial.indices.finish = 'printed';
    config.dial.indices.lume = 'bgw9';
    expect(numeralMaterial(config)).toMatchObject({ kind: 'lume', pigment: 'bgw9' });
    config.dial.indices.lume = null;
    expect(numeralMaterial(config)).toEqual({ kind: 'ink', effect: 'matte', color: '#123456' });
  });

  it('refuse une matière inconnue dans un lien', () => {
    expect(materialSchema.safeParse({ kind: 'wood' }).success).toBe(false);
    expect(materialSchema.safeParse({ kind: 'metal', metal: 'platinum' }).success).toBe(false);
    expect(materialSchema.safeParse({ follow: 'hands' }).success).toBe(false);
  });
});

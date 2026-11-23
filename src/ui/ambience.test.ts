import { describe, expect, it } from 'vitest';
import { ambienceFor, luminance, mix } from './ambience';

describe('ambienceFor', () => {
  it('cadran noir mat : fond sombre, encre claire, sans dérive', () => {
    const a = ambienceFor({ finish: 'matte', color: '#111317' });
    expect(a.tone).toBe('dark');
    expect(a.ink).toBe('#F2F1EC');
    expect(a.drift).toBe(false);
    expect(luminance(a.base)).toBeGreaterThan(luminance('#111317')); // légèrement éclairci
  });

  it('nacre : fond clair, couches pastel animées', () => {
    const a = ambienceFor({ finish: 'iridescent-pearl', color: '#E9E4DC' });
    expect(a.tone).toBe('light');
    expect(a.ink).toBe('#1B1F27');
    expect(a.drift).toBe(true);
    expect(a.layers).toContain('radial-gradient');
  });

  it('huile : fond sombre irisé, clé distincte de la nacre et du mat', () => {
    const oil = ambienceFor({ finish: 'iridescent-oil', color: '#2B2F3A' });
    expect(oil.tone).toBe('dark');
    expect(oil.drift).toBe(true);
    const keys = new Set([
      oil.key,
      ambienceFor({ finish: 'iridescent-pearl', color: '#E9E4DC' }).key,
      ambienceFor({ finish: 'matte', color: '#111317' }).key,
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('teinte propre', () => {
  it('nacre et huile ignorent la couleur choisie', () => {
    const navy = '#1E3A6B';
    expect(ambienceFor({ finish: 'iridescent-pearl', color: navy })).toEqual(
      ambienceFor({ finish: 'iridescent-pearl', color: '#111317' }),
    );
    expect(ambienceFor({ finish: 'iridescent-oil', color: navy }).tone).toBe('dark');
    expect(ambienceFor({ finish: 'sunburst', color: navy }).key).toContain(navy);
  });
});

describe('mix', () => {
  it('mélange linéairement en RVB', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

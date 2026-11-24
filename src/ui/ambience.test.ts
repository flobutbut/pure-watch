import { describe, expect, it } from 'vitest';
import { RAL_CLASSIC } from '../core/color/ral';
import { ambienceFor, contrast, luminance, mix } from './ambience';

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

describe('lisibilité sur toutes les couleurs de cadran', () => {
  // The interface takes its tone from the dial: every colour a visitor can pick must
  // leave the text readable (WCAG 4.5:1), the faint marks discernible (3:1).
  const sweep: string[] = [];
  for (let r = 0; r < 256; r += 15)
    for (let g = 0; g < 256; g += 15)
      for (let b = 0; b < 256; b += 15)
        sweep.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  const colors = [...RAL_CLASSIC.map((ral) => ral.hex), ...sweep];

  it('encre et encre adoucie à 4,5:1, encre effacée à 3:1, quel que soit le cadran', () => {
    for (const color of colors) {
      const a = ambienceFor({ finish: 'matte', color });
      expect(contrast(a.ink, a.base), color).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.inkSoft, a.base), color).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.inkFaint, a.base), color).toBeGreaterThanOrEqual(3);
    }
  });

  it('un orange vif passe en ton clair : l’encre claire y lirait mal', () => {
    const a = ambienceFor({ finish: 'matte', color: '#FA4402' });
    expect(luminance('#FA4402')).toBeLessThan(0.45);
    expect(a.tone).toBe('light');
  });

  it('le noir et le blanc gardent leur ton et leur fond', () => {
    expect(ambienceFor({ finish: 'matte', color: '#111317' }).base).toBe(
      mix('#111317', '#ffffff', 0.05),
    );
    expect(ambienceFor({ finish: 'matte', color: '#F4F2EC' }).tone).toBe('light');
  });

  it('l’encre adoucie reste plus discrète que l’encre pleine quand le fond le permet', () => {
    const a = ambienceFor({ finish: 'matte', color: '#111317' });
    expect(contrast(a.inkSoft, a.base)).toBeLessThan(contrast(a.ink, a.base));
  });
});

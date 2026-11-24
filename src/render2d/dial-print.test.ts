import { describe, expect, it } from 'vitest';
import { dialPrintSvg } from './dial-print';
import { FONTS } from './fonts';

const base = { dialRadius: 10, chapterRing: 'none', ink: '#000000', numerals: 'cardinal' };

/** Position et taille du chiffre de 12 h (en haut, x = 0). */
function twelve(svg: string): { y: number; size: number } {
  const match = /<text x="0\.000" y="(-?[\d.]+)" font-size="([\d.]+)"[^>]*>12</.exec(svg);
  if (!match) throw new Error('chiffre 12 introuvable');
  return { y: Number(match[1]), size: Number(match[2]) };
}

describe('taille et position des chiffres', () => {
  it('garde la mise en page de référence par défaut', () => {
    expect(twelve(dialPrintSvg(base))).toEqual({ y: -7.4, size: 2 });
    expect(dialPrintSvg(base)).toBe(dialPrintSvg({ ...base, numeralSize: 1, numeralRadius: 1 }));
  });

  it('agrandit les chiffres et les rapproche du centre', () => {
    const { y, size } = twelve(dialPrintSvg({ ...base, numeralSize: 1.5, numeralRadius: 0.6 }));
    expect(size).toBeCloseTo(3);
    expect(y).toBeCloseTo(-7.4 * 0.6);
  });

  it('réduit les chiffres rapprochés du centre pour qu’ils ne se touchent pas', () => {
    const all = { ...base, numerals: 'all', numeralSize: 1.75, numeralRadius: 0.6 };
    const size = Number(/font-size="([\d.]+)"/.exec(dialPrintSvg(all))![1]);
    const gap = 2 * 10 * 0.77 * 0.6 * Math.sin(Math.PI / 12);
    expect(size * 1.25).toBeLessThanOrEqual(gap + 1e-3);
    expect(size).toBeLessThan(10 * 0.14 * 1.75);
  });

  it('arrête un grand chiffre poussé au bord avant la minuterie', () => {
    const { y, size } = twelve(dialPrintSvg({ ...base, numeralSize: 1.75, numeralRadius: 1.1 }));
    expect(-y + size * 0.4).toBeLessThanOrEqual(9 + 1e-3);
  });
});

describe('polices à caractère', () => {
  it.each(['black', 'slab', 'fat-face', 'stencil'])('%s est une police embarquée', (id) => {
    expect(FONTS[id]?.embedded).toBeTruthy();
    expect(FONTS[id]?.load).toBeTypeOf('function');
  });
});

describe('couleur des chiffres', () => {
  it('colore les chiffres sans toucher à la minuterie ni aux textes', () => {
    const svg = dialPrintSvg({
      ...base,
      chapterRing: 'railroad',
      brand: 'ÉPURE',
      numeralInk: '#C9A24A',
    });
    expect(svg).toContain('<g fill="#C9A24A"><text');
    expect(svg).toContain('stroke="#000000" fill="#000000"');
    expect(svg).toMatch(/<g fill="#000000"><text[^>]*>ÉPURE</);
  });

  it('suit l’encre par défaut', () => {
    expect(dialPrintSvg(base)).not.toContain('#C9A24A');
    expect(dialPrintSvg(base)).toMatch(/<g fill="#000000"><text[^>]*>12</);
  });
});

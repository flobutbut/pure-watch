import { describe, expect, it } from 'vitest';
import { dialPrintSvg, NUMERAL_REACH, type DialPrintOptions } from './dial-print';
import { NUMERAL_RADIUS_RANGE } from '../core/config/colors';
import { FONTS } from './fonts';

const base = { dialRadius: 10, chapterRing: 'none', ink: '#000000', numerals: 'cardinal' };
const labels = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);

it('scales complete minute dots down to 5%, preserving positions and five-minute hierarchy', () => {
  const options = { ...base, chapterRing: 'dots' };
  const dots = (svg: string) =>
    [
      ...svg.matchAll(
        /<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)" stroke-width="([\d.]+)"/g,
      ),
    ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]), stroke: Number(m[4]) }));
  const original = dots(dialPrintSvg(options));
  expect(dialPrintSvg(options)).toBe(dialPrintSvg({ ...options, chapterRingDotSize: 1 }));
  for (const factor of [0.05, 0.25, 2]) {
    const scaled = dots(dialPrintSvg({ ...options, chapterRingDotSize: factor }));
    expect(scaled).toHaveLength(60);
    for (let i = 0; i < 60; i++) {
      expect(scaled[i]!.x).toBe(original[i]!.x);
      expect(scaled[i]!.y).toBe(original[i]!.y);
      expect(scaled[i]!.r).toBeCloseTo(original[i]!.r * factor, 3);
      expect(scaled[i]!.stroke).toBeCloseTo(original[i]!.stroke * factor, 3);
      expect(original[i]!.r).toBe(i % 5 === 0 ? 0.16 : 0.07);
    }
  }
  for (const chapterRing of ['none', 'railroad', 'ticks', 'five-minute']) {
    expect(dialPrintSvg({ ...base, chapterRing, chapterRingDotSize: 2 })).toBe(
      dialPrintSvg({ ...base, chapterRing }),
    );
  }
});

it.each(['railroad', 'ticks', 'dots', 'five-minute'])(
  'colore la piste %s sans changer les chiffres ni les textes',
  (chapterRing) => {
    const svg = dialPrintSvg({ ...base, chapterRing, chapterRingInk: '#C92750', brand: 'ÉPURE' });
    expect(svg).toContain('<g stroke="#C92750" fill="#C92750"');
    expect(svg).toMatch(/<g fill="#000000"><text[^>]*>ÉPURE</);
    expect(svg).toMatch(/<g fill="#000000"><text[^>]*>12</);
  },
);

describe('écriture romaine indépendante de la disposition', () => {
  it.each([
    ['none', []],
    ['twelve', ['XII']],
    ['six-twelve', ['XII', 'VI']],
    ['cardinal', ['XII', 'III', 'VI', 'IX']],
    ['explorer', ['III', 'VI', 'IX']],
    ['all', ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']],
  ] as const)('%s porte seulement les chiffres romains demandés', (numerals, expected) => {
    expect(labels(dialPrintSvg({ ...base, numerals, numeralSystem: 'roman' }))).toEqual(expected);
  });

  it('retire le chiffre romain occupé par une complication', () => {
    expect(labels(dialPrintSvg({ ...base, numeralSystem: 'roman', omitHours: [3] }))).toEqual([
      'XII',
      'VI',
      'IX',
    ]);
  });

  it('conserve exactement l’impression de l’ancien cadran romain complet', () => {
    const options = {
      ...base,
      chapterRing: 'railroad',
      numeralFont: 'serif',
      numeralSize: 1.3,
      numeralRadius: 0.9,
    };
    expect(dialPrintSvg({ ...options, numerals: 'roman' })).toBe(
      dialPrintSvg({ ...options, numerals: 'all', numeralSystem: 'roman' }),
    );
  });
});

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

  it('arrête un grand chiffre avant la minuterie jusqu’à 100 %', () => {
    const { y, size } = twelve(dialPrintSvg({ ...base, numeralSize: 1.75, numeralRadius: 1 }));
    expect(-y + size * 0.4).toBeLessThanOrEqual(9 + 1e-3);
  });

  it('pousse les chiffres jusqu’au bord, comme les index, au maximum du curseur', () => {
    for (const numeralSize of [0.7, 1, 1.75]) {
      const at = (numeralRadius: number) =>
        twelve(dialPrintSvg({ ...base, numeralSize, numeralRadius }));
      const max = at(NUMERAL_RADIUS_RANGE.max);
      // Le bord extérieur du chiffre touche la limite des index (0,995 R).
      expect(-max.y + max.size * 0.4).toBeCloseTo(10 * NUMERAL_REACH);
      // Entre 100 % et le maximum, la position avance régulièrement.
      const half = at((1 + NUMERAL_RADIUS_RANGE.max) / 2);
      expect(-half.y).toBeCloseTo((-at(1).y - max.y) / 2);
    }
  });
});

describe('polices à caractère', () => {
  it.each(['black', 'slab', 'fat-face', 'stencil'])('%s est une police embarquée', (id) => {
    expect(FONTS[id]?.embedded).toBeTruthy();
    expect(FONTS[id]?.load).toBeTypeOf('function');
  });

  it('écrit des chiffres alignés, de même hauteur, même en italique', () => {
    // Playfair Display (italique) dessine par défaut des chiffres elzéviriens.
    const svg = dialPrintSvg({ ...base, numerals: 'all', numeralFont: 'italic' });
    const texts = svg.match(/<text [^>]*>\d+</g) ?? [];
    expect(texts).toHaveLength(12);
    expect(texts.every((text) => text.includes('font-variant-numeric:lining-nums'))).toBe(true);
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

it('imprime les heures paires et laisse la place à la petite seconde à 6 h', () => {
  expect(labels(dialPrintSvg({ ...base, numerals: 'even', omitHours: [6] }))).toEqual([
    '12',
    '2',
    '4',
    '8',
    '10',
  ]);
  expect(
    labels(
      dialPrintSvg({
        ...base,
        numerals: 'even',
        numeralSystem: 'roman',
        hourMarkers: { '2': 'index', '3': 'numeral', '12': 'none' },
        omitHours: [6],
      }),
    ),
  ).toEqual(['III', 'IIII', 'VIII', 'X']);
  expect(
    labels(dialPrintSvg({ ...base, numerals: 'none', hourMarkers: { '7': 'numeral' } })),
  ).toEqual(['7']);
});

it('borne la taille de quelques chiffres voisins dans une disposition personnalisée', () => {
  const svg = dialPrintSvg({
    ...base,
    numerals: 'none',
    hourMarkers: { '10': 'numeral', '11': 'numeral', '12': 'numeral' },
    numeralSize: 1.75,
    numeralRadius: 0.6,
  });
  const sizes = [...svg.matchAll(/<text[^>]*font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  expect(sizes).toHaveLength(3);
  const available = (2 * 10 * 0.74 * 0.6 * Math.sin(Math.PI / 12)) / 1.25;
  expect(sizes.every((size) => size <= available + 0.001)).toBe(true);
});

it('conserve exactement les anciens tracés avec les nouveaux réglages à leur valeur de référence', () => {
  for (const chapterRing of ['none', 'railroad', 'ticks', 'dots', 'five-minute']) {
    const original = dialPrintSvg({ ...base, chapterRing });
    expect(
      dialPrintSvg({
        ...base,
        chapterRing,
        chapterRingDetails: {
          lineWidth: 1,
          length: 1,
          radius: 1,
          dotSize: 1,
          accentAt: 'none',
          accent: 'auto',
        },
      }),
    ).toBe(original);
  }
});
it('règle la longueur, la position et l’épaisseur de la piste indépendamment des chiffres', () => {
  const original = dialPrintSvg({ ...base, chapterRing: 'ticks' });
  const svg = dialPrintSvg({
    ...base,
    chapterRing: 'ticks',
    chapterRingDetails: {
      length: 1.4,
      lineWidth: 1.5,
      radius: 0.8,
      accentAt: 'quarters',
      accent: '#D7262E',
    },
  });
  expect(svg.match(/<line /g)).toHaveLength(60);
  expect(svg.match(/stroke="#D7262E"/g)).toHaveLength(4);
  const first = svg.match(
    /<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke-width="([\d.]+)"/,
  )!;
  expect(Number(first[2])).toBeCloseTo(-6.928, 3);
  expect(Number(first[4])).toBeCloseTo(-7.88, 3);
  expect(Number(first[5])).toBeCloseTo(0.24, 3);
  expect(labels(svg)).toEqual(labels(original));
});
it('accentue un point de départ sans colorer les autres points ni les chiffres', () => {
  const svg = dialPrintSvg({
    ...base,
    chapterRing: 'dots',
    chapterRingDetails: { dotSize: 0.5, accentAt: 'zero', accent: '#D7262E' },
  });
  expect(svg.match(/stroke="#D7262E"/g)).toHaveLength(1);
  expect(svg.match(/<circle cx=/g)).toHaveLength(60);
  expect(svg).toContain('r="0.080"');
  expect(labels(svg)).toEqual(['12', '3', '6', '9']);
});

it.each(['railroad', 'ticks', 'five-minute'])(
  'applique les dimensions du groupe ciblé pour la piste %s',
  (chapterRing) => {
    const options = { ...base, chapterRing };
    const shared = { length: 1.2, lineWidth: 1.3 };
    const lines = (chapterRingDetails: DialPrintOptions['chapterRingDetails']) =>
      dialPrintSvg({ ...options, chapterRingDetails }).match(/<line [^>]*\/>/g)!;
    const original = lines(shared);
    const longer = lines({ ...shared, major: { length: 1.5 } });
    const thinner = lines({ ...shared, minor: { lineWidth: 0.5 } });
    for (let i = 0; i < original.length; i++) {
      const major = chapterRing === 'five-minute' || i % 5 === 0;
      expect(longer[i] === original[i]).toBe(!major);
      expect(thinner[i] === original[i]).toBe(major);
    }
  },
);

it('dimensionne séparément les deux tailles de points en gardant la taille commune en référence', () => {
  const options = { ...base, chapterRing: 'dots' };
  const dots = (chapterRingDetails: DialPrintOptions['chapterRingDetails']) =>
    dialPrintSvg({ ...options, chapterRingDetails }).match(/<circle cx=[^>]*\/>/g)!;
  const original = dots({ dotSize: 0.8 });
  const changed = dots({ dotSize: 0.8, minor: { dotSize: 0.5 }, major: { dotSize: 1.2 } });
  expect(changed[0]).toBe(dots({ dotSize: 1.2 })[0]);
  expect(changed[1]).toBe(dots({ dotSize: 0.5 })[1]);
  const onlyMajor = dots({ dotSize: 0.8, major: { dotSize: 1.2 } });
  expect(onlyMajor[0]).toBe(changed[0]);
  expect(onlyMajor[1]).toBe(original[1]);
});

it.each(['railroad', 'ticks', 'five-minute'])(
  'étend les grandes graduations de la piste %s du réhaut au centre',
  (chapterRing) => {
    const radiusAt = (angle: number) => 10 + 2 * Math.cos(2 * angle);
    const svg = dialPrintSvg({
      ...base,
      chapterRing,
      extent: 12,
      radiusAt,
      chapterRingDetails: { position: 1, major: { span: 1 }, minor: { span: 0.25 } },
    });
    const ticks = [
      ...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g),
    ];
    expect(ticks[0]!.slice(1).map(Number)).toEqual([0, 0, 0, -8]);
    const [, x0, y0, x1, y1] = ticks[1]!.map(Number);
    expect(Math.hypot(x0!, y0!)).toBeCloseTo(
      chapterRing === 'five-minute' ? 0 : 0.75 * Math.hypot(x1!, y1!),
      3,
    );
    expect(svg).toContain('clip-path="url(#minute-track-edge)"');
  },
);

it('place les points au centre ou au réhaut en gardant leur contour dans le cadran', () => {
  const options = { ...base, chapterRing: 'dots' };
  const firstDot = (position: number) =>
    dialPrintSvg({ ...options, chapterRingDetails: { position } })
      .match(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)" stroke-width="([\d.]+)"/)!
      .slice(1)
      .map(Number);
  expect(firstDot(0).slice(0, 2)).toEqual([0, 0]);
  const [, y, radius, stroke] = firstDot(1);
  expect(-y! + radius! + stroke! / 2).toBeCloseTo(10, 3);
});

import { expect, it } from 'vitest';
import { defaultConfig } from '../core/config/defaults';
import { watchDimensions } from '../core/geometry/dimensions';
import { rehautPrintSvg } from './rehaut-print';

it.each(['round', 'square', 'tonneau', 'rectangle'])(
  '%s: scale marks are printed on the shaped ring, with correct counts and contrast',
  (shape) => {
    const config = defaultConfig();
    config.dial.shape = shape;
    config.rehaut.profile = 'sloped';
    const d = watchDimensions(config);
    for (const [scale, lines, labels] of [
      ['none', 0, 0],
      ['minutes', 60, 0],
      ['five-minute', 60, 12],
      ['24h', 24, 12],
      ['tachymeter', 17, 17],
    ] as const) {
      config.rehaut.scale = scale;
      const svg = rehautPrintSvg(config, d);
      expect(svg.match(/<line /g) ?? []).toHaveLength(lines);
      expect(svg.match(/<text /g) ?? []).toHaveLength(labels);
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
    config.rehaut.finish = 'custom';
    config.rehaut.color = '#FFFFFF';
    expect(rehautPrintSvg(config, d)).not.toBe(
      rehautPrintSvg({ ...config, rehaut: { ...config.rehaut, color: '#111317' } }, d),
    );
  },
);

it('allonge les traits du réhaut sans déplacer leur bord extérieur ni les inscriptions', () => {
  const config = defaultConfig();
  config.rehaut.profile = 'sloped';
  config.rehaut.scale = 'five-minute';
  const d = watchDimensions(config);
  const original = rehautPrintSvg(config, d);
  config.details = { rehaut: { tickLength: 1.5 } };
  const svg = rehautPrintSvg(config, d);
  expect([...svg.matchAll(/<text[^>]*>[^<]+<\/text>/g)].map((m) => m[0])).toEqual(
    [...original.matchAll(/<text[^>]*>[^<]+<\/text>/g)].map((m) => m[0]),
  );
  const first = (text: string) =>
    text.match(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/)!;
  expect(first(svg).slice(1, 3)).toEqual(first(original).slice(1, 3));
  expect(first(svg).slice(3)).not.toEqual(first(original).slice(3));
  config.details.rehaut!.tickLength = 1;
  expect(rehautPrintSvg(config, d)).toBe(original);
});

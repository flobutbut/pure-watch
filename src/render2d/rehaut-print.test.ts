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

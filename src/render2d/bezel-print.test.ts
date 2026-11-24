import { expect, it } from 'vitest';
import { defaultConfig } from '../core/config/defaults';
import { bezelPrintSvg } from './bezel-print';
import { bezelScale } from '../core/config/bezel';
it('prints three distinct scales with contrasting ink on light and dark inserts', () => {
  const config = defaultConfig();
  const prints = new Set<string>();
  for (const scale of ['dive-60', '12h', '24h']) {
    config.bezel.scale = scale;
    config.bezel.color = '#111317';
    const dark = bezelPrintSvg(config, 17.6, 19.6);
    config.bezel.color = '#FFFFFF';
    const light = bezelPrintSvg(config, 17.6, 19.6);
    expect(dark).not.toBe(light);
    expect(dark).not.toMatch(/NaN|undefined/);
    expect(dark.match(/<text /g)?.length).toBe(scale === 'dive-60' ? 5 : 12);
    prints.add(dark);
  }
  expect(prints.size).toBe(3);
});

it('places the fixed tachymeter at reciprocal elapsed times, with contrasting print', () => {
  const config = defaultConfig();
  config.bezel.type = 'fixed-scale';
  expect(bezelScale(config)).toBe('tachymeter');
  const dark = bezelPrintSvg(config, 17.6, 19.6);
  const labels = [...dark.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*>(\d+)<\/text>/g)];
  expect(labels).toHaveLength(17);
  const radius = 19.6 - 2 * 0.64;
  for (const [, x, y, value] of labels) {
    const angle = (3600 / Number(value) / 60) * Math.PI * 2;
    expect(Number(x)).toBeCloseTo(radius * Math.sin(angle), 3);
    expect(Number(y)).toBeCloseTo(-radius * Math.cos(angle), 3);
  }
  expect(dark).not.toMatch(/NaN|undefined/);
  config.bezel.color = '#FFFFFF';
  expect(bezelPrintSvg(config, 17.6, 19.6)).not.toBe(dark);
  config.bezel.type = 'rotating';
  config.bezel.scale = 'tachymeter';
  expect(bezelScale(config)).toBe('dive-60');
});

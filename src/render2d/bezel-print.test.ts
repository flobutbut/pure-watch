import { expect, it } from 'vitest';
import { defaultConfig } from '../core/config/defaults';
import { bezelPrintSvg } from './bezel-print';
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

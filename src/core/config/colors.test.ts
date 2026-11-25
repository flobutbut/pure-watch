import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { defaultConfig } from './defaults';
import {
  colorChoice,
  HAND_FINISHES,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  targetColor,
  withColorChoice,
} from './colors';
import { decodeConfigHash, encodeConfigHash } from './url';

describe('free colours', () => {
  it('normalizes six- and three-digit codes, rejects malformed input', () => {
    expect(normalizeHex(' abc ')).toBe('#AABBCC');
    expect(normalizeHex('#a19e03')).toBe('#A19E03');
    for (const bad of ['', '#ab', '#1234567', 'red', '#12xx22'])
      expect(normalizeHex(bad)).toBeNull();
  });
  it('retains RGB values through the HSV controls, including black and white', () => {
    for (const hex of [
      '#000000',
      '#FFFFFF',
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#123ABC',
      '#F2C230',
      '#777777',
    ]) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
    expect(hsvToHex(360, 100, 100)).toBe('#FF0000');
  });
  it('edits only the selected piece and preserves its neighbours', () => {
    const config = defaultConfig();
    const dial = withColorChoice(config, 'dial', { color: '#123ABC', finish: 'lacquer' });
    expect(dial.hands).toBe(config.hands);
    expect(config.dial.color).toBe('#111317');
    const hands = withColorChoice(dial, 'hands', { color: '#C92750', finish: 'lacquer' });
    expect(hands.dial).toBe(dial.dial);
    expect(hands.hands.second).toBe(config.hands.second);
    const seconds = withColorChoice(hands, 'seconds', { color: 'match', finish: '' });
    expect(targetColor(seconds, 'seconds')).toBe('#C92750');
    expect(colorChoice(seconds, 'hands')).toMatchObject({ color: '#C92750', finish: 'lacquer' });
  });
  it('numerals follow the print ink until a tint is chosen, and can return to it', () => {
    const config = defaultConfig();
    config.dial.indices.numerals = 'all';
    expect(colorChoice(config, 'numerals').color).toBe('match');
    // Dark default dial: light ink. A cream dial gets dark numerals without any choice.
    expect(targetColor(config, 'numerals')).toBe('#F2F1EC');
    expect(targetColor({ ...config, dial: { ...config.dial, color: '#EAE6DC' } }, 'numerals')).toBe(
      '#1B1F27',
    );
    const gold = withColorChoice(config, 'numerals', { color: '#C9A24A', finish: 'print' });
    expect(gold.dial.indices.numeralColor).toBe('#C9A24A');
    expect(targetColor(gold, 'numerals')).toBe('#C9A24A');
    expect(gold.dial.color).toBe(config.dial.color);
    const back = withColorChoice(gold, 'numerals', { color: 'match', finish: 'print' });
    expect(back.dial.indices.numeralColor).toBe('match');
    // The same panel carries the size and position sliders.
    expect(colorChoice(config, 'numerals').layout).toEqual({ size: 1, radius: 1 });
    const moved = withColorChoice(config, 'numerals', {
      color: 'match',
      finish: 'print',
      layout: { size: 1.4, radius: 0.7 },
    });
    expect(moved.dial.indices).toMatchObject({ numeralSize: 1.4, numeralRadius: 0.7 });
    expect(colorChoice(config, 'dial').layout).toBeUndefined();
    // Index controls remain independent of numeral and dial colors.
    const indices = withColorChoice(config, 'indices', {
      color: '#D7262E',
      finish: config.dial.indices.finish,
      layout: { size: 1.2, width: 0.7, radius: 0.8 },
    });
    expect(indices.dial.indices).toMatchObject({
      indexLength: 1.2,
      indexWidth: 0.7,
      indexRadius: 0.8,
    });
    expect(indices.dial.indices.numeralColor).toBe('match');
    expect(indices.dial.color).toBe(config.dial.color);
  });

  it('all materials and custom colours survive links, older links stay steel', () => {
    const catalog = parseCatalog(rawCatalog);
    expect(decodeConfigHash('#v1.e30', catalog).config.hands.color).toBe('#E8EBF0');
    expect(encodeConfigHash(defaultConfig())).toBe('#2');
    for (const finish of HAND_FINISHES) {
      const config = withColorChoice(defaultConfig(), 'hands', {
        color: '#A17FC3',
        finish: finish.id,
      });
      config.hands.second.color = 'match';
      expect(decodeConfigHash(encodeConfigHash(config), catalog)).toEqual({ config, notice: '' });
      if (finish.color) expect(targetColor(config, 'seconds')).toBe(finish.color);
    }
  });

  it('edits the minute track independently and retains it in shared links', () => {
    const catalog = parseCatalog(rawCatalog);
    const config = defaultConfig();
    expect(colorChoice(config, 'chapterRing').color).toBe('match');
    expect(targetColor(config, 'chapterRing')).toBe('#F2F1EC');
    const light = withColorChoice(config, 'dial', { color: '#FFFFFF', finish: '' });
    expect(targetColor(light, 'chapterRing')).toBe('#1B1F27');
    const next = withColorChoice(light, 'chapterRing', { color: '#C92750', finish: 'print' });
    expect(targetColor(next, 'chapterRing')).toBe('#C92750');
    expect(next.dial.indices).toBe(light.dial.indices);
    expect(next.dial.text).toBe(light.dial.text);
    expect(next.hands).toBe(light.hands);
    expect(next.dial.color).toBe('#FFFFFF');
    expect(decodeConfigHash(encodeConfigHash(next), catalog)).toEqual({ config: next, notice: '' });
    expect(decodeConfigHash('#v1.e30', catalog).config.dial.chapterRingColor).toBe('match');
    expect(decodeConfigHash('#2', catalog).config.dial.chapterRingColor).toBe('match');
    const automatic = withColorChoice(next, 'chapterRing', { color: 'match', finish: 'print' });
    expect(targetColor(automatic, 'chapterRing')).toBe('#1B1F27');
  });
});

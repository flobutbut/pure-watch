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
    expect(colorChoice(seconds, 'hands')).toEqual({ color: '#C92750', finish: 'lacquer' });
  });
  it('all materials and custom colours survive links, older links stay steel', () => {
    const catalog = parseCatalog(rawCatalog);
    expect(decodeConfigHash('#v1.e30', catalog).config.hands.color).toBe('#E8EBF0');
    expect(encodeConfigHash(defaultConfig())).toBe('#v1.e30');
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
});

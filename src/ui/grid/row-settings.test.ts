import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { settingsForRow } from './row-settings';

it('ouvre le même panneau boîtier depuis la taille et le boîtier, même sans cornes', () => {
  const config = defaultConfig();
  config.case.lugs = 'none';
  for (const row of ['case-size', 'case-shape'])
    expect(settingsForRow(row, config)).toBe('dimensions');
  expect(settingsForRow('lugs', config)).toBeNull();
});

it('opens date settings only when a date is present', () => {
  const config = defaultConfig();
  expect(settingsForRow('date', config)).toBeNull();
  config.complications = [{ type: 'date', position: '4h30' }];
  expect(settingsForRow('date', config)).toBe('date');
});

it('les repères restent configurables même sans chiffres ni index', () => {
  const config = defaultConfig();
  config.dial.indices.style = 'none';
  expect(settingsForRow('numerals', config)).toBe('markers');
  config.dial.indices.numerals = 'all';
  expect(settingsForRow('numerals', config)).toBe('markers');
});

it('les deux lignes de graduations ouvrent leur propre panneau, même sans tracé', () => {
  const config = defaultConfig();
  config.dial.chapterRing = 'none';
  expect(settingsForRow('chapter-ring', config)).toBe('chapterRing');
  expect(settingsForRow('rehaut-scale', config)).toBe('rehaut');
  expect(settingsForRow('rehaut', config)).toBe('rehaut');
});

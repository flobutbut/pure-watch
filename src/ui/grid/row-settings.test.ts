import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { settingsForRow } from './row-settings';

it('opens date settings only when a date is present', () => {
  const config = defaultConfig();
  expect(settingsForRow('date', config)).toBeNull();
  config.complications = [{ type: 'date', position: '4h30' }];
  expect(settingsForRow('date', config)).toBe('date');
});

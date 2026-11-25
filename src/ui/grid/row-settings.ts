import type { ColorTarget } from '../../core/config/colors';
import { hasIntrinsicColor } from '../../core/config/dial';
import type { WatchConfig } from '../../core/config/types';

/** The colour or settings panel a row's label offers, when its part is shown. */
export function colorForRow(id: string, config: WatchConfig): ColorTarget | null {
  switch (id) {
    case 'chapter-ring':
      return config.dial.chapterRing !== 'none' ? 'chapterRing' : null;
    case 'lugs':
      return config.case.lugs !== 'none' ? 'lugs' : null;
    case 'bezel':
      return 'bezel';
    case 'dial-finish':
      return 'dial';
    case 'hands':
      return 'hands';
    case 'seconds':
      return config.hands.second.style !== 'none' ? 'seconds' : null;
    case 'rehaut':
      return 'rehaut';
    case 'numerals':
      return config.dial.indices.numerals !== 'none' ? 'numerals' : null;
    case 'indices':
      return config.dial.indices.style !== 'none' ? 'indices' : null;
    default:
      return null;
  }
}

/**
 * The settings panel the preview shows beside the watch for a row: its colour or settings
 * panel, the case dimensions, or none (a dial whose material has its own colour has none).
 */
export function settingsForRow(id: string, config: WatchConfig): ColorTarget | 'dimensions' | null {
  if (id === 'case-size') return 'dimensions';
  const target = colorForRow(id, config);
  if (target === 'dial' && hasIntrinsicColor(config.dial.finish)) return null;
  return target;
}

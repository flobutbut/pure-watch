import type { ColorTarget } from '../../core/config/colors';
import { dateComplication } from '../../core/config/date';
import { dialRing } from '../../core/config/dial-ring';
import { hasIntrinsicColor } from '../../core/config/dial';
import type { WatchConfig } from '../../core/config/types';

/** The colour or settings panel a row's label offers, when its part is shown. */
export function colorForRow(id: string, config: WatchConfig): ColorTarget | null {
  switch (id) {
    case 'strap':
      return 'strap';
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
      return config.hands.second.style !== 'none' &&
        !config.complications.some((c) => c.type === 'small-seconds')
        ? 'seconds'
        : null;
    case 'rehaut':
    case 'rehaut-scale':
      return 'rehaut';
    case 'power-reserve':
    case 'power-reserve-style':
      return config.complications.some((c) => c.type === 'power-reserve') ? 'powerReserve' : null;
    case 'small-seconds':
    case 'small-seconds-style':
      return config.complications.some((c) => c.type === 'small-seconds') ? 'subdials' : null;
    case 'chronograph':
    case 'chronograph-counters':
      return config.complications.some((c) => c.type === 'chronograph') ? 'subdials' : null;
    case 'date':
    case 'date-window':
    case 'date-disc':
    case 'date-loupe':
      return dateComplication(config) ? 'date' : null;
    case 'dial-ring':
      return dialRing(config) ? 'ring' : null;
    case 'numerals':
      return config.dial.indices.numerals !== 'none' ? 'numerals' : null;
    case 'indices':
      return 'indices';
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

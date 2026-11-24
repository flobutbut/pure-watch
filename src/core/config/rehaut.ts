import { effectiveDialColor } from './dial';
import type { HexColor, RehautConfig, WatchConfig } from './types';

export const REHAUT_PROFILES = ['classic', 'sloped', 'concave', 'stepped', 'flat'] as const;
export const REHAUT_SCALES = ['none', 'minutes', 'five-minute', '24h', 'tachymeter'] as const;
export const REHAUT_FINISHES = [
  { id: 'dial', name: 'Assorti au cadran' },
  { id: 'metal', name: 'Matière du boîtier' },
  { id: 'custom', name: 'Couleur libre' },
] as const;
export const DEFAULT_REHAUT: Readonly<RehautConfig> = Object.freeze({
  profile: 'classic',
  finish: 'dial',
  color: '#111317',
  scale: 'none',
});

export function rehautSettings(config: WatchConfig): Readonly<RehautConfig> {
  return config.rehaut ?? DEFAULT_REHAUT;
}
export function effectiveRehautProfile(config: WatchConfig): string {
  const profile = rehautSettings(config).profile;
  return REHAUT_PROFILES.some((id) => id === profile) ? profile : 'classic';
}
export function effectiveRehautScale(config: WatchConfig): string {
  const scale = rehautSettings(config).scale;
  return effectiveRehautProfile(config) !== 'classic' && REHAUT_SCALES.some((id) => id === scale)
    ? scale
    : 'none';
}
export function rehautColor(config: WatchConfig): string {
  const settings = rehautSettings(config);
  if (settings.finish === 'custom') return settings.color;
  if (settings.finish !== 'metal') return effectiveDialColor(config.dial);
  if (!['ceramic', 'carbon'].includes(config.case.material) && config.case.finish === 'pvd-black')
    return '#1A1C20';
  const colors: Record<string, HexColor> = {
    steel: '#C9CED6',
    titanium: '#9EA3AA',
    bronze: '#B5803A',
    'gold-yellow': '#E6C068',
    'gold-rose': '#E8B09B',
    brass: '#CDAA52',
    ceramic: '#0E0F12',
    carbon: '#292E35',
  };
  return colors[config.case.material] ?? '#C9CED6';
}

import type { WatchConfig } from './types';

/** A two-hand display has neither a seconds subdial nor a chronograph. */
export function withoutSeconds(config: WatchConfig): WatchConfig {
  if (config.hands.second.style !== 'none') return config;
  return {
    ...config,
    hands: { ...config.hands, second: { ...config.hands.second, counterweight: false } },
    complications: config.complications.filter(
      (c) => c.type !== 'small-seconds' && c.type !== 'chronograph',
    ),
  };
}

/** Adding a seconds complication restores a visible hand, keeping its saved colour. */
export function restoreSeconds(config: WatchConfig): WatchConfig {
  if (config.hands.second.style !== 'none') return config;
  return {
    ...config,
    hands: {
      ...config.hands,
      second: { ...config.hands.second, style: 'thin', counterweight: false },
    },
  };
}

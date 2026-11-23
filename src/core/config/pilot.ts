import { defaultConfig } from './defaults';
import type { WatchConfig } from './types';

/** Reproducible pilot; does not change the default or stored configuration schema. */
export function cushionPilot(): WatchConfig {
  const config = defaultConfig();
  config.case.shape = 'cushion';
  config.case.lugs = 'curved';
  config.dial.finish = 'grained';
  config.dial.color = '#19476B';
  config.dial.indices.style = 'none';
  config.dial.indices.numerals = 'all';
  config.dial.indices.numeralFont = 'geometric';
  config.dial.chapterRing = 'ticks';
  config.hands.set = 'dauphine';
  config.hands.second.style = 'lollipop';
  config.hands.second.color = '#C52B36';
  config.view.time = 'fixed';
  return config;
}

/** Reconstructed from the selected options in the user's configurator. */
export function blackTonneauPilot(): WatchConfig {
  const config = defaultConfig();
  config.case.shape = 'tonneau';
  config.case.material = 'ceramic';
  config.case.lugs = 'none';
  config.crown.style = 'fluted';
  config.crystal.type = 'sapphire-box';
  config.dial.finish = 'sunburst';
  config.dial.color = '#111317';
  config.dial.chapterRing = 'ticks';
  config.dial.indices.style = 'none';
  config.dial.indices.numerals = 'all';
  config.dial.indices.numeralFont = 'condensed';
  config.hands.set = 'baton';
  config.hands.second.style = 'lollipop';
  config.hands.second.color = '#F2C230';
  config.view.time = 'fixed';
  return config;
}

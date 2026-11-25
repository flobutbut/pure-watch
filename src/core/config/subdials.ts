import type { HexColor, WatchConfig } from './types';
import { chronograph, COUNTER_DISCS } from './chronograph';
import { getAtPath } from './path';
import { effectiveDialColor, printInk } from './dial';
import { ringToneColor } from './dial-ring';

/** Existing panda colours remain the fallback when no custom sub-dial colour is selected. */
export function subdialBaseColor(config: WatchConfig): string {
  const counters = chronograph(config)?.counters;
  return counters && counters !== 'match'
    ? COUNTER_DISCS[counters].color
    : effectiveDialColor(config.dial);
}

/** A separate, circular material description, centred on each sub-dial's own pivot. */
export function subdialAppearance(
  config: WatchConfig,
  fallback = subdialBaseColor(config),
  inheritLegacy = true,
) {
  const settings = config.details?.subdials;
  const explicitFinish = Boolean(settings?.finish && settings.finish !== 'original');
  const panda = chronograph(config)?.counters;
  const legacyAzure =
    !explicitFinish &&
    ((settings?.subdialStyle as string | undefined) === 'azure' ||
      (inheritLegacy &&
        (getAtPath(config, 'complications.small-seconds.style') === 'azure' ||
          (panda && panda !== 'match'))));
  const customColor = Boolean(settings?.color && settings.color !== 'match');
  const customSurface = Boolean(settings?.surface && Object.keys(settings.surface).length);
  const customFinish = explicitFinish || Boolean(legacyAzure) || customColor || customSurface;
  const color = customColor ? settings!.color! : fallback;
  const materialConfig: WatchConfig = {
    ...config,
    dial: {
      ...config.dial,
      shape: customFinish ? 'round' : config.dial.shape,
      finish: explicitFinish ? settings!.finish! : legacyAzure ? 'azure' : config.dial.finish,
      color: color as HexColor,
    },
    details: {
      ...config.details,
      dial: settings?.surface ?? (explicitFinish || legacyAzure ? undefined : config.details?.dial),
    },
  };
  return {
    config: materialConfig,
    color: effectiveDialColor(materialConfig.dial),
    customFinish,
    customColor,
  };
}

/** The reserve has a separate surface and keeps the main dial as its historical fallback. */
export function reserveAppearance(config: WatchConfig) {
  return subdialAppearance(
    { ...config, details: { ...config.details, subdials: config.details?.reserve } },
    effectiveDialColor(config.dial),
    false,
  );
}

/** Print colours follow the actual mini-dial surface until explicitly customised. */
export function subdialInk(config: WatchConfig, reserve = false) {
  const settings = reserve ? config.details?.reserve : config.details?.subdials;
  return settings?.ink && settings.ink !== 'auto'
    ? settings.ink
    : printInk((reserve ? reserveAppearance(config) : subdialAppearance(config)).color);
}

/** The ring is its own surface: ton sur ton by default, the dial finish unless chosen. */
export function ringAppearance(config: WatchConfig) {
  const ring = config.details?.ring ?? undefined;
  return subdialAppearance(
    {
      ...config,
      details: {
        ...config.details,
        subdials: ring && {
          finish: ring.finish,
          color: ring.color,
          surface: ring.surface,
        },
      },
    },
    ringToneColor(config),
    false,
  );
}

/** Print on the ring follows its surface until explicitly customised. */
export function ringInk(config: WatchConfig) {
  const ink = config.details?.ring?.ink;
  return ink && ink !== 'auto' ? ink : printInk(ringAppearance(config).color);
}

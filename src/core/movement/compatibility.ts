/**
 * Compatibilité d'une configuration avec les mouvements connus (spec §7.3).
 *
 * Règles volontairement simples et explicables : elles signalent ce qu'il faudrait
 * adapter pour monter le calibre dans ce boîtier, sans prétendre à un plan d'usinage.
 */
import { dateComplication } from '../config/date';
import { chronograph } from '../config/chronograph';
import { powerReserve } from '../config/power-reserve';
import { smallSeconds } from '../config/small-seconds';
import type { WatchConfig } from '../config/types';
import { contourExtents } from '../geometry/dial-shape';
import { watchDimensions } from '../geometry/dimensions';
import { formatNumber, hourLabel, type Locale } from '../i18n/locale';
import { MESSAGES } from '../i18n/messages';
import { MOVEMENTS, type MovementSpec } from './movements';

/** Cadran standard des NH3x, et le grand format accepté par certains boîtiers (§7.3). */
export const STANDARD_DIAL_MM = 28.5;
export const LARGE_DIAL_MM = 30.8;
/** Paroi minimale du boîtier de chaque côté du cadran. */
const WALL_MM = 2.5;
/** Cadran, aiguilles, cristal et fond au-dessus et au-dessous du calibre. */
const STACK_MM = 4.5;

export type Fit = 'ok' | 'adapt' | 'check' | 'no';

export interface MovementFit {
  movement: MovementSpec;
  fit: Fit;
  /** Raisons, de la plus bloquante à la plus anodine. */
  notes: string[];
}

const ORDER: Record<Fit, number> = { ok: 0, adapt: 1, check: 2, no: 3 };

export const mm = (value: number, digits = 1, locale: Locale = 'fr') =>
  `${formatNumber(value, locale, digits)} mm`;

/** Largeur du cadran visible sous le réhaut, au plus large : le disque doit la couvrir. */
export function visibleDialMm(config: WatchConfig): number {
  const d = watchDimensions(config);
  const round = d.dialShape === 'round';
  return 2 * d.dialRadius * (round ? 1 : d.dialScale * contourExtents(d.dialShape).max);
}

function hasDateWindow(config: WatchConfig): boolean {
  return config.complications.some((c) => c.type === 'date' || c.type === 'day-date');
}

export function movementFit(
  config: WatchConfig,
  movement: MovementSpec,
  locale: Locale = 'fr',
): MovementFit {
  const m = MESSAGES[locale].movement;
  const len = (value: number) => mm(value, 1, locale);
  if (movement.kind === 'quartz' && powerReserve(config))
    return { movement, fit: 'no', notes: [m.quartzReserve] };
  if (movement.kind === 'quartz' && chronograph(config))
    return { movement, fit: 'check', notes: [m.quartzChrono] };
  if (movement.kind === 'quartz' || movement.heightMm === undefined)
    return { movement, fit: 'check', notes: [m.quartzCheck] };

  const blocking: string[] = [];
  const adapt: string[] = [];
  const width = config.case.diameterMm * contourExtents(config.case.shape).min;
  if (width - 2 * WALL_MM < STANDARD_DIAL_MM)
    blocking.push(m.tooNarrow(len(STANDARD_DIAL_MM), len(STANDARD_DIAL_MM + 2 * WALL_MM)));
  const thickness = Math.ceil((movement.heightMm + STACK_MM) * 2) / 2;
  if (config.case.thicknessMm < thickness)
    blocking.push(m.tooThin(len(config.case.thicknessMm), len(thickness)));

  const visible = visibleDialMm(config);
  if (visible > LARGE_DIAL_MM) adapt.push(m.customDial(len(visible)));
  else if (visible > STANDARD_DIAL_MM) adapt.push(m.largeDial(len(visible), len(LARGE_DIAL_MM)));

  if (config.crown.position !== movement.stem)
    adapt.push(m.crown(hourLabel(config.crown.position, locale)));

  // Les NH3x portent leur trotteuse au centre ; une petite seconde demande un autre calibre.
  if (smallSeconds(config)) blocking.push(m.smallSeconds(movement.name));
  if (chronograph(config)) blocking.push(m.chronograph(movement.name));
  if (powerReserve(config)) blocking.push(m.powerReserve(movement.name));
  const window = hasDateWindow(config);
  if (window && movement.calendar === 'none') blocking.push(m.noDateWindow);
  const datePosition = dateComplication(config)?.position;
  if (datePosition && movement.calendar !== 'none' && datePosition !== movement.stem)
    adapt.push(m.datePosition(hourLabel(datePosition, locale), movement.name));
  if (!window && movement.calendar !== 'none')
    adapt.push(movement.calendar === 'day-date' ? m.dayDateHidden : m.dateHidden);

  const fit: Fit = blocking.length ? 'no' : adapt.length ? 'adapt' : 'ok';
  return { movement, fit, notes: [...blocking, ...adapt] };
}

/** Tous les mouvements connus, du mieux adapté au moins adapté. */
export function compatibleMovements(config: WatchConfig, locale: Locale = 'fr'): MovementFit[] {
  return Object.values(MOVEMENTS)
    .map((movement) => movementFit(config, movement, locale))
    .sort((a, b) => ORDER[a.fit] - ORDER[b.fit]);
}

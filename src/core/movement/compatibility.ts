/**
 * Compatibilité d'une configuration avec les mouvements connus (spec §7.3).
 *
 * Règles volontairement simples et explicables : elles signalent ce qu'il faudrait
 * adapter pour monter le calibre dans ce boîtier, sans prétendre à un plan d'usinage.
 */
import { dateComplication } from '../config/date';
import { smallSeconds } from '../config/small-seconds';
import type { WatchConfig } from '../config/types';
import { contourExtents } from '../geometry/dial-shape';
import { watchDimensions } from '../geometry/dimensions';
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

export const mm = (value: number, digits = 1) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })} mm`;

/** Largeur du cadran visible sous le réhaut, au plus large : le disque doit la couvrir. */
export function visibleDialMm(config: WatchConfig): number {
  const d = watchDimensions(config);
  const round = d.dialShape === 'round';
  return 2 * d.dialRadius * (round ? 1 : d.dialScale * contourExtents(d.dialShape).max);
}

function hasDateWindow(config: WatchConfig): boolean {
  return config.complications.some((c) => c.type === 'date' || c.type === 'day-date');
}

export function movementFit(config: WatchConfig, movement: MovementSpec): MovementFit {
  if (movement.kind === 'quartz' || movement.heightMm === undefined)
    return { movement, fit: 'check', notes: ['Cotes et fonctions selon le calibre choisi.'] };

  const blocking: string[] = [];
  const adapt: string[] = [];
  const width = config.case.diameterMm * contourExtents(config.case.shape).min;
  if (width - 2 * WALL_MM < STANDARD_DIAL_MM)
    blocking.push(
      `Boîtier trop étroit : le cadran de ${mm(STANDARD_DIAL_MM)} demande ${mm(
        STANDARD_DIAL_MM + 2 * WALL_MM,
      )} de large.`,
    );
  const thickness = Math.ceil((movement.heightMm + STACK_MM) * 2) / 2;
  if (config.case.thicknessMm < thickness)
    blocking.push(
      `Boîtier trop fin : ${mm(config.case.thicknessMm)}, il en faut au moins ${mm(thickness)}.`,
    );

  const visible = visibleDialMm(config);
  if (visible > LARGE_DIAL_MM)
    adapt.push(`Ouverture de ${mm(visible)} : cadran sur mesure et cercle d’emboîtage.`);
  else if (visible > STANDARD_DIAL_MM)
    adapt.push(`Ouverture de ${mm(visible)} : cadran grand format de ${mm(LARGE_DIAL_MM)}.`);

  if (config.crown.position !== movement.stem)
    adapt.push(
      `Couronne à ${config.crown.position.replace('h', ' h')} : mouvement pivoté, cadran percé en conséquence.`,
    );

  // Les NH3x portent leur trotteuse au centre ; une petite seconde demande un autre calibre.
  if (smallSeconds(config))
    blocking.push(
      `Trotteuse au centre sur le ${movement.name} : la petite seconde demande un calibre qui la porte.`,
    );
  const window = hasDateWindow(config);
  if (window && movement.calendar === 'none')
    blocking.push('Pas de date pour le guichet du cadran.');
  const datePosition = dateComplication(config)?.position;
  if (datePosition && movement.calendar !== 'none' && datePosition !== movement.stem)
    adapt.push(
      `Date à ${datePosition.replace('h30', ' h 30').replace(/h$/, ' h')} : le ${movement.name} l’affiche face à la tige de remontoir, calibre ou module à adapter.`,
    );
  if (!window && movement.calendar !== 'none')
    adapt.push(
      movement.calendar === 'day-date'
        ? 'Jour et date masqués : le cadran n’a pas de guichet.'
        : 'Date masquée : le cadran n’a pas de guichet.',
    );

  const fit: Fit = blocking.length ? 'no' : adapt.length ? 'adapt' : 'ok';
  return { movement, fit, notes: [...blocking, ...adapt] };
}

/** Tous les mouvements connus, du mieux adapté au moins adapté. */
export function compatibleMovements(config: WatchConfig): MovementFit[] {
  return Object.values(MOVEMENTS)
    .map((movement) => movementFit(config, movement))
    .sort((a, b) => ORDER[a.fit] - ORDER[b.fit]);
}

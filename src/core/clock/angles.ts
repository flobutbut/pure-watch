/**
 * Angles des aiguilles (spec §8.2, §9.5), en degrés, sens horaire depuis 12 h.
 */

export interface TimeOfDay {
  h: number;
  m: number;
  /** Secondes, avec fraction. */
  s: number;
}

export interface HandAngles {
  hour: number;
  minute: number;
  second: number;
}

/** Pas par seconde à partir de la fréquence en alternances par heure (spec §7.2). */
export function stepsPerSecond(frequencyVph: number): number {
  return frequencyVph / 3600;
}

/**
 * @param stepsPerSecond 0 = balayage continu ; 1 = quartz ; 6 = 21 600 vib/h (NH35) ; 8 = 28 800 vib/h.
 */
export function handAngles(time: TimeOfDay, stepsPerSecond: number): HandAngles {
  const sec = stepsPerSecond > 0 ? Math.floor(time.s * stepsPerSecond) / stepsPerSecond : time.s;
  // Minutes fractionnaires : l'aiguille des minutes avance avec les secondes,
  // celle des heures avec les minutes (elle ne saute jamais d'une heure à l'autre).
  const minutes = time.m + sec / 60;
  return {
    hour: 30 * (time.h % 12) + 0.5 * minutes,
    minute: 6 * minutes,
    second: 6 * sec,
  };
}

export function timeOfDay(date: Date): TimeOfDay {
  return {
    h: date.getHours(),
    m: date.getMinutes(),
    s: date.getSeconds() + date.getMilliseconds() / 1000,
  };
}

/** Heure figée des captures : 10 h 10 (spec §3.4). */
export const POSTER_TIME: Readonly<TimeOfDay> = Object.freeze({ h: 10, m: 10, s: 35 });

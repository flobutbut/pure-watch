/**
 * Traduction des gestes en pas de grille (spec §2.7). Logique pure, testable sans DOM.
 */

export type Axis = 'x' | 'y';

export interface WheelStep {
  axis: Axis;
  /** +1 ou −1. */
  delta: number;
}

/**
 * Molette et pavé tactile :
 * - verrouillage d'axe : le premier mouvement significatif (> 8 px) fixe l'axe de la séquence ;
 * - accumulation : un pas toutes les 40 px ;
 * - pendant l'animation d'un pas (180 ms), on accumule sans émettre (rafales d'inertie),
 *   en gardant le surplus, plafonné pour qu'un lancer ne fasse pas défiler sans fin.
 */
export class WheelStepper {
  private axis: Axis | null = null;
  private sum = { x: 0, y: 0 };
  private acc = 0;
  private lastEvent = -Infinity;
  private busyUntil = -Infinity;

  constructor(
    private readonly threshold = 40,
    private readonly lockPx = 8,
    private readonly stepMs = 180,
    /** Silence au-delà duquel une nouvelle séquence commence. */
    private readonly gapMs = 220,
  ) {}

  push(dx: number, dy: number, now: number): WheelStep | null {
    if (now - this.lastEvent > this.gapMs) this.reset();
    this.lastEvent = now;

    if (!this.axis) {
      this.sum.x += dx;
      this.sum.y += dy;
      if (Math.max(Math.abs(this.sum.x), Math.abs(this.sum.y)) <= this.lockPx) return null;
      this.axis = Math.abs(this.sum.x) > Math.abs(this.sum.y) ? 'x' : 'y';
      this.acc = this.sum[this.axis];
    } else {
      this.acc += this.axis === 'x' ? dx : dy;
    }

    const cap = this.threshold * 2;
    this.acc = Math.max(-cap, Math.min(cap, this.acc));
    if (now < this.busyUntil || Math.abs(this.acc) < this.threshold) return null;

    const delta = Math.sign(this.acc);
    this.acc -= delta * this.threshold;
    this.busyUntil = now + this.stepMs;
    return { axis: this.axis, delta };
  }

  reset(): void {
    this.axis = null;
    this.sum = { x: 0, y: 0 };
    this.acc = 0;
    this.busyUntil = -Infinity;
  }
}

/** Normalise un WheelEvent en pixels ; Maj + molette = défilement horizontal. */
export function wheelPixels(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>,
) {
  const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;
  return event.shiftKey && dx === 0 ? { dx: dy, dy: 0 } : { dx, dy };
}

/**
 * Fin d'un glisser (souris ou doigt) : nombre de cellules à parcourir.
 * Le geste compte dès 30 % d'une cellule ou 0,3 px/ms ; l'inertie ajoute des pas selon la
 * vitesse, au plus 3 cellules par geste. Glisser vers la gauche avance (variante suivante).
 */
export function dragSteps(offsetPx: number, velocityPxPerMs: number, pitch: number): number {
  const fromDistance = Math.round(offsetPx / pitch);
  let steps = fromDistance;
  if (steps === 0 && (Math.abs(offsetPx) > pitch * 0.3 || Math.abs(velocityPxPerMs) > 0.3)) {
    steps = Math.sign(offsetPx || velocityPxPerMs);
  }
  const inertia = Math.trunc((velocityPxPerMs * 120) / pitch);
  if (Math.sign(inertia) === Math.sign(steps) || steps === 0) steps += inertia;
  return -Math.max(-3, Math.min(3, steps));
}

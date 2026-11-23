/**
 * Pilote de la vue de chargement (#boot, dans index.html).
 *
 * Le chargement est découpé en étapes réelles ; chacune fait avancer la progression, et
 * les douze index du cadran s'allument à mesure. La vue s'efface quand la montre centrale
 * est assemblée et que les pièces autour d'elle sont prêtes, ou au plus tard après un
 * délai de secours (WebGL absent, réseau très lent) : on n'enferme jamais l'utilisateur.
 */

type Stage = 'script' | 'app' | 'engine' | 'watch';

/**
 * Part de la progression atteinte quand l'étape est franchie, et libellé de ce qui
 * commence alors. Les pièces autour de la montre font le reste, jusqu'à 1.
 */
const STAGES: Record<Stage, { at: number; label: string }> = {
  script: { at: 0.12, label: "Préparation de l'atelier" },
  app: { at: 0.24, label: 'Usinage des pièces' },
  engine: { at: 0.5, label: 'Assemblage de la montre' },
  watch: { at: 0.72, label: 'Mise en lumière' },
};

/** Durée minimale d'affichage : le cadran a le temps de se dessiner. */
const MIN_VISIBLE_MS = 1200;
/** Délai de secours au-delà duquel on révèle la grille quoi qu'il arrive. */
const FALLBACK_MS = 9000;

const started = performance.now();
const reached = new Set<Stage>();
let progress = 0;
let expected = 0;
let ready = 0;
let finished = false;

const el = () => document.getElementById('boot');

function render(): void {
  const root = el();
  if (!root) return;
  const ticks = root.querySelectorAll('.tick');
  const lit = Math.round(progress * ticks.length);
  ticks.forEach((tick, i) => tick.classList.toggle('on', i < lit));
  root.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}

function advance(value: number, label?: string): void {
  if (finished) return;
  progress = Math.max(progress, Math.min(1, value));
  const node = el()?.querySelector('.label');
  if (label && node && node.textContent !== label) node.textContent = label;
  render();
  maybeFinish();
}

function cellsShare(): number {
  return expected === 0 ? 0 : Math.min(1, ready / expected);
}

function maybeFinish(): void {
  if (finished || !reached.has('watch')) return;
  if (expected > 0 && ready < expected) return;
  finish();
}

/** Étape franchie. */
export function bootStage(stage: Stage): void {
  reached.add(stage);
  const { at, label } = STAGES[stage];
  advance(stage === 'watch' ? at + (1 - at) * cellsShare() : at, label);
}

/** Une pièce proche du centre est attendue avant de révéler la grille. */
export function bootExpectCell(): void {
  if (!finished) expected++;
}

/** Une pièce attendue est prête. */
export function bootCellReady(): void {
  if (finished) return;
  ready++;
  const base = STAGES.watch.at;
  if (reached.has('watch')) advance(base + (1 - base) * cellsShare());
  else maybeFinish();
}

/** La vue de chargement prend la teinte du cadran choisi avant de s'effacer. */
export function bootTheme(background: string, ink: string): void {
  const root = el();
  if (!root) return;
  root.style.setProperty('--boot-bg', background);
  root.style.setProperty('--boot-ink', ink);
}

/** Révèle la grille : dernier index allumé, puis fondu (une seule fois). */
export function finish(): void {
  if (finished) return;
  finished = true;
  progress = 1;
  render();
  const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - started)) + 260;
  setTimeout(() => {
    const root = el();
    if (!root) return;
    root.classList.add('done');
    root.setAttribute('aria-hidden', 'true');
    root.addEventListener('transitionend', () => root.remove(), { once: true });
    setTimeout(() => root.remove(), 1200);
  }, wait);
}

/** Vrai tant que la vue de chargement est affichée. */
export function booting(): boolean {
  return !finished;
}

setTimeout(finish, FALLBACK_MS);

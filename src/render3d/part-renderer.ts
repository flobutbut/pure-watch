/**
 * Implémentation 3D du contrat PartRenderer (plan d'action §1.1) : instantanés de pièces
 * pour les cellules, montre complète en direct pour le centre.
 */
import type { Catalog, RowDef } from '../core/catalog/types';
import type { WatchConfig } from '../core/config/types';
import { getAtPath } from '../core/config/path';
import { watchDimensions } from '../core/geometry/dimensions';
import { crownMount } from '../core/geometry/crown-mount';
import { applyVariant } from '../core/nav/selection';
import type { LiveWatch, PartImage, PartRenderer, PartRequest } from '../render/types';
import { Stage, type SnapshotJob } from './stage';
import { LAYERS, type Layer } from './watch';
import { dateWindowRect } from './parts/date';
import { subdialCircle } from '../core/config/small-seconds';
import { reserveGauge } from '../core/config/power-reserve';

/** Parties de la configuration dont dépend chaque calque (pour la clé de cache). */
const LAYER_DEPENDENCIES: Record<
  Layer,
  readonly (keyof WatchConfig | 'dial.shape' | 'bezel.type' | 'rehaut.profile' | 'dial.size')[]
> = {
  case: ['case', 'crystal', 'dial.shape', 'bezel', 'dial.size'],
  rehaut: ['case', 'crystal', 'dial', 'dial.shape', 'rehaut'],
  lugs: ['case', 'crystal'],
  crown: ['crown', 'case', 'crystal'],
  dial: ['dial', 'case', 'dial.shape', 'rehaut.profile', 'complications'],
  print: ['dial', 'case', 'dial.shape', 'rehaut.profile', 'complications'],
  indices: ['dial', 'case', 'dial.shape', 'rehaut.profile', 'complications'],
  hands: ['hands', 'case', 'dial.shape', 'rehaut.profile', 'dial.size', 'complications'],
  seconds: ['hands', 'case', 'dial.shape', 'rehaut.profile', 'dial.size', 'complications'],
  crystal: ['crystal', 'case', 'dial.shape', 'dial.size', 'complications'],
};

/** Ne garde que ce qui influence l'aperçu : changer d'aiguilles ne régénère pas les cadrans. */
function relevantConfig(
  config: WatchConfig,
  layers: readonly Layer[] | null,
): Record<string, unknown> {
  const keys = new Set<
    keyof WatchConfig | 'dial.shape' | 'bezel.type' | 'rehaut.profile' | 'dial.size'
  >();
  for (const layer of layers ?? LAYERS) for (const key of LAYER_DEPENDENCIES[layer]) keys.add(key);
  const out: Record<string, unknown> = {};
  for (const key of [...keys].sort())
    out[key] =
      key === 'dial.shape' && config.bezel.type === 'rotating' ? 'round' : getAtPath(config, key);
  return out;
}

const DARK = '#1B1F27';

interface PreviewSpec {
  layers: readonly Layer[] | null;
  /** Ajuste la configuration du contexte (cadran neutre derrière le cristal…). */
  context?: (config: WatchConfig) => WatchConfig;
  frame: (config: WatchConfig) => SnapshotJob['frame'];
  backdrop?: (config: WatchConfig) => SnapshotJob['backdrop'];
}

/** Cadran neutre sombre, pour que le boîtier seul ne montre pas un trou (contexte). */
const neutralDial = (config: WatchConfig): WatchConfig => ({
  ...config,
  dial: { ...config.dial, finish: 'matte', color: DARK, chapterRing: 'none' },
});

const headFrame = (config: WatchConfig) => {
  const d = watchDimensions(config);
  return { x: 0, y: 0, half: Math.max(d.lugToLug / 2, d.caseRadius + d.crown.length) * 1.08 };
};

const quarterFrame = (config: WatchConfig) => {
  const d = watchDimensions(config);
  return { x: d.caseRadius * 0.55, y: d.caseRadius * 0.55, half: d.caseRadius * 0.62 };
};

const dialFrame = (config: WatchConfig) => ({
  x: 0,
  y: 0,
  half: watchDimensions(config).dialExtent * 1.1,
});

const handsFrame = (config: WatchConfig) => ({
  x: 0,
  y: 0,
  half: watchDimensions(config).dialExtent * 1.14,
});

/** Gros plan sur le guichet de date (cadran entier s'il n'y en a pas). */
const dateFrame = (config: WatchConfig) => {
  const d = watchDimensions(config);
  const rect = dateWindowRect(config, d);
  if (!rect) return dialFrame(config);
  return { x: rect.x, y: rect.y, half: Math.max(rect.width, rect.height) * 1.6 };
};

/** Gros plan sur le sous-cadran de la petite seconde, s'il y en a un. */
const subdialFrame = (config: WatchConfig) => {
  const c = subdialCircle(config, watchDimensions(config).dialSafeRadius);
  return c ? { x: c.x, y: c.y, half: c.r * 1.25 } : null;
};

/** Gros plan sur l'éventail de la réserve de marche, s'il y en a un. */
const reserveFrame = (config: WatchConfig) => {
  const g = reserveGauge(config, watchDimensions(config).dialSafeRadius);
  return g ? { x: g.x, y: g.y + g.r * 0.45, half: g.r * 1.05 } : null;
};

/** Quelles pièces montrer, et comment cadrer, pour chaque ligne (règles R1 à R4). */
const PREVIEWS: Record<string, PreviewSpec> = {
  'case-shape': {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: headFrame,
  },
  'case-profile': {
    layers: ['case', 'lugs'],
    frame: (config) => {
      const d = watchDimensions(config);
      return { x: 0, y: d.z.back + d.caseThickness * 0.4, half: d.caseRadius * 0.95, view: 'side' };
    },
  },
  // Matière et finition : gros plan sur le quart haut-droit (lunette, corne, flanc).
  'case-material': {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: quarterFrame,
  },
  'case-finish': {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: quarterFrame,
  },
  // R4 : échelle commune à toute la ligne, pour comparer les tailles.
  'case-size': { layers: null, frame: () => ({ x: 0, y: 0, half: 29 }) },
  // La courbure des cornes ne se lit que de profil.
  lugs: {
    layers: ['case', 'lugs'],
    frame: (config) => {
      const d = watchDimensions(config);
      // Gros plan sur la corne de 12 h, vue de profil (x de la vue = −y de la montre).
      const center = (d.caseRadius + d.lugToLug / 2) / 2;
      const half = Math.max((d.lugToLug / 2 - d.caseRadius) * 1.5, d.caseThickness * 0.75);
      return { x: -center, y: d.z.back + d.caseThickness * 0.4, half, view: 'side' };
    },
  },
  // Gros plan sur la couronne, où qu'elle soit placée.
  crown: {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: (config) => {
      const d = watchDimensions(config);
      const mount = crownMount(d, config.case.shape, config.crown.position);
      return { x: mount.contact.x, y: mount.contact.y, half: d.caseRadius * 0.45 };
    },
  },
  // La position se lit sur la tête de montre entière.
  'crown-position': {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: headFrame,
  },
  bezel: {
    layers: ['case', 'rehaut', 'dial'],
    context: neutralDial,
    frame: headFrame,
  },
  'bezel-scale': {
    layers: ['case', 'rehaut', 'dial'],
    context: neutralDial,
    frame: headFrame,
  },
  // Cristal : le galbe ne se lit que de profil.
  crystal: {
    layers: ['case', 'crystal', 'rehaut', 'dial'],
    frame: (config) => {
      const d = watchDimensions(config);
      return { x: 0, y: d.z.bezelTop, half: d.caseRadius * 0.62, view: 'side' };
    },
  },
  // Cadran : finition et couleur se lisent sur le disque seul (R1).
  rehaut: { layers: ['case', 'rehaut', 'dial'], frame: quarterFrame },
  'rehaut-scale': {
    layers: ['rehaut', 'dial'],
    frame: (config) => {
      const d = watchDimensions(config);
      return { x: 0, y: 0, half: ((d.dialExtent * d.openingRadius) / d.dialRadius) * 1.05 };
    },
  },
  'dial-shape': { layers: ['case', 'rehaut', 'dial', 'print', 'indices'], frame: headFrame },
  'dial-size': { layers: ['case', 'rehaut', 'dial', 'print', 'indices'], frame: headFrame },
  'dial-finish': { layers: ['dial'], frame: dialFrame },
  'dial-color': { layers: ['dial'], frame: dialFrame },
  // Impression et index : montrés sur le cadran choisi, tels qu'ils seront (R6).
  'chapter-ring': { layers: ['dial', 'print'], frame: dialFrame },
  indices: { layers: ['dial', 'indices'], frame: dialFrame },
  numerals: { layers: ['dial', 'print', 'indices'], frame: dialFrame },
  'numeral-font': { layers: ['dial', 'print', 'indices'], frame: dialFrame },
  // Aiguilles : pas de disque de contexte, le fond de l'interface prend la couleur du cadran.
  hands: { layers: ['hands', 'seconds'], frame: handsFrame },
  // Avec une petite seconde, la trotteuse se montre dans son sous-cadran.
  seconds: { layers: ['seconds'], frame: (c) => subdialFrame(c) ?? handsFrame(c) },
  'seconds-color': { layers: ['seconds'], frame: (c) => subdialFrame(c) ?? handsFrame(c) },
  // Date : la position se lit sur le cadran entier, le guichet et le disque en gros plan.
  date: { layers: ['dial', 'print', 'indices'], frame: dialFrame },
  'date-window': { layers: ['dial', 'print', 'indices'], frame: dateFrame },
  'date-disc': { layers: ['dial', 'print', 'indices'], frame: dateFrame },
  'date-loupe': { layers: ['dial', 'print', 'indices', 'crystal'], frame: dateFrame },
  // Petite seconde : position sur le cadran entier, style en gros plan sur le sous-cadran.
  'small-seconds': { layers: ['dial', 'print', 'indices', 'seconds'], frame: dialFrame },
  // Réserve de marche : position sur le cadran entier, échelle en gros plan.
  'power-reserve': { layers: ['dial', 'print', 'indices', 'hands'], frame: dialFrame },
  'power-reserve-style': {
    layers: ['dial', 'print', 'indices', 'hands'],
    frame: (c) => reserveFrame(c) ?? dialFrame(c),
  },
  'small-seconds-style': {
    layers: ['dial', 'print', 'indices', 'seconds'],
    frame: (c) => subdialFrame(c) ?? dialFrame(c),
  },
};

export class PartRenderer3D implements PartRenderer {
  readonly kind = '3d' as const;
  private stage: Stage | null = null;
  private readonly rows: Map<string, RowDef>;
  private readonly waiting: (() => void)[] = [];

  constructor(catalog: Catalog) {
    this.rows = new Map(catalog.rows.map((row) => [row.id, row]));
  }

  private resolve(request: PartRequest): { config: WatchConfig; spec: PreviewSpec } {
    const row = this.rows.get(request.rowId);
    if (!row) throw new Error(`Ligne inconnue : ${request.rowId}`);
    const index = row.variants.findIndex((v) => v.id === request.variantId);
    // Thumbnails show the zero position; dragging the live ring does not rebuild every tile.
    const applied = applyVariant(
      { ...request.config, bezel: { ...request.config.bezel, angleDeg: 0 } },
      row,
      Math.max(0, index),
    );
    const spec: PreviewSpec = PREVIEWS[row.id] ?? { layers: null, frame: headFrame };
    return { config: spec.context ? spec.context(applied) : applied, spec };
  }

  cacheKey(request: PartRequest): string {
    const { config, spec } = this.resolve(request);
    const relevant = JSON.stringify(relevantConfig(config, spec.layers));
    return `3d|${request.rowId}|${request.variantId}|${request.sizePx * request.pixelRatio}|${relevant}`;
  }

  async renderPart(request: PartRequest, signal?: AbortSignal): Promise<PartImage> {
    const stage = await this.ready();
    const { config, spec } = this.resolve(request);
    const bitmap = await stage.snapshot({
      config,
      layers: spec.layers,
      frame: spec.frame(config),
      backdrop: spec.backdrop?.(config) ?? null,
      sizePx: Math.round(request.sizePx * request.pixelRatio),
      priority: request.priority ?? 0,
      ...(signal ? { signal } : {}),
    });
    return { kind: 'bitmap', bitmap };
  }

  mountWatch(target: HTMLElement, config: WatchConfig): LiveWatch {
    this.stage?.dispose();
    const stage = new Stage(target);
    this.stage = stage;
    // Prête après le premier rendu de la montre assemblée.
    const ready = stage
      .setConfig(config)
      .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    for (const wake of this.waiting.splice(0)) wake();
    return {
      ready,
      update: (next, transient) => void stage.setConfig(next, transient),
      setMode: (mode) => stage.setMode(mode),
      view: (index) => stage.view(index),
      rotate: (dAz, dEl) => stage.rotate(dAz, dEl),
      togglePause: () => stage.togglePause(),
      setBezelControl: (enabled, onchange) => stage.setBezelControl(enabled, onchange),
      setDisplayScale: (scale) => stage.setDisplayScale(scale),
      destroy: () => {
        if (this.stage === stage) this.stage = null;
        stage.dispose();
      },
    };
  }

  private ready(): Promise<Stage> {
    if (this.stage) return Promise.resolve(this.stage);
    return new Promise((resolve) => this.waiting.push(() => resolve(this.stage!)));
  }

  dispose(): void {
    this.stage?.dispose();
    this.stage = null;
  }
}

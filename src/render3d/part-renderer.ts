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

/** Parties de la configuration dont dépend chaque calque (pour la clé de cache). */
const LAYER_DEPENDENCIES: Record<
  Layer,
  readonly (keyof WatchConfig | 'dial.shape' | 'bezel.type' | 'rehaut.profile')[]
> = {
  case: ['case', 'crystal', 'dial.shape', 'bezel.type'],
  rehaut: ['case', 'crystal', 'dial', 'rehaut'],
  lugs: ['case', 'crystal'],
  crown: ['crown', 'case', 'crystal'],
  dial: ['dial', 'case', 'rehaut.profile'],
  print: ['dial', 'case', 'rehaut.profile'],
  indices: ['dial', 'case', 'rehaut.profile'],
  hands: ['hands', 'case', 'dial.shape', 'rehaut.profile'],
  seconds: ['hands', 'case', 'dial.shape', 'rehaut.profile'],
  crystal: ['crystal', 'case', 'dial.shape'],
};

/** Ne garde que ce qui influence l'aperçu : changer d'aiguilles ne régénère pas les cadrans. */
function relevantConfig(
  config: WatchConfig,
  layers: readonly Layer[] | null,
): Record<string, unknown> {
  const keys = new Set<keyof WatchConfig | 'dial.shape' | 'bezel.type' | 'rehaut.profile'>();
  for (const layer of layers ?? LAYERS) for (const key of LAYER_DEPENDENCIES[layer]) keys.add(key);
  const out: Record<string, unknown> = {};
  for (const key of [...keys].sort()) out[key] = getAtPath(config, key);
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

/** Quelles pièces montrer, et comment cadrer, pour chaque ligne (règles R1 à R4). */
const PREVIEWS: Record<string, PreviewSpec> = {
  'case-shape': {
    layers: ['case', 'rehaut', 'lugs', 'crown', 'dial'],
    context: neutralDial,
    frame: headFrame,
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
  'dial-finish': { layers: ['dial'], frame: dialFrame },
  'dial-color': { layers: ['dial'], frame: dialFrame },
  // Impression et index : montrés sur le cadran choisi, tels qu'ils seront (R6).
  'chapter-ring': { layers: ['dial', 'print'], frame: dialFrame },
  indices: { layers: ['dial', 'indices'], frame: dialFrame },
  numerals: { layers: ['dial', 'print', 'indices'], frame: dialFrame },
  'numeral-font': { layers: ['dial', 'print', 'indices'], frame: dialFrame },
  // Aiguilles : pas de disque de contexte, le fond de l'interface prend la couleur du cadran.
  hands: { layers: ['hands', 'seconds'], frame: handsFrame },
  seconds: { layers: ['seconds'], frame: handsFrame },
  'seconds-color': { layers: ['seconds'], frame: handsFrame },
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
    const applied = applyVariant(request.config, row, Math.max(0, index));
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

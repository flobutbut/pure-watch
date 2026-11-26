/**
 * Moteur du banc de rendu studio : la même montre rendue en temps réel (rastérisation de
 * Three.js) et par lancer de rayons (three-gpu-pathtracer), avec la même caméra, le même
 * studio et la même table. Sans interface : StudioBench.svelte le pilote.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/worker';
import { handAngles, POSTER_TIME } from '../../core/clock/angles';
import type { WatchConfig } from '../../core/config/types';
import {
  studioEnvironment,
  studioScene,
  type Softbox,
  type StudioSky,
} from '../../render3d/environment';
import { MaterialLibrary } from '../../render3d/materials';
import type { Refinement } from '../../render3d/refinement';
import { softShadowTexture } from '../../render3d/textures';
import { buildWatch, type WatchModel } from '../../render3d/watch';
import { prepareForPathTracer, studioEquirect } from './tracer-fixes';

const DEG = Math.PI / 180;
/** Recul de la caméra (mm) : la montre respire dans une scène plein cadre. */
const DISTANCE = 136;
/** Champ vertical de la caméra du configurateur (degrés). */
const FOV = 28;

export const STUDIO_VIEWS = {
  front: [0, 0],
  quarter: [28, 22],
  grazing: [-62, 14],
} as const;
export type StudioView = keyof typeof STUDIO_VIEWS;
export type Lighting = 'photo' | 'configurator';

/** Lumière principale du configurateur : une lumière directionnelle venue d'en haut à gauche. */
const KEY_POSITION = new THREE.Vector3(-30, 50, 60);
const KEY_IRRADIANCE = 1.1;
/**
 * Pour le lancer de rayons, la même lumière devient une boîte à lumière carrée : même
 * éclairement au centre de la montre (E ≈ L·A/D²), mais une ombre douce au lieu d'un bord net.
 */
const KEY_SIDE = 34;
const KEY_LUMINANCE = (KEY_IRRADIANCE * KEY_POSITION.lengthSq()) / (KEY_SIDE * KEY_SIDE);

/**
 * Éclairage « photo produit » : le studio du configurateur est réglé pour la rastérisation,
 * dont les reflets préfiltrés éclaircissent l'acier. Le lancer de rayons reflète le studio tel
 * quel : un acier poli n'y est clair que s'il voit de grandes surfaces lumineuses. Comme en
 * photographie de montre, des diffuseurs entourent l'objectif (haut, côtés, bas) et laissent
 * sombre l'axe de l'objectif, pour que le verre ne se voile pas de blanc.
 */
const PHOTO_SOFTBOXES: readonly Softbox[] = [
  { size: [56, 20], position: [0, 30, 36], intensity: 3.2 },
  { size: [18, 56], position: [-36, 6, 30], intensity: 4 },
  { size: [12, 50], position: [36, -2, 30], intensity: 2.6 },
  { size: [50, 14], position: [0, -30, 34], intensity: 1.4 },
  { size: [60, 14], position: [0, 46, 6], intensity: 3 },
  { size: [8, 44], position: [34, 6, -30], intensity: 2 },
  { size: [8, 44], position: [-34, 6, -30], intensity: 1.6 },
  { size: [60, 60], position: [0, -40, 0], intensity: 1, color: '#c4cad3' },
];
const PHOTO_SKY: StudioSky = { top: '#9ea4ad', bottom: '#3b3e44' };

const lightingScene = (lighting: Lighting) =>
  lighting === 'photo' ? studioScene(PHOTO_SOFTBOXES, PHOTO_SKY) : studioScene();

export interface StudioStatus {
  /** building : montres ; preparing : structure du lancer de rayons ; puis le calcul. */
  phase: 'building' | 'preparing' | 'rendering' | 'paused' | 'done' | 'exporting';
  /** Le viseur (la miniature) a bougé : son point de vue n'est pas encore rendu. */
  pending: boolean;
  samples: number;
  target: number;
  elapsedMs: number;
  /** Avancement de la phase en cours, de 0 à 1. */
  progress: number;
  /** Largeur et hauteur de l'image en cours d'export (px). */
  exportSize?: readonly [number, number];
}

export interface StudioOptions {
  raster: HTMLCanvasElement;
  traced: HTMLCanvasElement;
  config: WatchConfig;
  refinement: Refinement;
  backdrop: string;
  lighting: Lighting;
  /** Échantillons par pixel visés à l'écran et à l'export. */
  target: number;
  /** Côté des textures regroupées par le lanceur de rayons (impression du cadran comprise). */
  textureSize?: number;
  /** Multiplie la lumière principale du lancer de rayons (essais). */
  keyScale?: number;
  onstatus: (status: StudioStatus) => void;
  onraster: (ms: number) => void;
  /** Vue prédéfinie en cours, ou null quand la caméra a été tournée à la main. */
  onview: (view: StudioView | null) => void;
}

interface Pane {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  table: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  libraries: MaterialLibrary[];
  model: WatchModel | null;
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export class StudioBench {
  private readonly raster: Pane;
  private readonly traced: Pane;
  private readonly tracer: WebGLPathTracer;
  private readonly worker = new GenerateMeshBVHWorker();
  private readonly observers: ResizeObserver[] = [];
  private target: number;
  private ready = false;
  private exporting = false;
  private rasterDirty = true;
  private pending = false;
  private paused = false;
  private pausedAt = 0;
  private started = performance.now();
  private finishedAt = 0;
  private frameHandle = 0;
  private disposed = false;

  constructor(private readonly options: StudioOptions) {
    this.target = options.target;
    this.raster = this.makePane(options.raster, false);
    this.traced = this.makePane(options.traced, true);

    this.tracer = new WebGLPathTracer(this.traced.renderer);
    this.tracer.bounces = 8;
    this.tracer.transmissiveBounces = 10;
    this.tracer.filterGlossyFactor = 0.4;
    this.tracer.minSamples = 3;
    this.tracer.renderDelay = 0;
    this.tracer.fadeDuration = 300;
    this.tracer.tiles.set(2, 2);
    const textureSize = options.textureSize ?? 2048;
    this.tracer.textureSize.set(textureSize, textureSize);
    // La structure d'accélération se construit dans un worker : la page reste fluide.
    this.tracer.setBVHWorker(this.worker);

    // Seule la miniature se tourne : c'est le viseur. Le rendu studio garde son point de vue
    // jusqu'à ce qu'on lui demande celui du viseur (renderViewfinder) : un calcul de plusieurs
    // dizaines de secondes ne repart pas à chaque geste.
    this.traced.controls.enabled = false;
    this.raster.controls.addEventListener('change', () => {
      this.rasterDirty = true;
      if (this.pending) return;
      this.pending = true;
      this.emit();
    });
    // Tournée à la main, la caméra quitte les vues prédéfinies.
    this.raster.controls.addEventListener('start', () => options.onview(null));
    for (const pane of this.panes) {
      const observer = new ResizeObserver(() => this.fit(pane));
      observer.observe(pane.renderer.domElement);
      this.observers.push(observer);
    }
  }

  private get panes(): readonly Pane[] {
    return [this.raster, this.traced];
  }

  /** Construit les deux montres, prépare le lancer de rayons, puis lance l'affinage. */
  async start(view: StudioView = 'quarter'): Promise<void> {
    this.setView(view);
    this.status('building', 0);
    await Promise.all([this.build(this.raster, false), this.build(this.traced, true)]);
    if (this.disposed) return;
    this.status('preparing', 0);
    await this.tracer.setSceneAsync(this.traced.scene, this.traced.camera, {
      onProgress: (progress) => this.status('preparing', progress),
    });
    if (this.disposed) return;
    this.ready = true;
    this.restart();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  setView(view: StudioView): void {
    const [az, el] = STUDIO_VIEWS[view].map((v) => v * DEG) as [number, number];
    for (const pane of this.panes) {
      pane.camera.position.set(
        DISTANCE * Math.sin(az) * Math.cos(el),
        DISTANCE * Math.sin(el),
        DISTANCE * Math.cos(az) * Math.cos(el),
      );
      pane.controls.target.set(0, 0, 0);
      pane.controls.update();
    }
    // Une vue prédéfinie vaut pour les deux : le rendu studio part aussitôt.
    this.pending = false;
    this.options.onview(view);
    this.restart();
  }

  /** Rend le point de vue du viseur : le rendu studio repart de zéro sous ce nouvel angle. */
  renderViewfinder(): void {
    if (this.exporting) return;
    this.traced.camera.position.copy(this.raster.camera.position);
    this.traced.camera.quaternion.copy(this.raster.camera.quaternion);
    this.traced.controls.target.copy(this.raster.controls.target);
    this.pending = false;
    this.restart();
  }

  /** Met l'affinage en pause : l'image reste à l'écran, le temps de calcul s'arrête. */
  pause(): void {
    if (!this.ready || this.paused || this.tracer.samples >= this.target) return;
    this.paused = true;
    this.pausedAt = performance.now();
    this.emit();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.started += performance.now() - this.pausedAt;
    this.emit();
  }

  setLighting(lighting: Lighting): void {
    const previous = [this.raster.scene.environment, this.traced.scene.environment];
    this.raster.scene.environment = studioEnvironment(
      this.raster.renderer,
      lightingScene(lighting),
    );
    this.traced.scene.environment = studioEquirect(this.traced.renderer, lightingScene(lighting));
    for (const texture of previous) texture?.dispose();
    if (this.ready) this.tracer.updateEnvironment();
    this.restart();
  }

  setBackdrop(color: string): void {
    for (const pane of this.panes) {
      pane.table.material.color.set(color);
      (pane.scene.background as THREE.Color).set(color);
    }
    if (this.ready) {
      this.tracer.updateMaterials();
      this.tracer.updateEnvironment();
    }
    this.restart();
  }

  /** Changer d'objectif ne repart pas de zéro : l'image continue de s'affiner, ou s'arrête. */
  setTarget(samples: number): void {
    this.target = samples;
    this.finishedAt = 0;
    this.emit();
  }

  /**
   * Export à une définition plus haute que l'écran, au cadrage affiché : le plus grand côté
   * de l'image vaut `size`, l'autre suit les proportions de la vue. Le canvas est agrandi (son
   * affichage CSS ne change pas), l'image s'affine jusqu'au nombre d'échantillons visé, puis
   * revient à l'écran.
   */
  async exportPng(size: number): Promise<Blob> {
    if (!this.ready || this.exporting) throw new Error('Le rendu n’est pas prêt');
    this.exporting = true;
    const renderer = this.traced.renderer;
    const ratio = renderer.getPixelRatio();
    const display = renderer.getSize(new THREE.Vector2());
    const aspect = this.traced.camera.aspect;
    const exportSize = [
      Math.round(aspect >= 1 ? size : size * aspect),
      Math.round(aspect >= 1 ? size / aspect : size),
    ] as const;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(exportSize[0], exportSize[1], false);
      // Plus de tuiles en grand : chaque appel reste court, la page répond.
      const tiles = Math.ceil(size / 1024) * 2;
      this.tracer.tiles.set(tiles, tiles);
      this.started = performance.now();
      this.tracer.reset();
      while (this.tracer.samples < this.target && !this.disposed) {
        await nextFrame();
        this.tracer.renderSample();
        this.status('exporting', this.tracer.samples / this.target, exportSize);
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        renderer.domElement.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Export impossible');
      return blob;
    } finally {
      renderer.setPixelRatio(ratio);
      renderer.setSize(display.x, display.y, false);
      this.tracer.tiles.set(2, 2);
      this.exporting = false;
      this.restart();
    }
  }

  /** Pour les essais depuis la console et les tests de bout en bout. */
  get samples(): number {
    return this.tracer.samples;
  }
  get isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    for (const observer of this.observers) observer.disconnect();
    this.worker.dispose();
    this.tracer.dispose();
    for (const pane of this.panes) {
      pane.controls.dispose();
      pane.model?.dispose();
      for (const library of pane.libraries) library.dispose();
      pane.renderer.dispose();
    }
  }

  private makePane(canvas: HTMLCanvasElement, traced: boolean): Pane {
    const { backdrop, lighting } = this.options;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backdrop);
    if (traced) {
      scene.environment = studioEquirect(renderer, lightingScene(lighting));
      const luminance = KEY_LUMINANCE * (this.options.keyScale ?? 1);
      const key = new THREE.RectAreaLight('#ffffff', luminance, KEY_SIDE, KEY_SIDE);
      key.position.copy(KEY_POSITION);
      key.lookAt(0, 0, 0);
      scene.add(key);
    } else {
      scene.environment = studioEnvironment(renderer, lightingScene(lighting));
      const key = new THREE.DirectionalLight('#ffffff', KEY_IRRADIANCE);
      key.position.copy(KEY_POSITION);
      scene.add(key);
    }
    // Table : la montre est posée cadran vers le haut, l’objectif au-dessus. Assez grande pour
    // qu’on n’en voie pas le bord, même en vue rasante.
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshPhysicalMaterial({ color: backdrop, roughness: 0.82, metalness: 0 }),
    );
    scene.add(table);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.minDistance = 60;
    controls.maxDistance = 260;
    // L'objectif reste du côté du cadran : la table ne passe jamais devant.
    controls.minAzimuthAngle = -78 * DEG;
    controls.maxAzimuthAngle = 78 * DEG;
    controls.minPolarAngle = 14 * DEG;
    controls.maxPolarAngle = 166 * DEG;
    return { renderer, scene, camera, controls, table, libraries: [], model: null };
  }

  private async build(pane: Pane, traced: boolean): Promise<void> {
    const { config, refinement } = this.options;
    const library = new MaterialLibrary(refinement === 'refined', config.view.night);
    pane.libraries.push(library);
    const model = buildWatch(config, library, { quality: 'transmission', refinement });
    await model.ready;
    model.setAngles(handAngles(POSTER_TIME, 0));
    pane.model = model;
    pane.scene.add(model.root);
    const bottom = new THREE.Box3().setFromObject(model.root).min.z - 0.05;
    pane.table.position.z = bottom;
    if (traced) prepareForPathTracer(model.root);
    else pane.scene.add(fakeShadow(model, bottom));
  }

  /**
   * Canvas à sa taille affichée, carrée ou non ; seul un vrai changement relance le calcul.
   * En largeur, le champ vertical reste celui du configurateur ; en hauteur (téléphone), il
   * s'ouvre pour que la largeur de la montre tienne toujours.
   */
  private fit(pane: Pane): void {
    if (this.exporting) return;
    const { clientWidth: width, clientHeight: height } = pane.renderer.domElement;
    const current = pane.renderer.getSize(new THREE.Vector2());
    if (width === 0 || height === 0 || (width === current.x && height === current.y)) return;
    pane.renderer.setSize(width, height, false);
    pane.camera.aspect = width / height;
    pane.camera.fov =
      pane.camera.aspect >= 1
        ? FOV
        : (2 * Math.atan(Math.tan((FOV * DEG) / 2) / pane.camera.aspect)) / DEG;
    pane.camera.updateProjectionMatrix();
    this.restart();
  }

  /** Le rendu studio repart de zéro (nouveau point de vue, éclairage, fond…), sans pause. */
  private restart(): void {
    this.rasterDirty = true;
    this.paused = false;
    this.started = performance.now();
    this.finishedAt = 0;
    if (this.ready) this.tracer.updateCamera();
    this.emit();
  }

  /** État du calcul une fois la scène prête. */
  private emit(): void {
    if (!this.ready) return;
    const phase = this.exporting
      ? 'exporting'
      : this.paused
        ? 'paused'
        : this.tracer.samples >= this.target
          ? 'done'
          : 'rendering';
    this.status(phase, this.tracer.samples / this.target);
  }

  private status(
    phase: StudioStatus['phase'],
    progress: number,
    exportSize?: StudioStatus['exportSize'],
  ): void {
    this.options.onstatus({
      phase,
      pending: this.pending,
      samples: Math.min(Math.floor(this.tracer.samples), this.target),
      target: this.target,
      elapsedMs:
        (this.finishedAt || (this.paused ? this.pausedAt : performance.now())) - this.started,
      progress: Math.min(1, progress),
      exportSize,
    });
  }

  private readonly frame = () => {
    this.frameHandle = requestAnimationFrame(this.frame);
    if (!this.ready || this.exporting) return;
    if (this.rasterDirty) {
      this.rasterDirty = false;
      const start = performance.now();
      this.raster.renderer.render(this.raster.scene, this.raster.camera);
      this.options.onraster(performance.now() - start);
    }
    if (this.paused) return;
    if (this.tracer.samples < this.target) {
      this.tracer.renderSample();
      this.emit();
    } else if (!this.finishedAt) {
      this.finishedAt = performance.now();
      this.emit();
    }
  };
}

/** Ombre floue du configurateur, posée sur la table de la vue en temps réel. */
function fakeShadow(model: WatchModel, z: number): THREE.Mesh {
  const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.25, size.y * 1.1),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      color: '#1b1f27',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  shadow.position.set(3, -4, z + 0.05);
  return shadow;
}

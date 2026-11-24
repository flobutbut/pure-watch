/**
 * Scène 3D : un seul contexte WebGL pour toute la page (plan d'action §1.2).
 * Il sert à la fois à la montre centrale en direct et à la fabrication des instantanés
 * de cellules, intercalés entre deux images.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { handAngles, POSTER_TIME, timeOfDay, type HandAngles } from '../core/clock/angles';
import { isBlackTonneau } from '../core/config/instrument';
import type { WatchConfig } from '../core/config/types';
import { bezelAngle, bezelScale } from '../core/config/bezel';
import { movementStepsPerSecond } from '../core/movement/movements';
import { MaterialLibrary, type CrystalQuality } from './materials';
import { studioEnvironment } from './environment';
import { refinementFromSearch } from './refinement';
import { softShadowTexture } from './textures';
import { buildWatch, type Layer, type WatchModel } from './watch';

export interface SnapshotJob {
  config: WatchConfig;
  layers: readonly Layer[] | null;
  /**
   * Cadrage : centre (mm) et demi-côté (mm) du carré visible. Vue de face par défaut ;
   * vue de profil (depuis 9 h, cadran vers le haut) pour les pièces qui se lisent de côté.
   * En vue de profil, x = position le long de l'axe 12 h–6 h, y = hauteur.
   */
  frame: { x: number; y: number; half: number; view?: 'front' | 'side' };
  /** Disque sombre de contexte derrière la pièce (aiguilles…). */
  backdrop: { radius: number; color: string } | null;
  sizePx: number;
  /** Plus petit = plus urgent (distance au centre de la grille). */
  priority?: number;
  signal?: AbortSignal;
}

/** Mode de la montre centrale : dans la grille (vue de face, immobile) ou inspectée (orbite). */
export type LiveMode = 'grid' | 'inspect';

interface CameraGoal {
  az: number;
  el: number;
}

/** Demi-champ fixe de la caméra en direct (mm) : toutes les tailles tiennent, à la même échelle. */
const FRAME_RADIUS_MM = 35;
const DEG = Math.PI / 180;
const VIEWS: Record<LiveMode, CameraGoal> = {
  grid: { az: 0, el: 0 },
  inspect: { az: 24 * DEG, el: 16 * DEG },
};

/**
 * Vues prédéfinies de la vue 3D (spec §3.3, touches 1 à 5) : face, profil gauche, dessus,
 * dos, trois quarts (« au poignet » attendra le modèle de poignet).
 */
export const PRESET_VIEWS: readonly CameraGoal[] = [
  { az: 0, el: 0 },
  { az: -90 * DEG, el: 0 },
  { az: 0, el: 75 * DEG },
  { az: 180 * DEG, el: 0 },
  VIEWS.inspect,
];

/** Élévation de −10° à 90° : on ne passe pas sous la table (spec §3.3). */
const MIN_EL = -10 * DEG;
const MAX_EL = 89 * DEG;

interface QueuedJob {
  job: SnapshotJob;
  /**
   * pending : en file, pas encore construit ; building : modèle construit, textures et
   * shaders en préparation ; prepared : prêt à dessiner ; done : rendu, annulé ou en échec.
   */
  state: 'pending' | 'building' | 'prepared' | 'done';
  model: WatchModel | null;
  resolve: (bitmap: ImageBitmap) => void;
  reject: (error: unknown) => void;
}

/**
 * Temps consacré aux instantanés à chaque image (ms) : au-delà, la suite attend l'image
 * suivante, et la montre en direct garde sa cadence.
 */
const SNAPSHOT_BUDGET_MS = 8;
/**
 * Modèles construits en même temps (en préparation ou prêts à dessiner). Les autres
 * attendent sous forme de simple demande : ni géométrie ni texture en mémoire.
 */
const MAX_IN_FLIGHT = 6;
/**
 * Délai avant de baisser la résolution quand la montre rapetisse : la transition CSS
 * (--dur-open, 450 ms) se joue encore sur l'image nette.
 */
const SHRINK_DELAY_MS = 500;
/** En deçà (radians), la « respiration » ne bouge plus rien à l'écran. */
const STILL = 1e-5;

const abortError = (message = 'Annulé') => new DOMException(message, 'AbortError');

/** File triée par priorité : les cellules proches du centre d'abord. */
function insertByPriority(list: QueuedJob[], entry: QueuedJob): void {
  const p = entry.job.priority ?? 0;
  const at = list.findIndex((other) => (other.job.priority ?? 0) > p);
  list.splice(at === -1 ? list.length : at, 0, entry);
}

function removeFrom(list: QueuedJob[], entry: QueuedJob): void {
  const i = list.indexOf(entry);
  if (i >= 0) list.splice(i, 1);
}

const sameAngles = (a: HandAngles | null, b: HandAngles) =>
  a !== null && a.hour === b.hour && a.minute === b.minute && a.second === b.second;

/** Contour approché d'une montre : bords avant et arrière du boîtier, bouts des cornes, couronne. */
function outlinePoints(model: WatchModel): THREE.Vector3[] {
  const d = model.dimensions;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (const z of [d.z.back, d.z.crystalTop]) {
      points.push(new THREE.Vector3(Math.cos(a) * d.caseRadius, Math.sin(a) * d.caseRadius, z));
    }
  }
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      points.push(new THREE.Vector3((x * d.lugWidth) / 2, (y * d.lugToLug) / 2, d.z.back));
    }
  }
  points.push(new THREE.Vector3(d.caseRadius + d.crown.length + 1, 0, d.z.back / 2));
  return points;
}
export function detectCrystalQuality(): CrystalQuality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  return navigator.hardwareConcurrency > 4 && !coarse ? 'transmission' : 'fallback';
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private readonly refinement = refinementFromSearch(location.search);
  readonly materials = new MaterialLibrary(this.refinement === 'refined');
  private readonly nightMaterials = new MaterialLibrary(this.refinement === 'refined', true);
  private readonly quality = detectCrystalQuality();
  private readonly scene = new THREE.Scene();
  private readonly snapScene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  private readonly snapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly environment: THREE.Texture;
  private readonly shadowTexture = softShadowTexture();
  private readonly shadow: THREE.Mesh;
  private readonly snapShadow: THREE.Mesh;
  private readonly backdrop: THREE.Mesh;
  private readonly floating = new THREE.Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private displayScale: number | null = null;
  /** Taille du conteneur en pixels physiques, avant la transformation CSS de la page. */
  private boxWidth = 0;
  private boxHeight = 0;
  private shrinkTimer: ReturnType<typeof setTimeout> | undefined;
  /** Demandes d'instantanés pas encore construites. */
  private readonly pending: QueuedJob[] = [];
  /** Instantanés construits, textures et shaders prêts : il ne reste qu'à les dessiner. */
  private readonly prepared: QueuedJob[] = [];
  /** Instantanés dont les textures et les shaders sont en préparation. */
  private readonly building = new Set<QueuedJob>();
  /**
   * Taille du canvas en pixels (rapport de pixels de three fixé à 1) : celle réellement
   * affichée, relevée par le ResizeObserver (pas de lecture de mise en page par image).
   */
  private width = 0;
  private height = 0;
  /** Vrai quand l'image en direct doit être redessinée à la prochaine image. */
  private dirty = true;
  private lastAngles: HandAngles | null = null;
  private live: WatchModel | null = null;
  /** Transient palettes must not accumulate every dragged colour in the shared cache. */
  private liveMaterials: MaterialLibrary | null = null;
  private liveVersion = 0;
  private liveSteps = 0;
  private pilotFixedTime = false;
  private liveShadow = { depth: 0, drop: 0 };
  /** Points du contour de la montre centrale, dans son propre repère (pour l'ombre). */
  private liveOutline: THREE.Vector3[] = [];
  /** Leur projection à l'écran (x, y entrelacés), réutilisée d'une image à l'autre. */
  private outlineScreen = new Float32Array(0);
  private readonly shadowCorner = new THREE.Vector3();
  private readonly shadowRight = new THREE.Vector3();
  private readonly shadowDir = new THREE.Vector3();
  private readonly shadowUp = new THREE.Vector3();
  private frameHandle = 0;
  private interacting = false;
  private readonly startTime = performance.now();
  private lastFrame = performance.now();
  private mode: LiveMode = 'grid';
  private cameraGoal: CameraGoal | null = null;
  private liveConfigKey = '';
  private liveConfig: WatchConfig | null = null;
  private bezelEditing = false;
  private onBezelChange: ((angle: number) => void) | null = null;
  private bezelDrag: { id: number; angle: number; remainder: number } | null = null;
  private readonly bezelRay = new THREE.Raycaster();

  setBezelControl(enabled: boolean, onchange: (angle: number) => void): void {
    this.bezelEditing = enabled;
    this.onBezelChange = onchange;
    if (!enabled && this.bezelDrag) {
      const id = this.bezelDrag.id;
      this.bezelDrag = null;
      if (this.renderer.domElement.hasPointerCapture(id))
        this.renderer.domElement.releasePointerCapture(id);
    }
    this.controls.enabled = this.mode === 'inspect' && !this.cameraGoal && !enabled;
    this.renderer.domElement.style.cursor = enabled ? (this.bezelDrag ? 'grabbing' : 'grab') : '';
  }

  private bezelPointerAngle(event: PointerEvent, hitTest = false): number | null {
    const ring = this.live?.root.getObjectByName('rotating-bezel');
    if (!ring || !this.live) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.floating.updateWorldMatrix(true, true);
    this.bezelRay.setFromCamera(pointer, this.camera);
    if (hitTest) {
      // A rear view must not let the user grab the hidden ring through the caseback.
      let object: THREE.Object3D | null =
        this.bezelRay.intersectObject(this.live.root, true)[0]?.object ?? null;
      while (object && object !== ring) object = object.parent;
      if (!object) return null;
    }
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(ring.matrixWorld);
    const origin = new THREE.Vector3(0, 0, this.live.dimensions.z.bezelTop - 0.045).applyMatrix4(
      ring.matrixWorld,
    );
    const point = this.bezelRay.ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin),
      new THREE.Vector3(),
    );
    if (!point) return null;
    this.live.root.worldToLocal(point);
    if (Math.hypot(point.x, point.y) < this.live.dimensions.openingRadius * 0.3) return null;
    return Math.atan2(point.y, point.x);
  }

  private bezelPointerDown = (event: PointerEvent): void => {
    if (!this.bezelEditing || this.mode !== 'inspect' || event.button !== 0 || this.bezelDrag)
      return;
    const angle = this.bezelPointerAngle(event, true);
    if (angle === null) return;
    this.bezelDrag = { id: event.pointerId, angle, remainder: 0 };
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
    event.preventDefault();
  };

  private bezelPointerMove = (event: PointerEvent): void => {
    const drag = this.bezelDrag,
      config = this.liveConfig;
    if (!drag || drag.id !== event.pointerId || !config) return;
    const angle = this.bezelPointerAngle(event);
    if (angle === null) return;
    const delta = -Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle)) / DEG;
    drag.angle = angle;
    drag.remainder += bezelScale(config) === 'dive-60' ? Math.min(0, delta) : delta;
    const step = Math.trunc(drag.remainder / 3) * 3;
    if (!step) return;
    drag.remainder -= step;
    const next = bezelAngle(config.bezel.angleDeg + step);
    this.liveConfig = { ...config, bezel: { ...config.bezel, angleDeg: next } };
    this.live?.setBezelAngle(next);
    this.dirty = true;
    this.onBezelChange?.(next);
    event.preventDefault();
  };

  private bezelPointerUp = (event: PointerEvent): void => {
    if (this.bezelDrag?.id !== event.pointerId) return;
    this.bezelDrag = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId))
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = this.bezelEditing ? 'grab' : '';
  };

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Le canvas est dimensionné directement en pixels physiques (voir resize).
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Reflets : studio procédural (aucun fichier HDRI à charger pour ce premier lot).
    this.environment = studioEnvironment(this.renderer);
    for (const scene of [this.scene, this.snapScene]) {
      scene.environment = this.environment;
      const key = new THREE.DirectionalLight('#ffffff', 1.1);
      key.position.set(-30, 50, 60);
      scene.add(key);
    }

    // Ombre portée douce : la montre flotte au-dessus du fond.
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      color: '#1b1f27',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
    this.snapShadow = new THREE.Mesh(this.shadow.geometry, shadowMaterial.clone());
    (this.snapShadow.material as THREE.MeshBasicMaterial).opacity = 0.22;
    this.scene.add(this.shadow, this.floating);
    this.backdrop = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      this.materials.matte('#1B1F27'),
    );
    this.snapScene.add(this.snapShadow, this.backdrop);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.addEventListener('change', () => (this.dirty = true));
    this.controls.addEventListener('start', () => (this.interacting = true));
    this.controls.addEventListener('end', () => (this.interacting = false));
    this.controls.enabled = false;
    this.renderer.domElement.addEventListener('pointerdown', this.bezelPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.bezelPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.bezelPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.bezelPointerUp);
    this.renderer.domElement.addEventListener('lostpointercapture', this.bezelPointerUp);
    this.controls.minPolarAngle = Math.PI / 2 - MAX_EL;
    this.controls.maxPolarAngle = Math.PI / 2 - MIN_EL;
    this.placeCamera(VIEWS.grid);

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      // Taille exacte en pixels physiques quand le navigateur la fournit.
      const device = entry.devicePixelContentBoxSize?.[0];
      this.boxWidth = device?.inlineSize ?? entry.contentRect.width * devicePixelRatio;
      this.boxHeight = device?.blockSize ?? entry.contentRect.height * devicePixelRatio;
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.boxWidth = container.clientWidth * devicePixelRatio;
    this.boxHeight = container.clientHeight * devicePixelRatio;
    this.resize();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  /** Remplace la montre centrale ; l'ancienne reste affichée jusqu'à ce que la nouvelle soit prête. */
  async setConfig(config: WatchConfig, transient = false): Promise<void> {
    const key = JSON.stringify({ ...config, bezel: { ...config.bezel, angleDeg: 0 } });
    if (!transient && !this.liveMaterials && this.live && key === this.liveConfigKey) {
      ++this.liveVersion; // Cancel an in-flight build if the user returned to this configuration.
      this.liveConfig = config;
      this.live.setBezelAngle(config.bezel.angleDeg);
      this.dirty = true;
      return;
    }
    const version = ++this.liveVersion;
    const materials = transient
      ? new MaterialLibrary(this.refinement === 'refined', config.view.night)
      : config.view.night
        ? this.nightMaterials
        : this.materials;
    const model = buildWatch(config, materials, {
      quality: this.quality,
      refinement: this.refinement,
      printSize: transient ? 1024 : undefined,
    });
    try {
      await model.ready;
      // Shaders compilés en parallèle (KHR_parallel_shader_compile) avant le premier
      // affichage : la première image ne fige plus la page.
      if (version === this.liveVersion) {
        await this.renderer.compileAsync(model.root, this.camera, this.scene);
      }
    } catch (error) {
      model.dispose();
      if (transient) materials.dispose();
      throw error;
    }
    if (version !== this.liveVersion) {
      model.dispose();
      if (transient) materials.dispose();
      return;
    }
    this.live?.dispose();
    this.liveMaterials?.dispose();
    this.liveMaterials = transient ? materials : null;
    this.live = model;
    this.scene.environmentIntensity = config.view.night ? 0.018 : 1;
    for (const child of this.scene.children) {
      if (child instanceof THREE.DirectionalLight)
        child.intensity = config.view.night ? 0.025 : 1.1;
    }
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = config.view.night ? 0.05 : 0.32;
    this.liveConfigKey = key;
    this.liveConfig = config;
    this.liveSteps = movementStepsPerSecond(config.movement);
    this.pilotFixedTime =
      (config.case.shape === 'cushion' || isBlackTonneau(config)) && config.view.time === 'fixed';
    this.liveOutline = outlinePoints(model);
    this.outlineScreen = new Float32Array(this.liveOutline.length * 2);
    this.lastAngles = null;
    this.dirty = true;
    this.floating.add(model.root);
    const d = model.dimensions;
    const reach = Math.max(d.lugToLug / 2, d.caseRadius + d.crown.length, d.caseThickness);
    this.liveShadow = { depth: reach + 3, drop: d.caseRadius * 0.2 };
  }

  /**
   * Dans la grille, la montre est vue de face (comme les cellules) et ne réagit pas au
   * pointeur ; inspectée, elle passe en trois quarts et se fait tourner à la souris.
   */
  setMode(mode: LiveMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.controls.enabled = false;
    this.interacting = false;
    this.cameraGoal = VIEWS[mode];
  }

  /** Vue inspectée : va vers une vue prédéfinie (0 à 4). */
  view(index: number): void {
    const goal = PRESET_VIEWS[index];
    if (!goal || this.mode !== 'inspect') return;
    this.controls.enabled = false;
    this.cameraGoal = goal;
  }

  /** Vue inspectée : tourne d'un pas (degrés), depuis la position actuelle. */
  rotate(dAzDeg: number, dElDeg: number): void {
    if (this.mode !== 'inspect') return;
    const base = this.cameraGoal ?? this.currentAngles();
    this.controls.enabled = false;
    this.cameraGoal = {
      az: base.az + dAzDeg * DEG,
      el: THREE.MathUtils.clamp(base.el + dElDeg * DEG, MIN_EL, MAX_EL),
    };
  }

  /**
   * Échelle CSS que la page applique au canvas (montre réduite dans la grille). Sans elle,
   * le canvas serait calculé à sa taille d'ouverture puis réduit par le navigateur, ce qui
   * adoucit les détails et dessine bien plus de pixels que nécessaire. En grandissant, la
   * résolution monte tout de suite ; en rapetissant, après la transition CSS.
   */
  setDisplayScale(scale: number): void {
    const next = THREE.MathUtils.clamp(scale, 0.05, 4);
    clearTimeout(this.shrinkTimer);
    if (this.displayScale === null || next >= this.displayScale) {
      this.applyDisplayScale(next);
    } else {
      this.shrinkTimer = setTimeout(() => this.applyDisplayScale(next), SHRINK_DELAY_MS);
    }
  }

  private applyDisplayScale(scale: number): void {
    this.displayScale = scale;
    this.resize();
  }

  /** Met en pause ou relance les aiguilles ; renvoie vrai si elles sont en pause. */
  togglePause(): boolean {
    this.pausedAt = this.pausedAt ? null : new Date();
    return this.pausedAt !== null;
  }

  private pausedAt: Date | null = null;

  private currentAngles(): CameraGoal {
    const p = this.camera.position;
    const distance = p.length();
    return {
      az: Math.atan2(p.x, p.z),
      el: Math.asin(THREE.MathUtils.clamp(p.y / distance, -1, 1)),
    };
  }

  /** Produit l'instantané d'une pièce (rendu une fois, gardé comme image). */
  snapshot(job: SnapshotJob): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      if (job.signal?.aborted) {
        reject(abortError());
        return;
      }
      // Simple demande pour l'instant : le modèle n'est construit qu'à son tour (frame),
      // pour ne pas assembler toutes les cellules de la grille dans la même tâche.
      const entry: QueuedJob = { job, state: 'pending', model: null, resolve, reject };
      job.signal?.addEventListener('abort', () => this.cancel(entry, abortError()), {
        once: true,
      });
      insertByPriority(this.pending, entry);
    });
  }

  /** Construit le modèle d'un instantané, puis prépare ses textures et ses shaders. */
  private prepare(entry: QueuedJob): void {
    const { job } = entry;
    let model: WatchModel;
    try {
      model = buildWatch(job.config, this.materials, {
        quality: this.quality,
        refinement: this.refinement,
        layers: job.layers,
        printSize: 1024,
      });
      model.showOnly(job.layers);
      model.setAngles(handAngles(POSTER_TIME, 0));
    } catch (error) {
      entry.state = 'done';
      entry.reject(error);
      return;
    }
    entry.state = 'building';
    entry.model = model;
    this.building.add(entry);
    model.ready
      .then(() =>
        entry.state === 'done'
          ? undefined
          : this.renderer.compileAsync(model.root, this.snapCamera, this.snapScene),
      )
      .then(
        () => {
          this.building.delete(entry);
          // Annulé pendant la préparation : le modèle est libéré ici.
          if (entry.state === 'done') {
            model.dispose();
            return;
          }
          entry.state = 'prepared';
          insertByPriority(this.prepared, entry);
        },
        (error: unknown) => {
          this.building.delete(entry);
          model.dispose();
          if (entry.state === 'done') return;
          entry.state = 'done';
          entry.reject(error);
        },
      );
  }

  /** Retire un instantané de la file, quel que soit son avancement. */
  private cancel(entry: QueuedJob, error: unknown): void {
    const state = entry.state;
    if (state === 'done') return;
    entry.state = 'done';
    if (state === 'pending') removeFrom(this.pending, entry);
    if (state === 'prepared') {
      removeFrom(this.prepared, entry);
      entry.model?.dispose();
    }
    // building : prepare() libère le modèle quand sa préparation se termine.
    entry.reject(error);
  }

  private distance(): number {
    return FRAME_RADIUS_MM / Math.tan((this.camera.fov / 2) * DEG);
  }

  private placeCamera({ az, el }: CameraGoal): void {
    const distance = this.distance();
    this.camera.position.set(
      distance * Math.sin(az) * Math.cos(el),
      distance * Math.sin(el),
      distance * Math.cos(az) * Math.cos(el),
    );
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.minDistance = distance * 0.6;
    this.controls.maxDistance = distance * 2.5;
  }

  /** Rapproche la caméra de la vue visée (amorti, indépendant de la cadence d'images). */
  private tweenCamera(dt: number): void {
    const goal = this.cameraGoal;
    if (!goal) return;
    const p = this.camera.position;
    const distance = p.length();
    const el = Math.asin(THREE.MathUtils.clamp(p.y / distance, -1, 1));
    let az = Math.atan2(p.x, p.z);
    const k = 1 - Math.exp(-dt / 0.09);
    const dAz = Math.atan2(Math.sin(goal.az - az), Math.cos(goal.az - az));
    az += dAz * k;
    const nextEl = el + (goal.el - el) * k;
    const nextDistance = distance + (this.distance() - distance) * k;
    p.set(
      nextDistance * Math.sin(az) * Math.cos(nextEl),
      nextDistance * Math.sin(nextEl),
      nextDistance * Math.cos(az) * Math.cos(nextEl),
    );
    this.camera.lookAt(this.controls.target);
    if (Math.abs(dAz) < 0.002 && Math.abs(goal.el - nextEl) < 0.002) {
      this.placeCamera(goal);
      this.cameraGoal = null;
      this.controls.enabled = this.mode === 'inspect' && !this.bezelEditing;
    }
  }

  /**
   * L'ombre appartient à l'écran, pas à la montre : elle reste derrière l'objet, face à la
   * caméra et décalée vers le bas de l'écran, quel que soit l'angle de vue. Sa taille suit
   * la silhouette visible (ronde de face, allongée de profil). La montre semble flotter
   * au-dessus de la page, éclairée d'en haut.
   */
  private updateLiveShadow(): void {
    const { depth, drop } = this.liveShadow;
    this.shadow.visible = this.live !== null;
    if (!this.live) return;
    const camera = this.camera;
    const target = this.controls.target;
    camera.getWorldDirection(this.shadowDir); // de la caméra vers la cible
    this.shadowUp.set(0, 1, 0).applyQuaternion(camera.quaternion); // haut de l'écran
    this.shadowRight.set(1, 0, 0).applyQuaternion(camera.quaternion);

    // Silhouette : points du contour de la montre (dans son propre repère, donc tournés
    // avec elle), projetés sur le plan de l'écran, puis résumés par une ellipse orientée
    // selon leurs axes principaux.
    // Matrice à jour : l'image n'est plus redessinée à chaque frame, celle du rendu
    // précédent pourrait dater.
    this.live.root.updateWorldMatrix(true, false);
    const matrix = this.live.root.matrixWorld;
    const outline = this.liveOutline;
    const points = this.outlineScreen;
    const n = outline.length;
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      this.shadowCorner.copy(outline[i]!).applyMatrix4(matrix).sub(target);
      const x = this.shadowCorner.dot(this.shadowRight);
      const y = this.shadowCorner.dot(this.shadowUp);
      points[2 * i] = x;
      points[2 * i + 1] = y;
      mx += x / n;
      my += y / n;
    }
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      const x = points[2 * i]! - mx;
      const y = points[2 * i + 1]! - my;
      sxx += x * x;
      sxy += x * y;
      syy += y * y;
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    let major = 0;
    let minor = 0;
    for (let i = 0; i < n; i++) {
      const x = points[2 * i]! - mx;
      const y = points[2 * i + 1]! - my;
      major = Math.max(major, Math.abs(x * ax + y * ay));
      minor = Math.max(minor, Math.abs(-x * ay + y * ax));
    }

    const distance = camera.position.distanceTo(target);
    const k = (distance + depth) / distance; // compense la perspective
    this.shadow.position
      .copy(target)
      .addScaledVector(this.shadowDir, depth)
      .addScaledVector(this.shadowRight, mx * k)
      .addScaledVector(this.shadowUp, (my - drop) * k);
    this.shadow.quaternion.copy(camera.quaternion);
    this.shadow.rotateZ(angle);
    // Le dégradé de l'ombre s'estompe vers le bord du plan : le plan doit déborder
    // largement de la silhouette pour qu'un halo reste visible autour de la montre.
    const spread = 1.1;
    this.shadow.scale.set((major * 2 * spread + drop) * k, (minor * 2 * spread + drop) * k, 1);
  }

  /**
   * Capture of the live view, redrawn at a higher definition than the screen: the WebGL
   * buffer is read in the same task as the render, before the browser clears it, then the
   * canvas returns to its displayed size.
   */
  capture(sizePx: number, background?: string): Promise<Blob> {
    const aspect = this.width / Math.max(1, this.height) || 1;
    const w = Math.round(aspect >= 1 ? sizePx : sizePx * aspect);
    const h = Math.round(aspect >= 1 ? sizePx / aspect : sizePx);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const context = out.getContext('2d')!;
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, w, h);
    }
    this.renderer.setSize(w, h, false);
    try {
      this.updateLiveShadow();
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
      context.drawImage(this.renderer.domElement, 0, 0);
    } finally {
      this.renderer.setSize(this.width, this.height, false);
      this.dirty = true;
    }
    return new Promise((resolve, reject) =>
      out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('capture'))), 'image/png'),
    );
  }

  /**
   * Canvas à la taille réellement affichée, en pixels physiques : taille du conteneur
   * multipliée par l'échelle CSS de la page. La grille cale cette taille sur un nombre
   * entier de pixels : l'image s'affiche pixel pour pixel. Au-delà d'une densité de 2
   * (écrans 3×), on plafonne pour le coût, quitte à laisser le navigateur agrandir.
   */
  private resize(): void {
    const density = Math.min(1, 2 / devicePixelRatio);
    const scale = (this.displayScale ?? 1) * density;
    const w = Math.round(this.boxWidth * scale);
    const h = Math.round(this.boxHeight * scale);
    if (w === 0 || h === 0 || (w === this.width && h === this.height)) return;
    this.width = w;
    this.height = h;
    this.dirty = true;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Boucle d'images. L'image en direct n'est redessinée que si quelque chose a bougé :
   * aiguilles, respiration, caméra, configuration, taille, ou instantané dessiné dans le
   * même canvas. Sinon le navigateur garde l'image précédente et le GPU se repose.
   */
  private readonly frame = () => {
    this.frameHandle = requestAnimationFrame(this.frame);
    if (document.hidden) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const t = (now - this.startTime) / 1000;

    // Instantanés d'abord : ils sont dessinés dans le même canvas, puis recouverts par
    // l'image en direct avant que le navigateur n'affiche la frame. Budget de temps par
    // image ; au moins un modèle mis en préparation pour que la file avance toujours.
    const deadline = now + SNAPSHOT_BUDGET_MS;
    let drewSnapshot = false;
    while (this.prepared.length > 0 && performance.now() < deadline) {
      this.renderSnapshot(this.prepared.shift()!);
      drewSnapshot = true;
    }
    let started = 0;
    while (
      this.pending.length > 0 &&
      this.building.size + this.prepared.length < MAX_IN_FLIGHT &&
      (started === 0 || performance.now() < deadline)
    ) {
      this.prepare(this.pending.shift()!);
      started++;
    }

    let dirty = this.dirty || drewSnapshot;
    this.dirty = false;
    if (this.live) {
      const angles = handAngles(
        this.pilotFixedTime ? POSTER_TIME : timeOfDay(this.pausedAt ?? new Date()),
        this.liveSteps,
      );
      if (!sameAngles(this.lastAngles, angles)) {
        this.live.setAngles(angles);
        this.lastAngles = angles;
        dirty = true;
      }
      // « Respiration » : rotation très lente qui fait jouer les reflets.
      const breathe =
        this.interacting || this.bezelEditing || this.pilotFixedTime || this.reducedMotion.matches
          ? 0
          : 1;
      const rotation = this.floating.rotation;
      const dy = (Math.sin(t * 0.35) * 0.05 * breathe - rotation.y) * 0.05;
      const dx = (Math.cos(t * 0.27) * 0.025 * breathe - rotation.x) * 0.05;
      if (Math.abs(dy) > STILL || Math.abs(dx) > STILL) {
        rotation.y += dy;
        rotation.x += dx;
        dirty = true;
      }
    }
    if (this.cameraGoal) {
      this.tweenCamera(dt);
      dirty = true;
    } else if (this.controls.enabled && this.controls.update()) {
      dirty = true;
    }
    if (!dirty) return;

    this.updateLiveShadow();
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.render(this.scene, this.camera);
  };

  private renderSnapshot(entry: QueuedJob): void {
    const { job, resolve, reject } = entry;
    const model = entry.model!;
    entry.state = 'done';
    try {
      const canvas = this.renderer.domElement;
      const ratio = this.renderer.getPixelRatio();
      const px = Math.min(job.sizePx, canvas.width, canvas.height);
      const css = px / ratio;

      const { x, y, half } = job.frame;
      const cam = this.snapCamera;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      if (job.frame.view === 'side') {
        cam.up.set(0, 0, 1);
        cam.position.set(-200, -x, y);
        cam.lookAt(0, -x, y);
      } else {
        cam.up.set(0, 1, 0);
        cam.position.set(x, y, 200);
        cam.lookAt(x, y, 0);
      }
      cam.updateProjectionMatrix();

      this.backdrop.visible = job.backdrop !== null;
      if (job.backdrop) {
        this.backdrop.scale.setScalar(job.backdrop.radius);
        this.backdrop.material = this.materials.matte(job.backdrop.color);
        this.backdrop.position.set(0, 0, -0.05);
      }
      // Ombre douce contenue dans la cellule : elle s'estompe avant le bord de l'image.
      // Seules les pièces pleines (boîtier, cadran) portent une ombre ; des aiguilles
      // seules laisseraient une tache grise.
      const solid =
        !job.layers ||
        job.layers.includes('case') ||
        job.layers.includes('dial') ||
        job.backdrop !== null;
      this.snapShadow.visible = solid && job.frame.view !== 'side';
      this.snapShadow.scale.set(half * 1.5, half * 1.6, 1);
      this.snapShadow.position.set(x, y - half * 0.08, model.dimensions.z.back - 4);

      this.snapScene.add(model.root);
      this.renderer.setScissorTest(true);
      this.renderer.setViewport(0, 0, css, css);
      this.renderer.setScissor(0, 0, css, css);
      this.renderer.clear();
      this.renderer.render(this.snapScene, cam);

      const out = document.createElement('canvas');
      out.width = out.height = px;
      out.getContext('2d')!.drawImage(canvas, 0, canvas.height - px, px, px, 0, 0, px, px);
      model.dispose();
      createImageBitmap(out).then(resolve, reject);
    } catch (error) {
      model.dispose();
      reject(error);
    }
  }

  dispose(): void {
    ++this.liveVersion;
    clearTimeout(this.shrinkTimer);
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    for (const entry of [...this.pending, ...this.building, ...this.prepared]) {
      this.cancel(entry, abortError('Scène fermée'));
    }
    this.live?.dispose();
    this.liveMaterials?.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.bezelPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.bezelPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.bezelPointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.bezelPointerUp);
    this.renderer.domElement.removeEventListener('lostpointercapture', this.bezelPointerUp);
    this.controls.dispose();
    this.shadow.geometry.dispose();
    this.backdrop.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    (this.snapShadow.material as THREE.Material).dispose();
    this.shadowTexture.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.nightMaterials.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

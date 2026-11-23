/**
 * Scène 3D : un seul contexte WebGL pour toute la page (plan d'action §1.2).
 * Il sert à la fois à la montre centrale en direct et à la fabrication des instantanés
 * de cellules, intercalés entre deux images.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { handAngles, POSTER_TIME, timeOfDay } from '../core/clock/angles';
import { isBlackTonneau } from '../core/config/instrument';
import type { WatchConfig } from '../core/config/types';
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
  model: WatchModel;
  resolve: (bitmap: ImageBitmap) => void;
  reject: (error: unknown) => void;
}

const SNAPSHOTS_PER_FRAME = 2;

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
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function detectCrystalQuality(): CrystalQuality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  return navigator.hardwareConcurrency > 4 && !coarse ? 'transmission' : 'fallback';
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private readonly refinement = refinementFromSearch(location.search);
  readonly materials = new MaterialLibrary(this.refinement === 'refined');
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
  private readonly queue: QueuedJob[] = [];
  private live: WatchModel | null = null;
  /** Transient palettes must not accumulate every dragged colour in the shared cache. */
  private liveMaterials: MaterialLibrary | null = null;
  private liveVersion = 0;
  private liveSteps = 0;
  private pilotFixedTime = false;
  private liveShadow = { depth: 0, drop: 0 };
  /** Points du contour de la montre centrale, dans son propre repère (pour l'ombre). */
  private liveOutline: THREE.Vector3[] = [];
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

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    this.controls.addEventListener('start', () => (this.interacting = true));
    this.controls.addEventListener('end', () => (this.interacting = false));
    this.controls.enabled = false;
    this.controls.minPolarAngle = Math.PI / 2 - MAX_EL;
    this.controls.maxPolarAngle = Math.PI / 2 - MIN_EL;
    this.placeCamera(VIEWS.grid);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  /** Remplace la montre centrale ; l'ancienne reste affichée jusqu'à ce que la nouvelle soit prête. */
  async setConfig(config: WatchConfig, transient = false): Promise<void> {
    const version = ++this.liveVersion;
    const materials = transient
      ? new MaterialLibrary(this.refinement === 'refined')
      : this.materials;
    const model = buildWatch(config, materials, {
      quality: this.quality,
      refinement: this.refinement,
      printSize: transient ? 1024 : undefined,
    });
    try {
      await model.ready;
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
    this.liveSteps = movementStepsPerSecond(config.movement);
    this.pilotFixedTime =
      (config.case.shape === 'cushion' || isBlackTonneau(config)) && config.view.time === 'fixed';
    this.liveOutline = outlinePoints(model);
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
      const model = buildWatch(job.config, this.materials, {
        quality: this.quality,
        refinement: this.refinement,
        layers: job.layers,
        printSize: 1024,
      });
      model.showOnly(job.layers);
      model.setAngles(handAngles(POSTER_TIME, 0));
      const entry: QueuedJob = { job, model, resolve, reject };
      job.signal?.addEventListener('abort', () => {
        const i = this.queue.indexOf(entry);
        if (i >= 0) this.queue.splice(i, 1);
        model.dispose();
        reject(new DOMException('Annulé', 'AbortError'));
      });
      model.ready.then(
        () => {
          if (job.signal?.aborted) return;
          // File triée par priorité : les cellules proches du centre d'abord.
          const p = job.priority ?? 0;
          const at = this.queue.findIndex((other) => (other.job.priority ?? 0) > p);
          this.queue.splice(at === -1 ? this.queue.length : at, 0, entry);
        },
        (error) => {
          model.dispose();
          reject(error);
        },
      );
    });
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
      this.controls.enabled = this.mode === 'inspect';
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
    const matrix = this.live.root.matrixWorld;
    const outline = this.liveOutline;
    const points: [number, number][] = [];
    let mx = 0;
    let my = 0;
    for (const local of outline) {
      this.shadowCorner.copy(local).applyMatrix4(matrix).sub(target);
      const p: [number, number] = [
        this.shadowCorner.dot(this.shadowRight),
        this.shadowCorner.dot(this.shadowUp),
      ];
      points.push(p);
      mx += p[0] / outline.length;
      my += p[1] / outline.length;
    }
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const [x, y] of points) {
      sxx += (x - mx) ** 2;
      sxy += (x - mx) * (y - my);
      syy += (y - my) ** 2;
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    let major = 0;
    let minor = 0;
    for (const [x, y] of points) {
      major = Math.max(major, Math.abs((x - mx) * ax + (y - my) * ay));
      minor = Math.max(minor, Math.abs(-(x - mx) * ay + (y - my) * ax));
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

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private readonly frame = () => {
    this.frameHandle = requestAnimationFrame(this.frame);
    if (document.hidden) return;

    // Instantanés d'abord : ils sont dessinés dans le même canvas, puis recouverts par
    // l'image en direct avant que le navigateur n'affiche la frame.
    for (let i = 0; i < SNAPSHOTS_PER_FRAME && this.queue.length > 0; i++) {
      this.renderSnapshot(this.queue.shift()!);
    }

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const t = (now - this.startTime) / 1000;
    if (this.live) {
      this.live.setAngles(
        handAngles(
          this.pilotFixedTime ? POSTER_TIME : timeOfDay(this.pausedAt ?? new Date()),
          this.liveSteps,
        ),
      );
      // « Respiration » : rotation très lente qui fait jouer les reflets.
      const breathe = this.interacting || this.pilotFixedTime || reducedMotion() ? 0 : 1;
      this.floating.rotation.y +=
        (Math.sin(t * 0.35) * 0.05 * breathe - this.floating.rotation.y) * 0.05;
      this.floating.rotation.x +=
        (Math.cos(t * 0.27) * 0.025 * breathe - this.floating.rotation.x) * 0.05;
    }
    if (this.cameraGoal) this.tweenCamera(dt);
    else if (this.controls.enabled) this.controls.update();
    this.updateLiveShadow();
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.container.clientWidth, this.container.clientHeight);
    this.renderer.render(this.scene, this.camera);
  };

  private renderSnapshot({ job, model, resolve, reject }: QueuedJob): void {
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
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    for (const entry of this.queue) {
      entry.model.dispose();
      entry.reject(new DOMException('Scène fermée', 'AbortError'));
    }
    this.queue.length = 0;
    this.live?.dispose();
    this.liveMaterials?.dispose();
    this.controls.dispose();
    this.shadow.geometry.dispose();
    this.backdrop.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    (this.snapShadow.material as THREE.Material).dispose();
    this.shadowTexture.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

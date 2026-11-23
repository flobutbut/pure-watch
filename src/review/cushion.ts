/** Local review harness; not an entry point in the production build. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { configUrl } from '../core/config/url';
import { DIAL_SHAPES } from '../core/geometry/dial-shape';
import { CASE_SHAPES } from '../core/geometry/case-shape';
import { blackTonneauPilot, cushionPilot } from '../core/config/pilot';
import { handAngles, POSTER_TIME } from '../core/clock/angles';
import { studioEnvironment } from '../render3d/environment';
import { MaterialLibrary, type CrystalQuality } from '../render3d/materials';
import { HAND_SETS, SECOND_STYLES } from '../render3d/parts/hands';
import { buildWatch, type WatchModel } from '../render3d/watch';
import type { Refinement } from '../render3d/refinement';

const query = new URLSearchParams(location.search);
const black = query.get('pilot') === 'black';
const config = black ? blackTonneauPilot() : cushionPilot();
const handScope = query.get('scope') === 'hands';
const dialScope = query.get('scope') === 'dial';
const requestedBody = query.get('body');
if (requestedBody && CASE_SHAPES.some((s) => s === requestedBody))
  config.case.shape = requestedBody;
const requestedDial = query.get('dial');
if (requestedDial && DIAL_SHAPES.some((s) => s === requestedDial))
  config.dial.shape = requestedDial;
const requestedHands = query.get('hands');
if (requestedHands && HAND_SETS.includes(requestedHands)) config.hands.set = requestedHands;
const requestedSeconds = query.get('seconds');
if (requestedSeconds && SECOND_STYLES.includes(requestedSeconds))
  config.hands.second.style = requestedSeconds;
if (black) {
  document.title = 'Épure · contrôle du tonneau noir';
  document.querySelector('h1')!.textContent = 'Tonneau noir · aiguilles et finitions céramiques';
  document.querySelector('section:last-child h2')!.textContent =
    'Après · biseaux et surfaces satinées';
  document.querySelector<HTMLOptionElement>('#finish option[value="refined"]')!.textContent =
    'Géométrie + finitions';
  document.body.style.background = '#292C30';
  document.body.style.color = '#E4E7EB';
  document.querySelector<HTMLElement>('footer')!.style.color = '#AFB8C3';
  for (const control of document.querySelectorAll<HTMLElement>('button, select'))
    control.style.color = '#202832';
  for (const link of document.querySelectorAll<HTMLAnchorElement>('footer a'))
    link.href = link.href.replace('pilot=cushion', 'pilot=black');
}
if (handScope) {
  document.querySelector('h1')!.textContent = `Étude des aiguilles · ${config.hands.set}`;
  document.querySelector('header p')!.textContent =
    'Même jeu, mêmes longueurs, caméra et studio identiques · gros plan sans verre.';
  document.querySelector('section:first-child h2')!.textContent = 'Avant · version précédente';
  document.querySelector('section:last-child h2')!.textContent =
    'Après · formes et finitions affinées';
  const label = document.createElement('label');
  label.textContent = 'Jeu ';
  const select = document.createElement('select');
  select.id = 'hand-set';
  select.style.color = '#202832';
  const names: Record<string, string> = {
    baton: 'Bâton',
    sword: 'Épée',
    dauphine: 'Dauphine',
    leaf: 'Feuille',
    syringe: 'Seringue',
    breguet: 'Breguet',
    spear: 'Lance',
    pencil: 'Crayon',
    spade: 'Pique',
    'art-deco': 'Art déco',
    skeleton: 'Ajourées',
    cathedral: 'Cathédrale',
  };
  for (const id of HAND_SETS) select.add(new Option(names[id] ?? id, id));
  select.value = config.hands.set;
  select.onchange = () => {
    config.hands.set = select.value;
    document.querySelector('h1')!.textContent = `Étude des aiguilles · ${names[select.value]}`;
    void rebuild();
  };
  label.appendChild(select);
  document.querySelector('nav')!.prepend(label);
}
if (dialScope) {
  const names: Record<string, string> = {
    round: 'Rond',
    cushion: 'Coussin',
    tonneau: 'Tonneau',
    octagon: 'Octogonal',
    square: 'Carré',
    rectangle: 'Rectangulaire',
  };
  document.title = 'Épure · formes du cadran';
  document.querySelector('h1')!.textContent =
    `Formes du cadran · boîtier ${names[config.case.shape]}`;
  document.querySelector('header p')!.textContent =
    'Même boîtier et même studio. Ouverture, réhaut, verre et repères suivent le cadran ; aiguilles de longueur fixe.';
  document.querySelector('section:first-child h2')!.textContent = 'Référence · cadran rond';
  document.querySelector('section:last-child h2')!.textContent =
    'Cadran choisi · ouverture adaptée';
  const label = document.createElement('label');
  label.textContent = 'Cadran ';
  const select = document.createElement('select');
  select.id = 'dial-shape';
  select.style.color = '#202832';
  for (const id of DIAL_SHAPES) select.add(new Option(names[id], id));
  select.value = config.dial.shape;
  select.onchange = () => {
    config.dial.shape = select.value;
    void rebuild();
  };
  label.appendChild(select);
  document.querySelector('nav')!.prepend(label);
  document.querySelector<HTMLSelectElement>('#finish')!.closest('label')!.hidden = true;
}
let quality: CrystalQuality = query.get('quality') === 'fallback' ? 'fallback' : 'transmission';
let finish: Refinement = query.get('finish') === 'geometry' ? 'geometry' : 'refined';
let spinning = false;
let movingHands = false;
let benchmarking = false;
let ready = false;
let dirty = true;
const views = {
  front: [0, 0],
  quarter: [32, 27],
  profile: [-90, 0],
  back: [180, 0],
} as const;

const panes = ['before', 'after'].map((id, index) => {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${id}`)!;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.info.autoReset = false;
  const environment = studioEnvironment(renderer);
  const scene = new THREE.Scene();
  scene.environment = environment;
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(-30, 50, 60);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = handScope ? 35 : 75;
  controls.maxDistance = 200;
  const lib = new MaterialLibrary(handScope || dialScope || (index === 1 && finish === 'refined'));
  if (handScope) {
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), lib.matte('#17212B'));
    backdrop.name = 'hand-backdrop';
    backdrop.position.z = -0.15;
    scene.add(backdrop);
  }
  return {
    renderer,
    environment,
    scene,
    camera,
    controls,
    lib,
    model: null as WatchModel | null,
    id,
  };
});

function metrics(index: number) {
  const pane = panes[index]!;
  let triangles = 0;
  let meshes = 0;
  pane.model?.root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes++;
      triangles +=
        (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    }
  });
  return {
    triangles,
    meshes,
    calls: pane.renderer.info.render.calls,
    renderedTriangles: pane.renderer.info.render.triangles,
    geometries: pane.renderer.info.memory.geometries,
    textures: pane.renderer.info.memory.textures,
  };
}

async function rebuild() {
  ready = false;
  const links = document.querySelectorAll<HTMLAnchorElement>('footer a');
  const liveLink = links[0];
  const legacyLink = links[1];
  if (liveLink) liveLink.href = configUrl(config, new URL('/', location.href)).href;
  if (legacyLink)
    legacyLink.href = configUrl(config, new URL('/?model=legacy', location.href)).href;
  for (const [index, pane] of panes.entries()) {
    pane.model?.dispose();
    pane.lib.dispose();
    pane.lib = new MaterialLibrary(
      dialScope ||
        (handScope ? index === 0 || finish === 'refined' : index === 1 && finish === 'refined'),
    );
    const backdrop = pane.scene.getObjectByName('hand-backdrop') as THREE.Mesh | undefined;
    if (backdrop) backdrop.material = pane.lib.matte('#17212B');
    const modelConfig =
      dialScope && index === 0 ? { ...config, dial: { ...config.dial, shape: 'round' } } : config;
    pane.model = buildWatch(modelConfig, pane.lib, {
      quality,
      refinement: handScope || dialScope ? 'refined' : index === 0 ? 'legacy' : finish,
      handDetail: handScope ? (index === 0 ? 'legacy' : 'refined') : undefined,
      layers: handScope ? ['hands', 'seconds'] : undefined,
    });
    await pane.model.ready;
    pane.model.setAngles(handAngles(POSTER_TIME, 0));
    pane.scene.add(pane.model.root);
  }
  ready = true;
  dirty = true;
}

function setView(name: keyof typeof views) {
  dirty = true;
  const [az, el] = views[name].map(THREE.MathUtils.degToRad) as [number, number];
  for (const pane of panes) {
    const distance = handScope ? 58 : 112;
    pane.camera.position.set(
      distance * Math.sin(az) * Math.cos(el),
      distance * Math.sin(el),
      distance * Math.cos(az) * Math.cos(el),
    );
    pane.controls.target.set(0, handScope ? 4 : 0, handScope ? 1 : -1);
    if (handScope) pane.camera.position.add(pane.controls.target);
    pane.controls.update();
  }
}

for (const [index, pane] of panes.entries()) {
  pane.controls.addEventListener('change', () => {
    dirty = true;
    const other = panes[1 - index]!;
    other.camera.position.copy(pane.camera.position);
    other.camera.quaternion.copy(pane.camera.quaternion);
    other.controls.target.copy(pane.controls.target);
  });
  new ResizeObserver(() => {
    dirty = true;
    const size = pane.renderer.domElement.clientWidth;
    pane.renderer.setSize(size, size, false);
  }).observe(pane.renderer.domElement);
}

function render(index: number) {
  const pane = panes[index]!;
  pane.renderer.info.reset();
  pane.renderer.render(pane.scene, pane.camera);
}

function frame(now: number) {
  requestAnimationFrame(frame);
  if (!ready || benchmarking || (!dirty && !spinning && !movingHands)) return;
  dirty = false;
  if (spinning) {
    for (const pane of panes)
      pane.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.004);
    for (const pane of panes) pane.camera.lookAt(pane.controls.target);
  }
  if (movingHands)
    for (const pane of panes)
      pane.model?.setAngles(handAngles({ h: 10, m: 10, s: (35 + now / 1000) % 60 }, 6));
  for (const [index, pane] of panes.entries()) {
    render(index);
    const m = metrics(index);
    document.querySelector(`#${pane.id}-stats`)!.textContent =
      `${m.triangles.toLocaleString('fr-FR')} triangles · ${m.calls} appels de rendu (${quality})`;
  }
}

async function benchmark(index: number, count = 90) {
  benchmarking = true;
  const intervals: number[] = [];
  const submit: number[] = [];
  let previous = 0;
  for (let i = 0; i < count + 15; i++) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const start = performance.now();
    render(index);
    if (i >= 15) {
      intervals.push(now - previous);
      submit.push(performance.now() - start);
    }
    previous = now;
  }
  benchmarking = false;
  dirty = true;
  const percentile = (values: number[], p: number) =>
    [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]!;
  return {
    ...metrics(index),
    frameMedianMs: percentile(intervals, 0.5),
    frameP95Ms: percentile(intervals, 0.95),
    submitMedianMs: percentile(submit, 0.5),
    width: panes[index]!.renderer.domElement.width,
    height: panes[index]!.renderer.domElement.height,
    pixelRatio: panes[index]!.renderer.getPixelRatio(),
    quality,
  };
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))
  button.onclick = () => {
    spinning = false;
    setView(button.dataset.view as keyof typeof views);
  };
document.querySelector<HTMLButtonElement>('#rotate')!.onclick = () => {
  spinning = !spinning;
};
document.querySelector<HTMLButtonElement>('#hands')!.onclick = () => {
  movingHands = !movingHands;
  if (!movingHands) for (const pane of panes) pane.model?.setAngles(handAngles(POSTER_TIME, 0));
};
const finishSelect = document.querySelector<HTMLSelectElement>('#finish')!;
finishSelect.value = finish;
finishSelect.onchange = () => {
  finish = finishSelect.value as Refinement;
  void rebuild();
};
const qualitySelect = document.querySelector<HTMLSelectElement>('#quality')!;
qualitySelect.value = quality;
qualitySelect.onchange = () => {
  quality = qualitySelect.value as CrystalQuality;
  void rebuild();
};

const review = {
  get ready() {
    return ready;
  },
  setView,
  metrics,
  benchmark,
  panes,
  config,
  async setFinish(value: Refinement) {
    finish = value;
    finishSelect.value = value;
    await rebuild();
  },
};
declare global {
  interface Window {
    __cushionReview: typeof review;
  }
}
window.__cushionReview = review;
setView('quarter');
await rebuild();
requestAnimationFrame(frame);

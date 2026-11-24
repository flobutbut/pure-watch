/** Development-only contact sheet using the production watch builder and studio. */
import * as THREE from 'three';
import { defaultConfig } from '../core/config/defaults';
import { LUG_JOINS } from '../core/config/lugs';
import { CASE_PROFILES } from '../core/config/case-profile';
import { CASE_SHAPES } from '../core/geometry/case-shape';
import { proportionsForDiameter } from '../core/geometry/dimensions';
import { handAngles, POSTER_TIME } from '../core/clock/angles';
import { MaterialLibrary } from '../render3d/materials';
import { studioEnvironment } from '../render3d/environment';
import { buildWatch } from '../render3d/watch';
import { LUG_STYLES } from '../render3d/parts/lugs';

const query = new URLSearchParams(location.search);
const names: Record<string, string> = {
  straight: 'Droites',
  curved: 'Courbes',
  pointed: 'Pointues',
  faceted: 'Chanfreinées',
  teardrop: 'Gouttes',
  drilled: 'Percées',
  integrated: 'Intégrées',
  none: 'Aucune',
  detached: 'Détaché',
  flush: 'Affleurant',
  blended: 'Fondu',
  round: 'Rond',
  cushion: 'Coussin',
  tonneau: 'Tonneau',
  octagon: 'Octogonal',
  square: 'Carré',
  rectangle: 'Rectangulaire',
  front: 'Face',
  quarter: 'Trois quarts',
  side: 'Profil',
  case: 'Même forme que le boîtier',
  watch: 'Montre entière',
  root: 'Raccord supérieur',
};
function select(key: string, label: string, options: readonly string[], initial: string) {
  const control = document.createElement('select');
  const chosen = query.get(key) ?? initial;
  for (const value of options) control.add(new Option(names[value] ?? value, value));
  control.value = options.includes(chosen) ? chosen : initial;
  control.onchange = () => {
    query.set(key, control.value);
    location.search = query.toString();
  };
  const wrapper = document.createElement('label');
  wrapper.append(label, control);
  document.querySelector('nav')!.append(wrapper);
  return control.value;
}
const shape = select('shape', 'Boîtier', CASE_SHAPES, 'round');
const view = select('view', 'Vue', ['front', 'quarter', 'side'], 'front');
const profile = select('profile', 'Profil du boîtier', CASE_PROFILES, 'curved');
const diameter = Number(select('diameter', 'Diamètre', ['22', '40', '48'], '40'));
const dial = select('dial', 'Cadran', ['round', 'case'], 'round');
const detail = select('detail', 'Cadrage', ['watch', 'root'], 'watch');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(480, 480);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor('#202c3a');
const scene = new THREE.Scene();
const environment = studioEnvironment(renderer);
scene.environment = environment;
const light = new THREE.DirectionalLight('#ffffff', 1.1);
light.position.set(-30, 50, 60);
scene.add(light);
const half =
  detail === 'root'
    ? diameter * 0.4
    : diameter * (shape === 'tonneau' || shape === 'rectangle' ? 0.82 : 0.72);
const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, 500);
camera.position.copy(
  view === 'side'
    ? new THREE.Vector3(-200, 0, 0)
    : view === 'quarter'
      ? new THREE.Vector3(80, 55, 180)
      : new THREE.Vector3(0, 0, 200),
);
const target = new THREE.Vector3(0, detail === 'root' ? diameter * 0.37 : 0, -1);
camera.position.add(target);
camera.lookAt(target);
const lib = new MaterialLibrary(true);
const main = document.querySelector('main')!;
const columns = document.createElement('div');
columns.className = 'columns';
for (const join of LUG_JOINS) {
  const title = document.createElement('strong');
  title.textContent = names[join]!;
  columns.append(title);
}
main.append(columns);
for (const style of LUG_STYLES) {
  const section = document.createElement('section');
  section.dataset.style = style;
  const title = document.createElement('h2');
  title.textContent = names[style]!;
  const watches = document.createElement('div');
  watches.className = 'watches';
  section.append(title, watches);
  main.append(section);
  for (const join of LUG_JOINS) {
    const config = defaultConfig();
    Object.assign(config.case, proportionsForDiameter(diameter), {
      shape,
      profile,
      lugs: style,
      lugJoin: join,
    });
    config.dial.color = '#193C50';
    config.dial.shape = dial === 'case' ? shape : 'round';
    config.hands.second.style = 'none';
    const model = buildWatch(config, lib, { quality: 'fallback', printSize: 512 });
    await model.ready;
    model.setAngles(handAngles(POSTER_TIME, 0));
    scene.add(model.root);
    renderer.render(scene, camera);
    const figure = document.createElement('figure');
    figure.dataset.join = join;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    canvas.setAttribute('aria-label', `${names[style]}, ${names[join]}`);
    const caption = document.createElement('figcaption');
    caption.textContent = `${names[style]} · ${names[join]}`;
    figure.append(canvas, caption);
    watches.append(figure);
    scene.remove(model.root);
    model.dispose();
  }
}
lib.dispose();
environment.dispose();
renderer.dispose();
main.setAttribute('aria-busy', 'false');
document.querySelector('#status')!.textContent = '24 rendus prêts · 8 variantes × 3 raccords';

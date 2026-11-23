/**
 * Environnement de studio procédural pour les reflets. Un métal poli ne fait que refléter
 * ce qui l'entoure : un fond sombre et quelques boîtes à lumière donnent des reflets
 * contrastés et nets, comme en photographie de montre. Aucun fichier HDRI à télécharger.
 *
 * Repère : la montre regarde +Z (vers l'observateur), 12 h vers +Y.
 */
import * as THREE from 'three';

interface Softbox {
  size: [number, number];
  position: [number, number, number];
  intensity: number;
  color?: string;
}

const SOFTBOXES: Softbox[] = [
  // Grande boîte au-dessus, légèrement en avant : dessus de lunette, cornes.
  { size: [44, 16], position: [0, 34, 14], intensity: 4 },
  // Bande verticale à gauche (lumière principale) et liseré à droite : flancs.
  { size: [12, 40], position: [-34, 4, 16], intensity: 2.6 },
  { size: [8, 36], position: [34, -2, 8], intensity: 2.6 },
  // Liserés arrière, doux : les faces vues en rasant ne tombent pas dans le noir.
  { size: [6, 40], position: [26, 4, -30], intensity: 1.3 },
  { size: [6, 40], position: [-26, 4, -30], intensity: 1.1 },
  // Grand diffuseur de face, faible : aiguilles et index lisibles, cristal peu blanchi.
  { size: [46, 30], position: [0, 6, 40], intensity: 1.1 },
  // Lumière douce en haut, devant : dégradé sur le cristal.
  { size: [26, 6], position: [0, 22, 32], intensity: 2 },
  // Rebond du sol.
  { size: [50, 50], position: [0, -32, 4], intensity: 0.9, color: '#c4cad3' },
];

export function studioScene(): THREE.Scene {
  const scene = new THREE.Scene();

  // Fond : dégradé vertical sombre.
  const sky = new THREE.SphereGeometry(60, 32, 16);
  const colors: number[] = [];
  const top = new THREE.Color('#7d828b');
  const bottom = new THREE.Color('#25272c');
  const position = sky.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) / 60) * 0.5 + 0.5, 0, 1);
    c.copy(bottom).lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(
    new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })),
  );

  for (const box of SOFTBOXES) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(box.color ?? '#ffffff').multiplyScalar(box.intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...box.size), material);
    mesh.position.set(...box.position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  return scene;
}

/** Texture d'environnement préfiltrée, prête pour scene.environment. */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = studioScene();
  const texture = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  return texture;
}

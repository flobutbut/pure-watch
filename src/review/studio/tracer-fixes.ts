/**
 * Préparation de la scène pour three-gpu-pathtracer 0.0.28 avec Three.js r187 : trois défauts
 * ou incompatibilités du moteur, contournés sur la copie de la montre destinée au lancer de
 * rayons (documentation/studio-render/README.md).
 */
import * as THREE from 'three';

/**
 * Le studio procédural en panorama HDR (équirectangulaire, demi-flottants) : le lanceur de
 * rayons lit une carte d'environnement brute en mémoire, pour y tirer ses rayons vers les
 * boîtes à lumière, et non la version préfiltrée (PMREM) de la rastérisation.
 *
 * La conversion du cube fournie par le moteur inclut un morceau de shader retiré de Three.js
 * r187 (cube_uv_reflection_fragment) : on la refait ici, sans ce morceau, avec la même
 * convention de direction que le moteur (equirectUvToDirection).
 */
export function studioEquirect(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  width = 2048,
): THREE.DataTexture {
  const height = width / 2;
  const cube = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
  new THREE.CubeCamera(0.1, 200, cube).update(renderer, scene);
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });

  const flat = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType });
  const material = new THREE.ShaderMaterial({
    uniforms: { envMap: { value: cube.texture } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube envMap;
      varying vec2 vUv;
      void main() {
        float theta = (vUv.x - 0.5) * 2.0 * 3.14159265359;
        float phi = (1.0 - vUv.y) * 3.14159265359;
        vec3 direction = vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
        gl_FragColor = textureCube(envMap, direction);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  renderer.setRenderTarget(flat);
  renderer.render(quad, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(null);
  const pixels = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(flat, 0, 0, width, height, pixels);
  for (const disposable of [flat, cube, material, quad.geometry]) disposable.dispose();

  const half = new Uint16Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) half[i] = THREE.DataUtils.toHalfFloat(pixels[i]!);
  const texture = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Les trois adaptations de la montre, dans l'ordre. */
export function prepareForPathTracer(root: THREE.Object3D): void {
  thinGlass(root);
  singleMaterialGroups(root);
  rgbaVertexColors(root);
}

/**
 * Verre en paroi mince. Avec une épaisseur, le moteur suit le rayon dans le volume du verre,
 * et la coque du cristal le retient : il sort noir. En paroi mince, chaque face reflète et
 * laisse passer la lumière, sans décaler l'image : sur 1 à 2 mm de verre, cela ne se voit pas.
 */
function thinGlass(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of [object.material].flat())
      if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0)
        material.thickness = 0;
  });
}

/**
 * Une seule matière par maillage, sans groupes. Le moteur numérote les matières en aplatissant
 * les listes, mais les maillages un par un : une pièce à deux matières (lame d'aiguille et son
 * insert) décale toutes les pièces suivantes (le cuir passait sur le verre, la table sur la
 * couronne). Chaque groupe devient ici son propre maillage.
 */
function singleMaterialGroups(root: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.geometry.groups.length > 0) meshes.push(object);
  });
  for (const mesh of meshes) {
    if (!Array.isArray(mesh.material)) {
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.clearGroups();
      continue;
    }
    const source = mesh.geometry;
    const index = source.index;
    for (const group of source.groups) {
      const material = mesh.material[group.materialIndex ?? 0];
      if (!material) continue;
      const geometry = source.clone();
      geometry.clearGroups();
      const end = Math.min(group.start + group.count, index ? index.count : Infinity);
      const indices: number[] = [];
      for (let i = group.start; i < end; i++) indices.push(index ? index.getX(i) : i);
      geometry.setIndex(indices);
      const part = new THREE.Mesh(geometry, material);
      part.name = `${mesh.name}:${group.materialIndex}`;
      part.position.copy(mesh.position);
      part.quaternion.copy(mesh.quaternion);
      part.scale.copy(mesh.scale);
      mesh.parent!.add(part);
    }
    mesh.removeFromParent();
  }
}

/**
 * Couleurs de sommets en RGBA. L'occlusion précalculée des boîtiers est en RGB ; à la fusion,
 * le moteur ne recopie pas les couleurs à trois composantes quand d'autres pièces en ont
 * quatre (sa boucle de conversion écrit dans le mauvais sens) : boîtier et cornes sortaient
 * noirs. On ajoute l'alpha à 1, sur une copie.
 */
function rgbaVertexColors(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const color = object.geometry.getAttribute('color');
    if (!color || color.itemSize !== 3) return;
    const rgba = new Float32Array(color.count * 4);
    for (let i = 0; i < color.count; i++)
      rgba.set([color.getX(i), color.getY(i), color.getZ(i), 1], i * 4);
    object.geometry = object.geometry.clone();
    object.geometry.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  });
}

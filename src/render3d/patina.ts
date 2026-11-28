import * as THREE from 'three';

// A periodic noise volume shared by every alloy. Coordinates and grain sizes are in mm.
const CELLS = 16;
const SIZE = 64;
const SCALES = [0.21, 0.73, 2.05] as const;
const WEIGHTS = [0.38, 0.37, 0.25] as const;
const FILM = [0.34, 0.72] as const;
const DEPOSIT = [0.55, 0.8] as const;
const RECESS = 0.2;
const ROUGHNESS = [0.28, 0.73] as const;
const OXIDE_METALNESS = 0.44;
const lerp = THREE.MathUtils.lerp;
const smooth = (value: number) => value * value * (3 - 2 * value);
const linear = (value: number) => value;
const wrap = (value: number, size: number) => THREE.MathUtils.euclideanModulo(value, size);

const TONES: Record<string, [aged: string, oxide: string, strength: number]> = {
  bronze: ['#77513A', '#536F5F', 1],
  brass: ['#8D713D', '#615638', 0.83],
  steel: ['#9BA0A5', '#737980', 0.63],
  titanium: ['#797A80', '#575E66', 0.68],
  'gold-yellow': ['#AA8444', '#8F6B30', 0.52],
  'gold-rose': ['#AE785F', '#865C4C', 0.61],
};

// Interpolation within the periodic lattice, used to build the volume and sample it in studio.
function sample(
  data: Uint8Array,
  size: number,
  x: number,
  y: number,
  z: number,
  fade: (value: number) => number,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const tx = fade(x - ix);
  const ty = fade(y - iy);
  const tz = fade(z - iz);
  const left = wrap(ix, size);
  const right = wrap(ix + 1, size);
  const bottom = wrap(iy, size) * size;
  const top = wrap(iy + 1, size) * size;
  const near = wrap(iz, size) * size * size;
  const far = wrap(iz + 1, size) * size * size;
  const row = (offset: number) => lerp(data[offset + left]!, data[offset + right]!, tx);
  return lerp(
    lerp(row(near + bottom), row(near + top), ty),
    lerp(row(far + bottom), row(far + top), ty),
    tz,
  );
}

let volume: Uint8Array | undefined;
function noiseVolume(): Uint8Array {
  if (volume) return volume;
  const lattice = new Uint8Array(CELLS ** 3);
  let seed = 92813;
  for (let i = 0; i < lattice.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    lattice[i] = seed >>> 24;
  }
  volume = new Uint8Array(SIZE ** 3);
  const step = CELLS / SIZE;
  for (let z = 0; z < SIZE; z++)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        volume[(z * SIZE + y) * SIZE + x] = Math.round(
          sample(lattice, CELLS, x * step, y * step, z * step, smooth),
        );
  return volume;
}

export function patinaVolume(): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(noiseVolume(), SIZE, SIZE, SIZE);
  texture.format = THREE.RedFormat;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

interface Patina {
  base: THREE.Color;
  aged: THREE.Color;
  oxide: THREE.Color;
  strength: number;
  wear: number;
  occlusion: boolean;
}

const profiles = new WeakMap<THREE.MeshPhysicalMaterial, Patina>();
const OFFSET = [3.25, -5.5, 8.5] as const;

export function applyPatina(
  material: THREE.MeshPhysicalMaterial,
  volume: THREE.Data3DTexture,
  alloy: string,
  base: string,
  wear: number,
): THREE.MeshPhysicalMaterial {
  const [aged, oxide, strength] = TONES[alloy] ?? TONES.steel!;
  const profile = {
    base: new THREE.Color(base),
    aged: new THREE.Color(aged),
    oxide: new THREE.Color(oxide),
    strength,
    wear,
    occlusion: material.vertexColors,
  };
  profiles.set(material, profile);
  // The studio bake keeps the spatial color and uses average reflectance for each surface role.
  const meanFilm = THREE.MathUtils.smoothstep(0.5 - wear, ...FILM) * strength;
  material.color.set('#ffffff');
  material.roughness = lerp(...ROUGHNESS, meanFilm);
  material.metalness = lerp(1, OXIDE_METALNESS, meanFilm * 0.82);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.patinaVolume = { value: volume };
    shader.uniforms.patinaBase = { value: profile.base };
    shader.uniforms.patinaAged = { value: profile.aged };
    shader.uniforms.patinaOxide = { value: profile.oxide };
    shader.uniforms.patinaStrength = { value: strength };
    shader.uniforms.patinaWear = { value: wear };
    // Part-local coordinates keep the pattern fixed during rotation, including on trim and crowns.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPatinaPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatinaPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vPatinaPosition;
        uniform highp sampler3D patinaVolume;
        uniform vec3 patinaBase, patinaAged, patinaOxide;
        uniform float patinaStrength, patinaWear;

        float patinaNoise(vec3 point, float scale) {
          return texture(patinaVolume, point * (scale / ${CELLS}.0) + ${0.5 / SIZE}).r;
        }
      `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        vec3 patinaPoint = vPatinaPosition + vec3(${OFFSET.join(', ')});
        float patinaSignal =
          ${WEIGHTS[0]} * patinaNoise(patinaPoint, ${SCALES[0]}) +
          ${WEIGHTS[1]} * patinaNoise(patinaPoint, ${SCALES[1]}) +
          ${WEIGHTS[2]} * patinaNoise(patinaPoint, ${SCALES[2]}) - patinaWear;
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
          patinaSignal += (1.0 - vColor.r) * ${RECESS};
        #endif
        float patinaFilm = smoothstep(${FILM.join(', ')}, patinaSignal) * patinaStrength;
        float patinaDeposit = smoothstep(${DEPOSIT.join(', ')}, patinaSignal) * patinaStrength;
        float patinaGrain = patinaNoise(patinaPoint, 7.0);
        float patinaPit = smoothstep(0.58, 0.84, patinaGrain);
        diffuseColor.rgb = mix(mix(patinaBase, patinaAged, patinaFilm), patinaOxide, patinaDeposit);
        diffuseColor.rgb *= 1.0 - patinaPit * mix(0.05, 0.18, patinaFilm);
        #include <color_fragment>
      `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(${ROUGHNESS.join(', ')}, patinaFilm) + (patinaGrain - 0.5) * 0.09, 0.2, 0.82);
      `,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `
        #include <metalnessmap_fragment>
        metalnessFactor = mix(1.0, ${OXIDE_METALNESS}, max(patinaDeposit, patinaFilm * 0.82));
      `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        // Surface gradient in view space: no UV or tangent basis, even on chamfers.
        float patinaHeight = (patinaGrain - 0.5) * 0.009 - patinaPit * mix(0.004, 0.028, patinaFilm);
        vec3 dx = dFdx(-vViewPosition);
        vec3 dy = dFdy(-vViewPosition);
        vec3 rx = cross(dy, normal);
        vec3 ry = cross(normal, dx);
        float det = dot(dx, rx);
        normal = normalize(normal - (rx * dFdx(patinaHeight) + ry * dFdy(patinaHeight)) *
          (sign(det) / max(abs(det), 1e-6)));
      `,
      );
  };
  material.customProgramCacheKey = () => 'case-patina';
  return material;
}

/** The studio path tracer reads standard material inputs. Bake the same oxidation field into RGB. */
export function bakePatinaColors(mesh: THREE.Mesh): void {
  if (!(mesh.material instanceof THREE.MeshPhysicalMaterial)) return;
  const profile = profiles.get(mesh.material);
  if (!profile) return;
  const geometry = mesh.geometry.clone();
  const positions = geometry.getAttribute('position');
  const occlusion = profile.occlusion ? geometry.getAttribute('color') : undefined;
  const colors = new Float32Array(positions.count * 4);
  const field = noiseVolume();
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + OFFSET[0];
    const y = positions.getY(i) + OFFSET[1];
    const z = positions.getZ(i) + OFFSET[2];
    const light = occlusion?.getX(i) ?? 1;
    let signal = (1 - light) * RECESS - profile.wear;
    for (const [index, scale] of SCALES.entries()) {
      const step = (scale * SIZE) / CELLS;
      signal += (WEIGHTS[index]! * sample(field, SIZE, x * step, y * step, z * step, linear)) / 255;
    }
    const film = THREE.MathUtils.smoothstep(signal, ...FILM) * profile.strength;
    const deposit = THREE.MathUtils.smoothstep(signal, ...DEPOSIT) * profile.strength;
    color.copy(profile.base).lerp(profile.aged, film).lerp(profile.oxide, deposit);
    colors[i * 4] = color.r * light;
    colors[i * 4 + 1] = color.g * light;
    colors[i * 4 + 2] = color.b * light;
    colors[i * 4 + 3] = 1;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  mesh.geometry = geometry;
  mesh.material.vertexColors = true;
}

/** Deterministic, periodic height fields in an eight-millimetre physical tile. */
import * as THREE from 'three';
const SIZE = 256;
const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const smooth = (x: number) => x * x * (3 - 2 * x);
function noise(x: number, y: number, period: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(fract(x)),
    fy = smooth(fract(y));
  const h = (dx: number, dy: number) =>
    hash((((ix + dx) % period) + period) % period, (((iy + dy) % period) + period) % period);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(h(0, 0), h(1, 0), fx),
    THREE.MathUtils.lerp(h(0, 1), h(1, 1), fx),
    fy,
  );
}
function cells(u: number, v: number): number {
  const x = u * 15,
    y = v * 15,
    ix = Math.floor(x),
    iy = Math.floor(y);
  let first = 10,
    second = 10;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = ix + dx,
        yy = iy + dy;
      const hx = (xx + 15) % 15,
        hy = (yy + 15) % 15;
      const d = Math.hypot(
        xx + 0.2 + hash(hx, hy) * 0.6 - x,
        yy + 0.2 + hash(hx + 73, hy + 29) * 0.6 - y,
      );
      if (d < first) {
        second = first;
        first = d;
      } else second = Math.min(second, d);
    }
  // Rounded islands separated by the fine valleys characteristic of calf grain.
  return smooth(Math.min(1, (second - first) * 6));
}
export function strapTextureMaps(
  type: string,
  style: string,
): { normal: THREE.DataTexture; roughness: THREE.DataTexture; color: THREE.DataTexture } {
  const heights = new Float32Array(SIZE * SIZE);
  const rough = new Uint8Array(SIZE * SIZE * 4);
  const colors = new Uint8Array(SIZE * SIZE * 4);
  const cloth = type === 'fabric',
    leather = type === 'leather',
    metal = type === 'metal';
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE,
        v = y / SIZE;
      const fine = noise(u * 96, v * 96, 96);
      let height: number, roughness: number;
      let tone = 1;
      if (cloth) {
        const a = fract(u * 24),
          b = fract(v * 24);
        const warp = Math.pow(Math.sin(a * Math.PI), 0.6),
          weft = Math.pow(Math.sin(b * Math.PI), 0.6);
        const over = (Math.floor(u * 24) + Math.floor(v * 24)) % 2 === 0;
        height =
          (over ? warp * (0.55 + weft * 0.15) : weft * (0.55 + warp * 0.15)) * 0.085 + fine * 0.012;
        tone = 0.66 + 0.3 * (over ? warp : weft) + fine * 0.04;
        if (style === 'ribbed') {
          const rib = Math.pow((1 + Math.cos(v * TAU * 6)) / 2, 3);
          height += rib * 0.08;
          tone *= 0.85 + 0.15 * rib;
        }
        roughness = 0.76 + fine * 0.2;
      } else if (leather) {
        const grain = cells(u, v);
        height =
          style === 'grained'
            ? grain * 0.055 + fine * 0.009
            : noise(u * 18, v * 18, 18) * 0.012 + fine * 0.006;
        tone = style === 'grained' ? 0.88 + 0.1 * grain + fine * 0.02 : 0.96 + fine * 0.04;
        roughness = (style === 'grained' ? 0.6 : 0.45) + fine * 0.18 + (1 - grain) * 0.06;
      } else if (metal) {
        height = noise(u * 128, v * 128, 128) * 0.0005 + Math.sin(u * TAU * 118) * 0.0008;
        roughness = 0.48 + fine * 0.15;
      } else {
        height = fine * 0.006 + noise(u * 24, v * 24, 24) * 0.004;
        roughness = 0.72 + fine * 0.1;
      }
      heights[y * SIZE + x] = height;
      const index = (y * SIZE + x) * 4,
        value = Math.round(roughness * 255);
      const pigment = Math.round(tone * 255);
      colors[index] = colors[index + 1] = colors[index + 2] = pigment;
      colors[index + 3] = 255;
      rough[index] = rough[index + 1] = rough[index + 2] = value;
      rough[index + 3] = 255;
    }
  const normals = new Uint8Array(SIZE * SIZE * 4);
  const at = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) / (16 / SIZE),
        dy = (at(x, y + 1) - at(x, y - 1)) / (16 / SIZE);
      const n = new THREE.Vector3(-dx, -dy, 1).normalize(),
        i = (y * SIZE + x) * 4;
      normals[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      normals[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      normals[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      normals[i + 3] = 255;
    }
  const texture = (data: Uint8Array) => {
    const map = new THREE.DataTexture(data, SIZE, SIZE);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  };
  const color = texture(colors);
  color.colorSpace = THREE.SRGBColorSpace;
  return { normal: texture(normals), roughness: texture(rough), color };
}

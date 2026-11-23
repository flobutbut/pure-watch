/** Textures générées dans le navigateur : aucun fichier à télécharger. */
import * as THREE from 'three';
import { shapeRadius } from '../core/geometry/case-shape';
import { contourExtents } from '../core/geometry/dial-shape';
import { dialPatternData, type DialPatternFinish } from './dial-patterns';

/** Shared, colourless relief maps. UVs already describe a physical XY square. */
export function dialPatternTextures(finish: DialPatternFinish, spanMm: number, size = 512) {
  const pixels = dialPatternData(finish, spanMm, size);
  const texture = (data: Uint8Array) => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.flipY = true;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.anisotropy = 8;
    map.needsUpdate = true;
    return map;
  };
  return { normal: texture(pixels.normal), roughness: texture(pixels.roughness) };
}

function canvas2d(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  return [canvas, ctx];
}

/**
 * Motif de volutes en niveaux de gris (déformation de domaine), pour piloter l'épaisseur
 * de la couche iridescente : nacre (fin) ou film d'huile (larges volutes).
 */
export function swirlTexture(scale: number, seed: number, size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let x = (i / size - 0.5) * scale;
      let y = (j / size - 0.5) * scale;
      for (let k = 0; k < 4; k++) {
        const f = 1 + k * 0.7;
        x += (0.55 / f) * Math.sin(f * 1.7 * y + seed * (k + 1) * 1.3);
        y += (0.55 / f) * Math.cos(f * 1.3 * x + seed * (k + 2) * 0.7);
      }
      const v = 0.5 + 0.5 * Math.sin(x * 1.1 + y * 0.9 + seed);
      const o = (j * size + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Carte d'anisotropie radiale (cadran soleillé) : rouge et vert = direction du brossage
 * dans le repère de texture, bleu = intensité. Les reflets s'étirent en rayons.
 */
export function radialAnisotropyTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = i / size - 0.5;
      const y = 0.5 - j / size; // v vers le haut
      const len = Math.hypot(x, y) || 1;
      // Direction tangentielle : les stries sont radiales, le reflet s'étire en travers.
      const dx = -y / len;
      const dy = x / len;
      const o = (j * size + i) * 4;
      data[o] = Math.round((dx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((dy * 0.5 + 0.5) * 255);
      data[o + 2] = 255;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

/** Bruit de valeur raccordable : grains de `cell` pixels, interpolés en douceur. */
function grainField(size: number, cell: number, seed: number): Float32Array {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const n = Math.round(size / cell);
  const lattice = new Float32Array(n * n).map(() => random());
  const at = (i: number, j: number) => lattice[((j + n) % n) * n + ((i + n) % n)]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * n;
      const gy = (y / size) * n;
      const i = Math.floor(gx);
      const j = Math.floor(gy);
      const u = smooth(gx - i);
      const v = smooth(gy - j);
      const top = at(i, j) * (1 - u) + at(i + 1, j) * u;
      const bottom = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u;
      field[y * size + x] = top * (1 - v) + bottom * v;
    }
  }
  return field;
}

function fieldTexture(
  size: number,
  fill: (data: Uint8ClampedArray, field: Float32Array) => void,
  field: Float32Array,
  repeat: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const image = ctx.createImageData(size, size);
  fill(image.data, field);
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

/**
 * Cadran grainé : relief de grains visibles à l'écran (carte de normales) et grains
 * plus ou moins polis (carte de rugosité) qui scintillent selon l'angle. Les grains font
 * plusieurs pixels : réduits à l'écran, ils ne se fondent pas en surface lisse.
 */
export function grainTextures(
  size = 512,
  repeat = 3,
): {
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const relief = grainField(size, 5, 11);
  const fine = grainField(size, 2, 29);
  const height = relief.map((v, i) => v * 0.75 + fine[i]! * 0.25);
  const strength = 3.2;
  const normal = fieldTexture(
    size,
    (data, h) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const l = h[y * size + ((x - 1 + size) % size)]!;
          const r = h[y * size + ((x + 1) % size)]!;
          const u = h[((y - 1 + size) % size) * size + x]!;
          const d = h[((y + 1) % size) * size + x]!;
          const n = new THREE.Vector3((l - r) * strength, (d - u) * strength, 1).normalize();
          const o = (y * size + x) * 4;
          data[o] = Math.round((n.x * 0.5 + 0.5) * 255);
          data[o + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
          data[o + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
          data[o + 3] = 255;
        }
      }
    },
    height,
    repeat,
  );
  // Rugosité (canal vert) : quelques grains très polis au milieu d'un fond satiné.
  const sparkle = grainField(size, 3, 47);
  const roughness = fieldTexture(
    size,
    (data, f) => {
      for (let i = 0; i < size * size; i++) {
        const v = f[i]!;
        const glint = v > 0.78 ? 0.12 : 0.55 + (0.78 - v) * 0.3;
        const g = Math.round(Math.min(1, glint) * 255);
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = g;
        data[i * 4 + 3] = 255;
      }
    },
    sparkle,
    repeat,
  );
  return { normal, roughness };
}

/** Dégradé radial de couleur (cadran fumé : centre clair, bord sombre). */
export function radialGradientTexture(
  center: string,
  edge: string,
  size = 512,
  shape = 'round',
): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, center);
  g.addColorStop(0.55, center);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return shape === 'round' ? texture : contourGradient(texture, shape);
}

/** Occlusion radiale : clair au centre, assombri sur le dernier anneau (ombre du rehaut). */
export function radialOcclusionTexture(size = 512, shape = 'round'): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.9, '#ffffff');
  g.addColorStop(0.97, '#b8b8b8');
  g.addColorStop(1, '#8c8c8c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  return shape === 'round' ? texture : contourGradient(texture, shape);
}

/** Carbone forgé : éclats de fibres sombres orientés au hasard, sous vernis. */
export function forgedCarbonTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  ctx.fillStyle = '#121315';
  ctx.fillRect(0, 0, size, size);
  let state = 91;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = 10 + random() * 46;
    const h = 4 + random() * 18;
    const shade = Math.round(16 + random() * 92);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI);
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 3},${0.55 + random() * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h * (0.2 + random() * 0.4));
    ctx.lineTo(w / 2 - random() * 6, h / 2);
    ctx.lineTo(-w / 2 + random() * 6, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/** Patine : métal d'origine et teinte vieillie mêlés en taches irrégulières. */
export function patinaTexture(base: string, tint: string, size = 512): THREE.CanvasTexture {
  const field = swirlTexture(5, 2.3, size);
  const source = field.image as HTMLCanvasElement;
  const data = source.getContext('2d')!.getImageData(0, 0, size, size).data;
  field.dispose();
  const [canvas, ctx] = canvas2d(size);
  const out = ctx.createImageData(size, size);
  // Mélange directement en sRGB (les valeurs écrites dans la texture sont sRGB).
  const rgb = (hex: string) => {
    const n = Number.parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = rgb(base);
  const b = rgb(tint);
  for (let i = 0; i < size * size; i++) {
    const v = data[i * 4]! / 255;
    const t = Math.min(1, Math.max(0, (v - 0.35) * 1.6)) * 0.85;
    for (let k = 0; k < 3; k++) out.data[i * 4 + k] = Math.round(a[k]! + (b[k]! - a[k]!) * t);
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/** Ombre portée douce et diffuse : dégradé radial du noir vers le transparent. */
export function softShadowTexture(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Texture issue d'un balisage SVG (impression du cadran, échelles de lunette…).
 * Renvoie la texture tout de suite et une promesse résolue quand l'image est dessinée :
 * un instantané de cellule doit l'attendre.
 */
export function svgTexture(
  markup: string | Promise<string>,
  size = 2048,
): { texture: THREE.CanvasTexture; ready: Promise<void> } {
  const [canvas, ctx] = canvas2d(size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const image = new Image();
  const ready = new Promise<void>((resolve, reject) => {
    image.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
      texture.needsUpdate = true;
      resolve();
    };
    image.onerror = () => reject(new Error('SVG illisible'));
  });
  const loaded = Promise.resolve(markup).then((svg) => {
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return ready;
  });
  return { texture, ready: loaded };
}

/** Reparameterize broad gradients around the real edge, without stretching dial UVs. */
function contourGradient(source: THREE.CanvasTexture, shape: string): THREE.CanvasTexture {
  const image = source.image as HTMLCanvasElement;
  const size = image.width;
  const data = image.getContext('2d')!.getImageData(0, 0, size, size).data;
  const [canvas, ctx] = canvas2d(size);
  const output = ctx.createImageData(size, size);
  const extent = contourExtents(shape).max * 1.002;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = ((x / (size - 1)) * 2 - 1) * extent;
      const py = ((y / (size - 1)) * 2 - 1) * extent;
      const r = Math.hypot(px, py) / shapeRadius(shape, Math.atan2(py, px));
      const sample = Math.min(size - 1, Math.round(size / 2 + (r * size) / 2));
      const src = (Math.floor(size / 2) * size + sample) * 4;
      const dst = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) output.data[dst + c] = data[src + c]!;
    }
  ctx.putImageData(output, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  source.dispose();
  return texture;
}

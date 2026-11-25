/** Deterministic surface relief in physical millimetres, independent of colour and outline. */
export const DIAL_PATTERN_FINISHES = [
  'guilloche',
  'clous-de-paris',
  'linen',
  'concentric',
  'vertical-brushed',
  'hammered',
  'leather',
  'circular-brushed',
  'tapisserie',
  'waves',
  'scales',
  'topographic',
] as const;
export type DialPatternFinish = (typeof DIAL_PATTERN_FINISHES)[number];
export const DIAL_PATTERN_SETTINGS: Record<
  DialPatternFinish,
  { heightMm: number; roughness: [number, number]; metalness: number }
> = {
  guilloche: { heightMm: 0.026, roughness: [0.23, 0.42], metalness: 0.72 },
  'clous-de-paris': { heightMm: 0.085, roughness: [0.25, 0.45], metalness: 0.7 },
  linen: { heightMm: 0.028, roughness: [0.6, 0.84], metalness: 0.18 },
  concentric: { heightMm: 0.018, roughness: [0.26, 0.42], metalness: 0.78 },
  'vertical-brushed': { heightMm: 0.012, roughness: [0.3, 0.48], metalness: 0.76 },
  hammered: { heightMm: 0.13, roughness: [0.24, 0.48], metalness: 0.72 },
  leather: { heightMm: 0.11, roughness: [0.72, 0.94], metalness: 0 },
  'circular-brushed': { heightMm: 0.009, roughness: [0.34, 0.56], metalness: 0.72 },
  tapisserie: { heightMm: 0.075, roughness: [0.28, 0.5], metalness: 0.64 },
  waves: { heightMm: 0.045, roughness: [0.27, 0.49], metalness: 0.66 },
  scales: { heightMm: 0.045, roughness: [0.3, 0.52], metalness: 0.64 },
  topographic: { heightMm: 0.024, roughness: [0.55, 0.78], metalness: 0.3 },
};
export function isDialPatternFinish(finish: string): finish is DialPatternFinish {
  return DIAL_PATTERN_FINISHES.some((value) => value === finish);
}

const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const smooth = (lo: number, hi: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
function noise(x: number, y: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function dialPatternHeight(finish: DialPatternFinish, x: number, y: number): number {
  const r = Math.hypot(x, y);
  switch (finish) {
    case 'topographic': {
      // Generic, deterministic terrain contours; this does not represent a real mountain.
      const terrain =
        0.8 * Math.exp(-((x + 3.5) ** 2 + (y - 2) ** 2) / 42) +
        0.65 * Math.exp(-((x - 5) ** 2 + (y + 4) ** 2) / 29) +
        0.13 * Math.sin(x * 0.23 + Math.sin(y * 0.21)) +
        0.09 * Math.cos(y * 0.27 - Math.sin(x * 0.16));
      const band = Math.abs(fract(terrain * 12) - 0.5);
      return 0.9 - 0.7 * Math.exp(-((band / 0.055) ** 2));
    }
    case 'guilloche': {
      const center = Math.min(1, r / 0.8);
      return (
        0.5 +
        0.5 *
          Math.cos(
            (TAU * r) / 0.95 + 1.7 * center * center * Math.sin(28 * Math.atan2(y, x) + 0.4 * r),
          )
      );
    }
    case 'clous-de-paris':
      return Math.min(
        0.94,
        1 - Math.max(Math.abs(fract(x / 0.95) - 0.5), Math.abs(fract(y / 0.95) - 0.5)) * 2,
      );
    case 'linen':
      return (
        0.5 +
        0.22 * Math.sin((TAU * x) / 0.64) +
        0.18 * Math.sin((TAU * y) / 0.82) +
        0.07 * Math.sin((TAU * (x + y)) / 0.25)
      );
    case 'concentric':
      return 0.5 + 0.5 * Math.cos((TAU * r) / 0.48);
    case 'vertical-brushed':
      return (
        0.5 +
        0.26 * Math.sin((TAU * x) / 0.35 + 0.1 * Math.sin(y * 1.3)) +
        0.14 * Math.sin((TAU * x) / 0.56 + 0.9) +
        0.08 * Math.sin((TAU * x) / 0.24 + 1.7)
      );
    case 'hammered': {
      const pitch = 1.55;
      const cx = Math.floor(x / pitch),
        cy = Math.floor(y / pitch);
      let dent = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = cx + dx,
            j = cy + dy;
          const px = (i + 0.18 + noise(i, j) * 0.64) * pitch;
          const py = (j + 0.18 + noise(j + 71, i - 19) * 0.64) * pitch;
          const sigma = 0.42 + noise(i + 13, j + 37) * 0.16;
          dent = Math.max(
            dent,
            Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * sigma * sigma)) *
              (0.75 + 0.25 * noise(i - 8, j + 24)),
          );
        }
      return 1 - dent;
    }
    case 'leather': {
      const pitch = 0.95;
      const cx = Math.floor(x / pitch),
        cy = Math.floor(y / pitch);
      let first = Infinity,
        second = Infinity;
      for (let j = cy - 1; j <= cy + 1; j++)
        for (let i = cx - 1; i <= cx + 1; i++) {
          const px = (i + 0.18 + 0.64 * noise(i, j)) * pitch;
          const py = (j + 0.18 + 0.64 * noise(j + 47, i - 11)) * pitch;
          const distance = (x - px) ** 2 + (y - py) ** 2;
          if (distance < first) {
            second = first;
            first = distance;
          } else if (distance < second) second = distance;
        }
      const edge = Math.sqrt(second) - Math.sqrt(first);
      const pores = 0.025 * Math.sin(x * 51 + Math.sin(y * 23)) * Math.sin(y * 47);
      return 0.12 + 0.84 * smooth(0.015, 0.22, edge) + pores;
    }
    case 'circular-brushed':
      return (
        0.5 +
        0.23 * Math.sin((TAU * r) / 0.22 + 0.25 * Math.sin(x * 2 + y)) +
        0.15 * Math.sin((TAU * r) / 0.37 + 0.3 * Math.sin(y * 1.7)) +
        0.08 * Math.sin((TAU * r) / 0.53)
      );
    case 'tapisserie': {
      const u = fract(x / 1.15),
        v = fract(y / 1.15);
      const edge = Math.min(u, 1 - u, v, 1 - v) * 1.15;
      const top = smooth(0.035, 0.17, edge);
      return 0.08 + top * (0.88 + 0.025 * Math.sin((TAU * x) / 0.16) * Math.sin((TAU * y) / 0.16));
    }
    case 'waves':
      return 0.5 + 0.5 * Math.cos((TAU * (y + 0.42 * Math.sin((TAU * x) / 4.2))) / 0.95);
    case 'scales': {
      const row = Math.floor(y / 1.2);
      const offset = (row % 2) * 1.2;
      const dx = x - offset - Math.round((x - offset) / 2.4) * 2.4;
      const dy = y - row * 1.2;
      const edge = Math.abs(Math.hypot(dx, dy) - 1.2);
      return 0.95 - 0.88 * Math.exp(-((edge / 0.095) ** 2));
    }
  }
}

export interface DialPatternData {
  normal: Uint8Array;
  roughness: Uint8Array;
  size: number;
}
// Colour drags create temporary material libraries. Share CPU pixels, never mutable GPU textures.
// Twelve 512px pairs occupy at most 24 MiB; evicted data is released when unused.
const cache = new Map<string, DialPatternData>();
export function dialPatternData(
  finish: DialPatternFinish,
  spanMm: number,
  size = 512,
): DialPatternData {
  if (!Number.isFinite(spanMm) || spanMm <= 0 || !Number.isInteger(size) || size < 4 || size > 1024)
    throw new RangeError('Dimensions de texture invalides');
  const key = `${finish}:${spanMm.toFixed(3)}:${size}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const settings = DIAL_PATTERN_SETTINGS[finish];
  const h = new Float32Array(size * size);
  const step = spanMm / (size - 1);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      h[y * size + x] = dialPatternHeight(
        finish,
        (x / (size - 1) - 0.5) * spanMm,
        (0.5 - y / (size - 1)) * spanMm,
      );
  const normal = new Uint8Array(size * size * 4),
    roughness = new Uint8Array(normal.length);
  const at = (x: number, y: number) =>
    h[Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))]!;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = ((at(x - 1, y) - at(x + 1, y)) * settings.heightMm) / (2 * step);
      const ny = ((at(x, y + 1) - at(x, y - 1)) * settings.heightMm) / (2 * step);
      const length = Math.hypot(nx, ny, 1),
        index = (y * size + x) * 4;
      normal[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      normal[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      normal[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normal[index + 3] = 255;
      const value = Math.round(
        (settings.roughness[0] + (settings.roughness[1] - settings.roughness[0]) * (1 - at(x, y))) *
          255,
      );
      roughness[index] = roughness[index + 1] = roughness[index + 2] = value;
      roughness[index + 3] = 255;
    }
  const result = { normal, roughness, size };
  cache.set(key, result);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return result;
}

import { effectiveDialColor } from '../core/config/dial';

/**
 * Ambiance de l'interface déduite du cadran choisi : couleur dominante et effet de matière
 * (iridescence, soleillé, mat). Le fond prolonge le cadran ; les pièces flottent dessus
 * comme elles flotteraient au-dessus du cadran lui-même.
 */

export type Tone = 'dark' | 'light';

export interface Ambience {
  /** Change quand le fond doit être redessiné (fondu enchaîné). */
  key: string;
  /** Couleur de fond unie, sous les dégradés. */
  base: string;
  /** Couches CSS `background-image` posées sur la base. */
  layers: string;
  tone: Tone;
  /** Encre de l'interface (icônes, anneau de focus), lisible sur le fond. */
  ink: string;
  /** Teinte du voile de mise au point (vue 3D). */
  veil: string;
  /** Dérive lente des couches (effets changeants : iridescence). */
  drift: boolean;
}

export const NIGHT_AMBIENCE: Ambience = {
  key: 'night-preview',
  base: '#080D14',
  layers: 'none',
  tone: 'dark',
  ink: '#F2F1EC',
  veil: '#080D14',
  drift: false,
};

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance relative approchée, de 0 (noir) à 1 (blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Mélange deux couleurs : t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Tache de couleur douce : ellipse qui s'estompe vers le transparent. */
const glow = (x: number, y: number, w: number, h: number, color: string, alpha: number) =>
  `radial-gradient(${w}% ${h}% at ${x}% ${y}%, ${rgba(color, alpha)}, transparent 72%)`;

export function ambienceFor(dialConfig: { finish: string; color: string }): Ambience {
  // Nacre et huile ont leur propre teinte : la couleur choisie ne s'y applique pas.
  const dial = { finish: dialConfig.finish, color: effectiveDialColor(dialConfig) };
  const tone: Tone = luminance(dial.color) < 0.45 ? 'dark' : 'light';
  // Le fond reprend la couleur du cadran, adoucie : un peu éclaircie s'il est sombre,
  // un peu rapprochée du gris chaud de la maquette s'il est clair.
  const base =
    tone === 'dark' ? mix(dial.color, '#ffffff', 0.05) : mix(dial.color, '#e5e5e3', 0.35);
  const ink = tone === 'dark' ? '#F2F1EC' : '#1B1F27';
  const common = { base, tone, ink, veil: base };

  switch (dial.finish) {
    case 'guilloche':
    case 'clous-de-paris':
    case 'linen':
    case 'concentric':
    case 'vertical-brushed':
    case 'hammered': {
      const line = rgba(tone === 'dark' ? '#ffffff' : '#000000', 0.025);
      const patterns: Record<string, string> = {
        guilloche: `repeating-radial-gradient(ellipse at 50% 46%, transparent 0px 8px, ${line} 9px 10px, transparent 11px 14px)`,
        'clous-de-paris': `repeating-linear-gradient(45deg, ${line} 0px 1px, transparent 1px 10px), repeating-linear-gradient(-45deg, ${line} 0px 1px, transparent 1px 10px)`,
        linen: `repeating-linear-gradient(0deg, ${line} 0px 1px, transparent 1px 5px), repeating-linear-gradient(90deg, ${line} 0px 1px, transparent 1px 7px)`,
        concentric: `repeating-radial-gradient(circle at 50% 46%, transparent 0px 14px, ${line} 15px 16px)`,
        'vertical-brushed': `repeating-linear-gradient(90deg, ${line} 0px 1px, transparent 1px 4px)`,
        hammered: [
          glow(25, 35, 24, 28, '#ffffff', 0.035),
          glow(72, 62, 30, 24, '#ffffff', 0.04),
          glow(58, 20, 20, 24, '#000000', 0.05),
        ].join(', '),
      };
      return {
        ...common,
        key: `${dial.finish}:${dial.color}`,
        drift: false,
        layers: `${patterns[dial.finish]}, radial-gradient(70% 70% at 50% 45%, ${mix(base, '#ffffff', tone === 'dark' ? 0.1 : 0.2)}, transparent 75%)`,
      };
    }
    case 'iridescent-oil':
      // Film d'huile : violets, sarcelles, verts et ambres qui se fondent sur fond sombre.
      return {
        ...common,
        key: `oil:${dial.color}`,
        drift: true,
        layers: [
          glow(18, 22, 55, 48, '#7a3cc8', 0.38),
          glow(82, 28, 50, 58, '#1ea094', 0.32),
          glow(62, 86, 60, 46, '#c87828', 0.24),
          glow(30, 72, 42, 40, '#3caa5a', 0.26),
          glow(55, 45, 70, 70, '#2f6bd8', 0.14),
        ].join(', '),
      };
    case 'iridescent-pearl':
      // Nacre : pastels menthe, rose et lilas sur une base crème.
      return {
        ...common,
        key: `pearl:${dial.color}`,
        drift: true,
        layers: [
          glow(20, 25, 55, 50, '#a0e6d2', 0.5),
          glow(80, 30, 50, 55, '#fabec8', 0.45),
          glow(55, 85, 60, 45, '#c8befa', 0.42),
          glow(35, 65, 40, 40, '#f5f0b4', 0.35),
        ].join(', '),
      };
    case 'sunburst':
      // Soleillé : lumière concentrée au centre, rayons très discrets.
      return {
        ...common,
        key: `sunburst:${dial.color}`,
        drift: false,
        layers: [
          `radial-gradient(circle at 50% 46%, ${mix(base, '#ffffff', 0.18)}, transparent 62%)`,
          `repeating-conic-gradient(from 0deg at 50% 46%, ${rgba('#ffffff', 0.014)} 0deg 2deg, transparent 2deg 4deg)`,
        ].join(', '),
      };
    case 'fume':
      // Fumé : lumière au centre, bords qui plongent dans l'ombre.
      return {
        ...common,
        key: `fume:${dial.color}`,
        drift: false,
        layers: [
          `radial-gradient(60% 60% at 50% 45%, ${mix(base, '#ffffff', 0.14)}, transparent 70%)`,
          `radial-gradient(120% 120% at 50% 45%, transparent 45%, ${rgba('#000000', 0.55)} 100%)`,
        ].join(', '),
      };
    case 'lacquer':
      // Laqué : reflet net et brillant, comme sous un vernis.
      return {
        ...common,
        key: `lacquer:${dial.color}`,
        drift: false,
        layers: [
          `linear-gradient(160deg, ${rgba('#ffffff', tone === 'dark' ? 0.08 : 0.3)} 0%, transparent 38%)`,
          `radial-gradient(70% 70% at 50% 45%, ${mix(base, '#ffffff', 0.08)}, transparent 75%)`,
        ].join(', '),
      };
    case 'grained': {
      // Grainé : fin bruit de matière sur le fond, en plus du halo.
      const noise = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${tone === 'dark' ? 1 : 0} 0 0 0 0 ${tone === 'dark' ? 1 : 0} 0 0 0 0 ${tone === 'dark' ? 1 : 0} 0 0 0 ${tone === 'dark' ? 0.09 : 0.12} 0"/></filter><rect width="100%" height="100%" filter="url(%23g)"/></svg>`,
      ).replace(/%2523/g, '%23');
      return {
        ...common,
        key: `grained:${dial.color}`,
        drift: false,
        layers: [
          `url("data:image/svg+xml,${noise}")`,
          `radial-gradient(70% 70% at 50% 45%, ${mix(base, '#ffffff', tone === 'dark' ? 0.09 : 0.25)}, transparent 75%)`,
        ].join(', '),
      };
    }
    default:
      // Mat : simple halo, la matière ne renvoie presque pas de lumière.
      return {
        ...common,
        key: `matte:${dial.color}`,
        drift: false,
        layers: `radial-gradient(70% 70% at 50% 45%, ${mix(base, '#ffffff', tone === 'dark' ? 0.07 : 0.25)}, transparent 75%)`,
      };
  }
}

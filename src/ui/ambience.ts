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
  /** Encre adoucie des textes secondaires : la plus discrète qui reste lisible (≥ 4,5:1). */
  inkSoft: string;
  /** Encre effacée des repères (langue inactive) : jamais sous 3:1. */
  inkFaint: string;
  /** Teinte du voile de mise au point (vue 3D). */
  veil: string;
  /** Dérive lente des couches (effets changeants : iridescence). */
  drift: boolean;
}

const DARK_INK = '#F2F1EC';
const LIGHT_INK = '#1B1F27';
/** WCAG contrast for body text; muted marks settle for the large-text / UI threshold. */
const READABLE = 4.5;
const DISCERNIBLE = 3;

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

/** Rapport de contraste WCAG 2 entre deux couleurs, de 1 à 21. */
export function contrast(a: string, b: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const relative = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [x, y] = [relative(a), relative(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Mélange deux couleurs : t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The ink faded toward the background as far as `fade`, but never below `floor`. */
function softened(ink: string, base: string, fade: number, floor: number): string {
  for (let t = fade; t > 0; t -= 0.02) {
    const soft = mix(ink, base, t);
    if (contrast(soft, base) >= floor) return soft;
  }
  return ink;
}

/** Inks of a background: full, soft (secondary text), faint (inactive marks). */
function inks(ink: string, base: string) {
  return {
    ink,
    inkSoft: softened(ink, base, 0.4, READABLE),
    inkFaint: softened(ink, base, 0.62, DISCERNIBLE),
  };
}

export const NIGHT_AMBIENCE: Ambience = {
  key: 'night-preview',
  base: '#080D14',
  layers: 'none',
  tone: 'dark',
  ...inks(DARK_INK, '#080D14'),
  veil: '#080D14',
  drift: false,
};

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
  // Le fond reprend la couleur du cadran, adoucie : un peu éclaircie s'il est sombre,
  // un peu rapprochée du gris chaud de la maquette s'il est clair.
  const bases: Record<Tone, string> = {
    dark: mix(dial.color, '#ffffff', 0.05),
    light: mix(dial.color, '#e5e5e3', 0.35),
  };
  const INK: Record<Tone, string> = { dark: DARK_INK, light: LIGHT_INK };
  // La clarté perçue choisit le ton ; un cadran saturé (orange, rouge, magenta) peut la
  // tromper : si l'encre retenue lit mal sur son fond, l'autre ton l'emporte.
  let tone: Tone = luminance(dial.color) < 0.45 ? 'dark' : 'light';
  const other: Tone = tone === 'dark' ? 'light' : 'dark';
  const reading = (t: Tone) => contrast(INK[t], bases[t]);
  if (reading(tone) < READABLE && reading(other) > reading(tone)) tone = other;
  // Rare vivid picks read poorly with either ink: the background then steps away from the
  // ink (darker or lighter) just enough to reach the reading threshold.
  let base = bases[tone];
  const away = tone === 'dark' ? '#000000' : '#ffffff';
  for (let t = 0.05; contrast(INK[tone], base) < READABLE && t <= 0.5; t += 0.05)
    base = mix(bases[tone], away, t);
  const common = { base, tone, ...inks(INK[tone], base), veil: base };

  switch (dial.finish) {
    case 'guilloche':
    case 'guilloche-woven-3':
    case 'guilloche-chevron':
    case 'guilloche-spiral-diamonds':
    case 'guilloche-honeycomb':
    case 'guilloche-rice':
    case 'guilloche-fans':
    case 'perlage':
    case 'clous-de-paris':
    case 'linen':
    case 'concentric':
    case 'vertical-brushed':
    case 'leather':
    case 'circular-brushed':
    case 'tapisserie':
    case 'waves':
    case 'scales':
    case 'topographic':
    case 'hammered': {
      const line = rgba(tone === 'dark' ? '#ffffff' : '#000000', 0.025);
      const patterns: Record<string, string> = {
        guilloche: `repeating-radial-gradient(ellipse at 50% 46%, transparent 0px 8px, ${line} 9px 10px, transparent 11px 14px)`,
        'guilloche-woven-3': `repeating-linear-gradient(45deg, ${line} 0px 1px, transparent 1px 4px, ${line} 4px 5px, transparent 5px 8px, ${line} 8px 9px, transparent 9px 16px), repeating-linear-gradient(-45deg, ${line} 0px 1px, transparent 1px 16px)`,
        'guilloche-chevron': `repeating-linear-gradient(45deg, ${line} 0px 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, ${line} 0px 1px, transparent 1px 12px)`,
        'guilloche-spiral-diamonds': `repeating-conic-gradient(from 0deg at 50% 46%, ${line} 0deg 0.6deg, transparent 0.6deg 7.5deg), repeating-radial-gradient(circle at 50% 46%, ${line} 0px 1px, transparent 1px 10px)`,
        'guilloche-honeycomb': `repeating-linear-gradient(60deg, ${line} 0px 1px, transparent 1px 18px), repeating-linear-gradient(-60deg, ${line} 0px 1px, transparent 1px 18px), repeating-linear-gradient(0deg, ${line} 0px 1px, transparent 1px 18px)`,
        'guilloche-rice': `repeating-linear-gradient(30deg, ${line} 0px 2px, transparent 2px 8px), repeating-linear-gradient(-30deg, ${line} 0px 1px, transparent 1px 14px)`,
        'guilloche-fans': `repeating-radial-gradient(ellipse at 50% 100%, ${line} 0px 1px, transparent 1px 10px)`,
        perlage: `repeating-radial-gradient(circle at 45% 50%, ${line} 0px 1px, transparent 1px 4px)`,
        'clous-de-paris': `repeating-linear-gradient(45deg, ${line} 0px 1px, transparent 1px 10px), repeating-linear-gradient(-45deg, ${line} 0px 1px, transparent 1px 10px)`,
        linen: `repeating-linear-gradient(0deg, ${line} 0px 1px, transparent 1px 5px), repeating-linear-gradient(90deg, ${line} 0px 1px, transparent 1px 7px)`,
        concentric: `repeating-radial-gradient(circle at 50% 46%, transparent 0px 14px, ${line} 15px 16px)`,
        'vertical-brushed': `repeating-linear-gradient(90deg, ${line} 0px 1px, transparent 1px 4px)`,
        leather: `${glow(30, 42, 45, 40, '#ffffff', 0.025)}, ${glow(68, 65, 35, 48, '#000000', 0.035)}`,
        'circular-brushed': `repeating-radial-gradient(circle at 50% 46%, transparent 0px 3px, ${line} 4px 5px)`,
        tapisserie: `repeating-linear-gradient(0deg, ${line} 0px 1px, transparent 1px 12px), repeating-linear-gradient(90deg, ${line} 0px 1px, transparent 1px 12px)`,
        waves: `repeating-radial-gradient(ellipse at 15% 130%, transparent 0px 20px, ${line} 21px 23px)`,
        scales: `repeating-radial-gradient(ellipse at 50% 110%, transparent 0px 12px, ${line} 13px 14px)`,
        topographic: `repeating-radial-gradient(ellipse at 35% 40%, transparent 0px 18px, ${line} 19px 20px, transparent 21px 27px)`,
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

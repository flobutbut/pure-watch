/**
 * Formes de boîtier (spec §5.1). Une forme est décrite par son rayon relatif ρ(θ) :
 * 1 = cercle de rayon R (le diamètre annoncé), > 1 = la forme déborde (coins d'un
 * coussin), < 1 = elle rentre (côtés d'un tonneau). Historiquement, le cadran restait rond ; seules les
 * surfaces extérieures (carrure, lunette) épousent la forme. Le contour intérieur
 * indépendant est désormais défini dans dial-shape.ts.
 *
 * Repère : θ = 0 vers 3 h, sens trigonométrique vu de face, 12 h = π/2.
 */

export const CASE_SHAPES = [
  'round',
  'cushion',
  'tonneau',
  'octagon',
  'square',
  'rectangle',
] as const;

/** Superellipse de demi-axes a (vers 3 h) et b (vers 12 h), d'exposant n. */
function superellipse(theta: number, a: number, b: number, n: number): number {
  const c = Math.abs(Math.cos(theta)) / a;
  const s = Math.abs(Math.sin(theta)) / b;
  return (c ** n + s ** n) ** (-1 / n);
}

export function shapeRadius(shape: string, theta: number): number {
  switch (shape) {
    // Coussin : carré très arrondi, coins pleins.
    case 'cushion':
      return superellipse(theta, 1, 1, 3.2);
    // Tonneau : allongé vers 12 h–6 h, flancs bombés qui se resserrent aux extrémités.
    case 'tonneau': {
      const s = Math.sin(theta);
      return superellipse(theta, 0.88 * (1 - 0.16 * s * s), 1.2, 2.6);
    }
    // Octogone : huit pans, côtés face à 12, 3, 6 et 9 h, angles adoucis.
    case 'octagon': {
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += Math.max(0, Math.cos(theta - (k * Math.PI) / 4)) ** 48;
      return sum ** (-1 / 48);
    }
    // Carré aux angles arrondis.
    case 'square':
      return superellipse(theta, 0.94, 0.94, 7);
    // Rectangle vertical (esprit art déco).
    case 'rectangle':
      return superellipse(theta, 0.8, 1.12, 7);
    default:
      return 1;
  }
}

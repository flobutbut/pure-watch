/**
 * Matières des petits éléments imprimés ou appliqués (chiffres d'abord), en trois axes :
 * la matière (encre, métal, luminescent), son effet (mat, vernis, poli, brossé) et sa
 * teinte (couleur libre, teinte de métal, pigment).
 *
 * À ne pas confondre avec les finitions de surface du cadran (soleillé, guilloché…), qui
 * décrivent le motif d'une grande surface : une matière décrit la substance d'un élément.
 */
import { z } from 'zod';
import { LUME_PIGMENTS, lumePigment, lumeChoice } from './lume';
import { numeralColor } from './dial';
import type { HexColor, WatchConfig } from './types';

export const MATERIAL_KINDS = ['ink', 'metal', 'lume'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

/** Effets proposés par matière, le premier étant celui par défaut. */
export const MATERIAL_EFFECTS = {
  ink: ['matte', 'varnished'],
  metal: ['polished', 'brushed'],
  lume: [],
} as const satisfies Record<MaterialKind, readonly string[]>;
export const ALL_MATERIAL_EFFECTS = ['matte', 'varnished', 'polished', 'brushed'] as const;
export type MaterialEffect = (typeof ALL_MATERIAL_EFFECTS)[number];

/** Teintes de métal : le même vocabulaire que les aiguilles et les index appliqués. */
export const METAL_TINTS = [
  { id: 'steel', color: '#E8EBF0', label: 'polished' },
  { id: 'gold', color: '#D3AA54', label: 'gold' },
  { id: 'blued', color: '#253F79', label: 'blued' },
  { id: 'black', color: '#292E35', label: 'black' },
] as const;
export type MetalTint = (typeof METAL_TINTS)[number]['id'];

const PIGMENT_IDS = LUME_PIGMENTS.map((pigment) => pigment.id) as [string, ...string[]];

/** Ce que le lien retient. Tout champ absent prend sa valeur par défaut. */
export const materialSchema = z
  .object({
    /** Suivre la matière d'un autre élément (les index pour les chiffres). */
    follow: z.literal('indices').optional(),
    kind: z.enum(MATERIAL_KINDS).optional(),
    effect: z.enum(ALL_MATERIAL_EFFECTS).optional(),
    metal: z.enum(METAL_TINTS.map((tint) => tint.id) as [MetalTint, ...MetalTint[]]).optional(),
    lume: z.enum(PIGMENT_IDS).optional(),
  })
  .strict();
export type MaterialSettings = z.infer<typeof materialSchema>;

/** Matière résolue, prête pour le rendu. */
export type ResolvedMaterial =
  | { kind: 'ink'; effect: 'matte' | 'varnished'; color: HexColor }
  | { kind: 'metal'; effect: 'polished' | 'brushed'; metal: MetalTint; color: HexColor }
  | { kind: 'lume'; pigment: string; day: HexColor; night: HexColor };

export function metalTint(id: string | undefined) {
  return METAL_TINTS.find((tint) => tint.id === id) ?? METAL_TINTS[0];
}

/** Effet valable pour la matière, sinon celui par défaut. */
export function materialEffect(kind: MaterialKind, effect: string | undefined) {
  const effects: readonly string[] = MATERIAL_EFFECTS[kind];
  return effects.includes(effect ?? '') ? effect : effects[0];
}

function resolve(settings: MaterialSettings, ink: HexColor, pigment?: string): ResolvedMaterial {
  const kind = settings.kind ?? 'ink';
  if (kind === 'metal') {
    const tint = metalTint(settings.metal);
    return {
      kind,
      effect: materialEffect(kind, settings.effect) as 'polished' | 'brushed',
      metal: tint.id,
      color: tint.color,
    };
  }
  if (kind === 'lume') {
    const found = lumePigment(settings.lume ?? pigment) ?? LUME_PIGMENTS[0]!;
    return { kind, pigment: found.id, day: found.day, night: found.night };
  }
  return {
    kind: 'ink',
    effect: materialEffect('ink', settings.effect) as 'matte' | 'varnished',
    color: ink,
  };
}

/** La matière des index, traduite en matière d'impression (« Comme les index »). */
export function indexPrintMaterial(config: WatchConfig): MaterialSettings {
  const { finish, lume } = config.dial.indices;
  if (finish === 'printed')
    return lume ? { kind: 'lume', lume: lumeChoice(config.dial.indices).kind ?? undefined } : {};
  if (finish === 'applied-lacquer') return { kind: 'ink', effect: 'varnished' };
  const metal: Record<string, MetalTint> = {
    'applied-polished': 'steel',
    'applied-gold': 'gold',
    'applied-blued': 'blued',
    'applied-black': 'black',
  };
  return { kind: 'metal', effect: 'polished', metal: metal[finish] ?? 'steel' };
}

/** Réglage des chiffres tel que l'interface le montre (valeurs par défaut comprises). */
export function numeralMaterialSettings(config: WatchConfig): MaterialSettings {
  return config.details?.numerals ?? {};
}

/**
 * Matière des chiffres des heures. Sans réglage : encre mate à la couleur des chiffres,
 * comme toujours. « Comme les index » reprend leur finition et, à l'encre, leur couleur.
 */
export function numeralMaterial(config: WatchConfig): ResolvedMaterial {
  const settings = numeralMaterialSettings(config);
  if (settings.follow === 'indices')
    return resolve(
      indexPrintMaterial(config),
      config.dial.indices.color,
      config.dial.indices.lume ?? undefined,
    );
  return resolve(settings, numeralColor(config.dial) as HexColor);
}

/** L'encre mate reste dans l'impression du cadran : rien ne change pour les montres connues. */
export function isFlatInk(material: ResolvedMaterial): boolean {
  return material.kind === 'ink' && material.effect === 'matte';
}

import { z } from 'zod';
import type { WatchConfig, HexColor } from './types';
import { pigmentChoice, lumePigment } from './lume';
import { isDialFinish, type DialFinish } from './dial-finishes';
import { SUBDIAL_HAND_STYLES } from './subdial-hand';
import { SUBDIAL_STYLES, type SubdialStyle } from './subdial-style';

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value as HexColor);
const ink = z.union([hex, z.literal('auto')]);
const factor = (min: number, max: number) => z.number().finite().min(min).max(max);
// Read links created with the retired graphic option without rejecting the configuration.
const subdialStyleSchema = z.enum([...SUBDIAL_STYLES, 'azure', 'rail']);
function normalizeMiniStyle<T extends { subdialStyle?: string; finish?: string }>(
  value: T,
): Omit<T, 'subdialStyle'> & { subdialStyle?: SubdialStyle } {
  const style = value.subdialStyle;
  return {
    ...value,
    ...(style === 'azure' && (!value.finish || value.finish === 'original')
      ? { finish: 'azure' }
      : {}),
    ...(style ? { subdialStyle: style === 'sunken' ? 'sunken' : 'flat' } : {}),
  } as Omit<T, 'subdialStyle'> & { subdialStyle?: SubdialStyle };
}
export const INDEX_DESIGNS = [
  'baton',
  'baton-facet',
  'dauphine',
  'dots',
  'triangles',
  'baguettes',
  'drops',
  'dive',
  'mixed-batons',
  'none',
] as const;

const dialSurfaceSchema = z
  .object({
    fume: factor(0, 1).optional(),
    // Keeps the highlight and metallic response of the retired fumé finish in old links.
    legacyFume: z.literal(true).optional(),
    edgeColor: ink.optional(),
    grainSize: factor(0.4, 2.5).optional(),
    grainDepth: factor(0, 2).optional(),
    grainRoughness: factor(0.3, 1.5).optional(),
  })
  .strict();

/** Optional additions: absent values preserve every historical configuration. */
export const detailsSchema = z
  .object({
    dial: dialSurfaceSchema.optional(),
    subdials: z
      .object({
        ink: ink.optional(),
        subdialStyle: subdialStyleSchema.optional(),
        finish: z.union([z.literal('original'), z.custom<DialFinish>(isDialFinish)]).optional(),
        color: z.union([hex, z.literal('match')]).optional(),
        surface: dialSurfaceSchema.omit({ legacyFume: true }).optional(),
        hand: z
          .object({
            style: z.enum(SUBDIAL_HAND_STYLES).optional(),
            color: z.union([hex, z.literal('match')]).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .transform(normalizeMiniStyle)
      .optional(),
    rehaut: z
      .object({
        ink: ink.optional(),
        accent: ink.optional(),
        accentAt: z.enum(['none', 'zero', 'quarters']).optional(),
        labelSize: factor(0.6, 1.6).optional(),
        lineWidth: factor(0.5, 2).optional(),
      })
      .strict()
      .optional(),
    indices: z
      .record(
        z.string().regex(/^(?:[1-9]|1[0-2])$/),
        z
          .object({
            style: z.enum(INDEX_DESIGNS).optional(),
            finish: z
              .enum([
                'applied-polished',
                'applied-gold',
                'applied-blued',
                'applied-black',
                'applied-lacquer',
                'printed',
              ])
              .optional(),
            color: hex.optional(),
            indexLength: factor(0.6, 1.6).optional(),
            indexWidth: factor(0.6, 1.8).optional(),
            indexRadius: factor(0.6, 1.1).optional(),
            lume: z.enum(['c3', 'bgw9', 'c1', 'old-radium']).nullable().optional(),
          })
          .strict(),
      )
      .optional(),
    reserve: z
      .object({
        subdialStyle: subdialStyleSchema.optional(),
        size: factor(0.65, 1.4).optional(),
        offsetX: factor(-0.2, 0.2).optional(),
        offsetY: factor(-0.2, 0.2).optional(),
        ink: ink.optional(),
        lowColor: ink.optional(),
        handColor: ink.optional(),
        handStyle: z.enum(SUBDIAL_HAND_STYLES).optional(),
        finish: z.union([z.literal('original'), z.custom<DialFinish>(isDialFinish)]).optional(),
        color: z.union([hex, z.literal('match')]).optional(),
        surface: dialSurfaceSchema.omit({ legacyFume: true }).optional(),
        label: z.string().max(24).optional(),
      })
      .strict()
      .transform(normalizeMiniStyle)
      .optional(),
  })
  .strict();

export type WatchDetails = z.infer<typeof detailsSchema>;
export type DialSurface = NonNullable<WatchDetails['dial']>;
export type RehautPrint = NonNullable<WatchDetails['rehaut']>;
export type IndexOverride = NonNullable<WatchDetails['indices']>[string];
export type ReserveAdjustment = NonNullable<WatchDetails['reserve']>;

export function dialSurface(config: WatchConfig) {
  const s = config.details?.dial;
  return {
    fume: s?.fume ?? (config.dial.finish === 'fume' ? 1 : 0),
    edgeColor: s?.edgeColor ?? 'auto',
    grainSize: s?.grainSize ?? 1,
    grainDepth: s?.grainDepth ?? 1,
    grainRoughness: s?.grainRoughness ?? 1,
  };
}

export function indexAt(config: WatchConfig, hour: number): WatchConfig {
  const override = config.details?.indices?.[String(hour || 12)];
  if (!override) return config;
  const pigment = override.lume ? lumePigment(override.lume) : undefined;
  const luminous = pigment ? pigmentChoice(pigment) : undefined;
  return {
    ...config,
    dial: {
      ...config.dial,
      indices: {
        ...config.dial.indices,
        ...override,
        ...(luminous ? { lumeColor: luminous.day, lumeEmission: luminous.night } : {}),
      },
    },
  };
}

/** Empty sections do not create a new link merely by opening a settings panel. */
export function cleanDetails(value: WatchDetails | undefined): WatchDetails | undefined {
  if (!value) return undefined;
  const result = Object.fromEntries(
    Object.entries(value).filter(([, v]) => v && Object.keys(v).length),
  );
  return Object.keys(result).length ? (result as WatchDetails) : undefined;
}

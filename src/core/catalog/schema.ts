/**
 * Schéma du catalogue (spec §4.3). Le schéma zod est la source unique : les types
 * TypeScript en sont déduits (voir types.ts).
 */
import { z } from 'zod';

const id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant kebab-case attendu (spec §4.2)');

export const prioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);

/** Groupes de lignes, dans l'ordre du regard (spec §5). */
export const groupSchema = z.enum([
  'style',
  'case',
  'face',
  'hands',
  'complications',
  'movement',
  'strap',
]);

export const rowKindSchema = z.enum(['enum', 'ordinal', 'palette', 'toggle', 'text']);

export const previewContextSchema = z.enum([
  'none',
  'dark-disc',
  'dial-sample',
  'case-sample',
  'wrist',
]);

/** Chemin d'un fichier d'asset, relatif à src/assets. */
export const assetRefSchema = z.string().min(1);

/** Expression de règle : son format sera fixé avec le moteur de règles (spec §4.5). */
export const ruleExprSchema = z.record(z.string(), z.unknown());

const i18nSchema = z.object({ name: z.string().min(1), hint: z.string().optional() });

export const variantSchema = z.object({
  id,
  /**
   * Valeur écrite dans WatchConfig au chemin de la ligne. Si c'est un objet,
   * elle est fusionnée avec l'objet existant à ce chemin au lieu de le remplacer.
   */
  value: z.unknown(),
  preview: assetRefSchema,
  render2d: assetRefSchema.optional(),
  render3d: assetRefSchema.optional(),
  requires: ruleExprSchema.optional(),
  tags: z.array(z.string()).optional(),
  i18n: z.object({ name: z.string().min(1) }),
});

export const rowSchema = z
  .object({
    id,
    group: groupSchema,
    kind: rowKindSchema,
    /** Chemin dans WatchConfig, par exemple « hands.set ». */
    path: z.string().regex(/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/, 'chemin pointé attendu'),
    previewContext: previewContextSchema,
    looping: z.boolean().default(true),
    priority: prioritySchema,
    variants: z.array(variantSchema).min(1, 'une ligne a au moins une variante'),
    visibleWhen: ruleExprSchema.optional(),
    i18n: i18nSchema,
  })
  .superRefine((row, ctx) => {
    const seen = new Set<string>();
    for (const variant of row.variants) {
      if (seen.has(variant.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `variante en double « ${variant.id} » dans la ligne « ${row.id} »`,
        });
      }
      seen.add(variant.id);
    }
  });

export const catalogSchema = z
  .object({
    catalogVersion: z.string().min(1),
    rows: z.array(rowSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    for (const row of catalog.rows) {
      if (seen.has(row.id)) {
        ctx.addIssue({ code: 'custom', message: `ligne en double « ${row.id} »` });
      }
      seen.add(row.id);
    }
  });

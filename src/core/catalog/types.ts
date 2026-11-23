import type { z } from 'zod';
import type {
  catalogSchema,
  groupSchema,
  previewContextSchema,
  prioritySchema,
  rowKindSchema,
  rowSchema,
  variantSchema,
} from './schema';

export type Priority = z.infer<typeof prioritySchema>;
export type GroupId = z.infer<typeof groupSchema>;
export type RowKind = z.infer<typeof rowKindSchema>;
export type PreviewContext = z.infer<typeof previewContextSchema>;
export type VariantDef = z.infer<typeof variantSchema>;
export type RowDef = z.infer<typeof rowSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type RowId = RowDef['id'];

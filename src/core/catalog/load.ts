import { catalogSchema } from './schema';
import type { Catalog } from './types';

export class CatalogError extends Error {
  override name = 'CatalogError';
}

/** Valide un catalogue brut (JSON) et renvoie un catalogue typé, ou lève une CatalogError lisible. */
export function parseCatalog(raw: unknown): Catalog {
  const result = catalogSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join('\n');
    throw new CatalogError(`Catalogue invalide :\n${details}`);
  }
  return result.data;
}

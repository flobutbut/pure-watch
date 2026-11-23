/**
 * Cache mémoire des instantanés de cellules, partagé par toute la page.
 * Clé = PartRenderer.cacheKey (version du catalogue + paramètres dont dépend l'aperçu).
 * Persistance IndexedDB et libération des entrées lointaines : phase 2 du plan d'action.
 */
export const snapshotCache = new Map<string, ImageBitmap>();

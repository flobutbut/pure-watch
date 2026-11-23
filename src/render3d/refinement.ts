/** Render-only switch: never serialized in WatchConfig or saved selections. */
export type Refinement = 'legacy' | 'geometry' | 'refined';

export function refinementFromSearch(search: string): Refinement {
  const value = new URLSearchParams(search).get('model');
  return value === 'legacy' || value === 'geometry' ? value : 'refined';
}

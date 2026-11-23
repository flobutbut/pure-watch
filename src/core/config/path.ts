/**
 * Lecture et écriture immuables dans un objet par chemin pointé (« hands.set »).
 * Utilisé pour appliquer une variante à la configuration (RowDef.path).
 *
 * Dans un tableau d'éléments typés (les complications), un segment désigne l'élément de ce
 * type : « complications.date.position ». Un élément absent se lit `null` ; écrire `null`
 * le retire, écrire un objet le crée ou le complète. Écrire un champ d'un élément absent
 * ne fait rien.
 */

type PlainObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function splitPath(path: string): string[] {
  return path.split('.').filter(Boolean);
}

type Typed = PlainObject & { type: string };

const isTyped = (item: unknown, type: string): item is Typed =>
  isPlainObject(item) && item['type'] === type;

export function getAtPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of splitPath(path)) {
    if (Array.isArray(current)) current = current.find((item) => isTyped(item, key)) ?? null;
    else if (isPlainObject(current)) current = current[key];
    else return undefined;
  }
  return current;
}

/** Écriture dans un tableau d'éléments typés : remplace, complète, ajoute ou retire. */
function setInTypedArray(source: unknown[], keys: string[], value: unknown): unknown[] {
  const [type, ...rest] = keys as [string, ...string[]];
  const index = source.findIndex((item) => isTyped(item, type));
  if (rest.length === 0 && (value === null || value === undefined))
    return index === -1 ? source : source.filter((_, i) => i !== index);
  // Un réglage d'un élément absent (style d'une date qui n'existe pas) ne le crée pas.
  if (index === -1 && rest.length > 0) return source;
  const existing = index === -1 ? { type } : source[index];
  const next = { ...(setAtPath(existing, rest.join('.'), value) as PlainObject), type };
  return index === -1 ? [...source, next] : source.map((item, i) => (i === index ? next : item));
}

/**
 * Renvoie une copie de `source` où la valeur au chemin `path` vaut `value`.
 * Si l'ancienne et la nouvelle valeur sont deux objets, ils sont fusionnés
 * en profondeur (une variante peut ne fixer qu'une partie d'un objet).
 * Seules les branches traversées sont copiées ; le reste est partagé.
 */
export function setAtPath<T>(source: T, path: string, value: unknown): T {
  const keys = splitPath(path);
  if (keys.length === 0) {
    return (isPlainObject(source) && isPlainObject(value) ? deepMerge(source, value) : value) as T;
  }
  if (Array.isArray(source)) return setInTypedArray(source, keys, value) as T;
  const [head, ...rest] = keys as [string, ...string[]];
  const base: PlainObject = isPlainObject(source) ? source : {};
  return { ...base, [head]: setAtPath(base[head], rest.join('.'), value) } as T;
}

export function deepMerge(target: PlainObject, patch: PlainObject): PlainObject {
  const out: PlainObject = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out;
}

/**
 * Vrai si `candidate` est contenu dans `actual` : égalité stricte pour les valeurs simples,
 * égalité champ par champ pour les tableaux, inclusion pour les objets
 * (tous les champs de `candidate` existent dans `actual` avec la même valeur).
 */
export function matchesValue(actual: unknown, candidate: unknown): boolean {
  if (Object.is(actual, candidate)) return true;
  if (Array.isArray(candidate)) {
    return (
      Array.isArray(actual) &&
      actual.length === candidate.length &&
      candidate.every((item, i) => matchesValue(actual[i], item))
    );
  }
  if (isPlainObject(candidate)) {
    return (
      isPlainObject(actual) &&
      Object.entries(candidate).every(([key, value]) => matchesValue(actual[key], value))
    );
  }
  return false;
}

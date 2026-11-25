/**
 * Wire formats of a configuration link: how the payload (short field keys → values, already
 * stripped of defaults) becomes the URL fragment. No dependencies, so tests can read links.
 *
 * - `#v1.<base64url JSON>`: the first format, still read. Its dot after the version cut the
 *   link in some messaging apps.
 * - `#2<base64url bytes>`: a compact binary form of the same payload, about three times shorter,
 *   written with letters, digits, `-` and `_` only.
 *
 * Format 2 entries, one per field: varint(key number), tag byte, value. The tag's top three bits
 * give the kind and its low five bits a small value. Key numbers derive from the key itself
 * (`a`–`Z` are 0–51, two-letter `xy` is 52 × (1 + x) + y), so they never depend on an order.
 * Never change an existing kind or key number: shared links must keep their meaning.
 */

export type LinkPayload = Record<string, unknown>;

export const V1_PREFIX = '#v1.';
export const V2_PREFIX = '#2';

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = LETTERS.length;

/** The value kinds of format 2 (top three bits of the tag byte). */
const SMALL = 0; // integer 0–31 held in the low five bits
const INTEGER = 1; // zigzag varint
const DECIMAL = 2; // low bits: decimal places; zigzag varint of the scaled integer
const HEX = 3; // low bit: lowercase; three colour bytes
const TEXT = 4; // varint byte length, UTF-8
const NULL = 5;
const JSON_VALUE = 6; // varint byte length, UTF-8 JSON (lists, objects)
const BOOLEAN = 7; // low bit: true

const MAX_DECIMALS = 9;

function keyNumber(key: string): number {
  const first = LETTERS.indexOf(key[0] ?? '');
  if (key.length === 1 && first >= 0) return first;
  const second = LETTERS.indexOf(key[1] ?? '');
  if (key.length === 2 && first >= 0 && second >= 0) return BASE * (1 + first) + second;
  throw new Error(`Clé de lien non encodable : ${key}`);
}

function keyName(n: number): string {
  if (n < BASE) return LETTERS[n]!;
  const first = Math.floor(n / BASE) - 1;
  if (first >= BASE) throw new Error('Clé de lien inconnue');
  return LETTERS[first]! + LETTERS[n % BASE]!;
}

class Writer {
  readonly bytes: number[] = [];
  varint(n: number) {
    for (; n >= 0x80; n = Math.floor(n / 0x80)) this.bytes.push((n % 0x80) | 0x80);
    this.bytes.push(n);
  }
  signed(n: number) {
    this.varint(n < 0 ? -2 * n - 1 : 2 * n);
  }
  tag(kind: number, low = 0) {
    this.bytes.push((kind << 5) | low);
  }
  blob(text: string) {
    const utf8 = new TextEncoder().encode(text);
    this.varint(utf8.length);
    this.bytes.push(...utf8);
  }
}

class Reader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get done() {
    return this.at >= this.bytes.length;
  }
  byte(): number {
    if (this.done) throw new Error('Lien tronqué');
    return this.bytes[this.at++]!;
  }
  varint(): number {
    let n = 0;
    for (let scale = 1; ; scale *= 0x80) {
      const b = this.byte();
      n += (b & 0x7f) * scale;
      if (!(b & 0x80)) break;
      if (scale > 2 ** 42) throw new Error('Nombre trop long');
    }
    if (!Number.isSafeInteger(n)) throw new Error('Nombre trop long');
    return n;
  }
  signed(): number {
    const n = this.varint();
    return n % 2 ? -(n + 1) / 2 : n / 2;
  }
  take(length: number): Uint8Array {
    if (this.at + length > this.bytes.length) throw new Error('Lien tronqué');
    return this.bytes.subarray(this.at, (this.at += length));
  }
  blob(): string {
    return new TextDecoder('utf-8', { fatal: true }).decode(this.take(this.varint()));
  }
}

/** Fewest decimal places that carry the number exactly, if any. */
function decimals(value: number): number | null {
  for (let k = 1; k <= MAX_DECIMALS; k++) {
    const scaled = Math.round(value * 10 ** k);
    if (Number.isSafeInteger(scaled) && scaled / 10 ** k === value) return k;
  }
  return null;
}

function writeValue(out: Writer, value: unknown) {
  if (value === null) return out.tag(NULL);
  if (typeof value === 'boolean') return out.tag(BOOLEAN, value ? 1 : 0);
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isSafeInteger(value)) {
      if (value >= 0 && value < 32) return out.tag(SMALL, value);
      out.tag(INTEGER);
      return out.signed(value);
    }
    const k = decimals(value);
    if (k !== null) {
      out.tag(DECIMAL, k);
      return out.signed(Math.round(value * 10 ** k));
    }
  }
  if (typeof value === 'string') {
    const lower = /^#[0-9a-f]{6}$/.test(value);
    if (lower || /^#[0-9A-F]{6}$/.test(value)) {
      out.tag(HEX, lower ? 1 : 0);
      const rgb = parseInt(value.slice(1), 16);
      return out.bytes.push(rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff);
    }
    out.tag(TEXT);
    return out.blob(value);
  }
  out.tag(JSON_VALUE);
  out.blob(JSON.stringify(value));
}

function readValue(input: Reader): unknown {
  const tag = input.byte();
  const low = tag & 0x1f;
  switch (tag >> 5) {
    case SMALL:
      return low;
    case INTEGER:
      return input.signed();
    case DECIMAL:
      if (low < 1 || low > MAX_DECIMALS) throw new Error('Décimales invalides');
      return input.signed() / 10 ** low;
    case HEX: {
      const hex = Array.from(input.take(3), (b) => b.toString(16).padStart(2, '0')).join('');
      return '#' + (low & 1 ? hex : hex.toUpperCase());
    }
    case TEXT:
      return input.blob();
    case NULL:
      return null;
    case JSON_VALUE:
      return JSON.parse(input.blob());
    default:
      return Boolean(low & 1);
  }
}

function toBase64url(bytes: ArrayLike<number>): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error('Base64 invalide');
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The format 2 fragment of a payload. */
export function encodeLinkPayload(payload: LinkPayload): string {
  const out = new Writer();
  for (const [key, value] of Object.entries(payload)) {
    out.varint(keyNumber(key));
    writeValue(out, value);
  }
  return V2_PREFIX + toBase64url(out.bytes);
}

/**
 * The payload carried by a `#v1.` or `#2` fragment. Throws on a malformed link; returns null
 * for a fragment of another format.
 */
export function decodeLinkPayload(hash: string): LinkPayload | null {
  if (hash.startsWith(V1_PREFIX)) {
    const body = hash.slice(V1_PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error('Lien v1 invalide');
    const json = new TextDecoder('utf-8', { fatal: true }).decode(fromBase64url(body));
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
      throw new Error('Lien v1 invalide');
    return payload as LinkPayload;
  }
  if (hash.startsWith(V2_PREFIX)) {
    const body = hash.slice(V2_PREFIX.length);
    if (!/^[A-Za-z0-9_-]*$/.test(body)) throw new Error('Lien invalide');
    const input = new Reader(fromBase64url(body));
    const payload: LinkPayload = {};
    while (!input.done) {
      const key = keyName(input.varint());
      payload[key] = readValue(input);
    }
    return payload;
  }
  return null;
}

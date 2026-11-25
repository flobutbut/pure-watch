import { describe, expect, it } from 'vitest';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../catalog/load';
import { decodeLinkPayload, encodeLinkPayload } from './link-codec';
import { blackTonneauPilot } from './pilot';
import { decodeConfigHash, encodeConfigHash } from './url';

const catalog = parseCatalog(rawCatalog);
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const v1 = (payload: object) =>
  '#v1.' + base64url(new TextEncoder().encode(JSON.stringify(payload)));

describe('format compact des liens', () => {
  it('restitue chaque sorte de valeur à l’identique', () => {
    const payload = {
      a: 3,
      b: 36,
      d: 42.5,
      ai: 357.25,
      aj: 1.35,
      T: -4,
      x: '#173548',
      q: '#eae6dc',
      M: 'match',
      F: 'Épure · 東京',
      y: null,
      l: true,
      m: false,
      O: [{ type: 'date', position: '3h' }],
      au: { style: 'match', length: 0.9, width: 1.2 },
      ZZ: 1e21,
    };
    expect(decodeLinkPayload(encodeLinkPayload(payload))).toEqual(payload);
  });

  it('n’écrit que des lettres, des chiffres, - et _, sans point', () => {
    expect(encodeConfigHash(blackTonneauPilot())).toMatch(/^#2[A-Za-z0-9_-]+$/);
  });

  it('est environ trois fois plus court que le format v1', () => {
    const encoded = encodeConfigHash(blackTonneauPilot());
    const old = v1(decodeLinkPayload(encoded)!);
    expect(encoded.length * 2.5).toBeLessThan(old.length);
  });

  it('garde le sens des liens déjà partagés', () => {
    // Frozen: if this fails, format 2 changed and links in circulation would be misread.
    const shared = '#2AAMFCAYGCQESAxYCGQQaCB0CHgkiASUDJmDywjAvAg';
    expect(decodeConfigHash(shared, catalog)).toEqual({
      config: blackTonneauPilot(),
      notice: '',
    });
  });

  it('lit toujours les liens v1, qui donnent la même montre', () => {
    const config = blackTonneauPilot();
    const old = v1(decodeLinkPayload(encodeConfigHash(config))!);
    expect(decodeConfigHash(old, catalog)).toEqual({ config, notice: '' });
  });

  const bytes = (...b: number[]) => '#2' + base64url(Uint8Array.from(b));
  it.each([
    ['un caractère interdit', '#2!!!'],
    ['un base64 impossible', '#2A'],
    ['une clé sans valeur', bytes(0)],
    ['une couleur tronquée', bytes(0, 0x60, 0x11)],
    ['un décimal sans décimales', bytes(0, 0x40, 2)],
    ['un nombre inachevé', bytes(0, 0x20, 0x80)],
    ['un texte plus long que le lien', bytes(0, 0x80, 5, 65)],
    ['un JSON mal formé', bytes(0, 0xc0, 1, 0x7b)],
    ['une clé hors alphabet', bytes(0xff, 0xff, 0x7f, 0)],
  ])('%s rend le lien invalide', (_, hash) => {
    expect(decodeConfigHash(hash, catalog).notice).toBe('invalid');
  });
});

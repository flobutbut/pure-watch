import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { reserveAngle, reserveGauge } from '../../core/config/power-reserve';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import * as textures from '../textures';
import { buildDial } from './dial';
import { buildHands } from './hands';
import { reserveSvg } from './power-reserve';

vi.spyOn(textures, 'svgTexture').mockImplementation(() => ({
  texture: new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement),
  ready: Promise.resolve(),
}));

function withReserve(position: string, style?: string) {
  const config = defaultConfig();
  config.complications = [{ type: 'power-reserve', position, ...(style ? { style } : {}) }];
  return config;
}

const font = { family: 'Arial', weight: 400 };
const labels = (svg: string) => [...svg.matchAll(/>([^<]+)<\/text>/g)].map((m) => m[1]);

describe('réserve de marche', () => {
  it('imprime trois échelles distinctes', () => {
    expect(labels(reserveSvg(5, 'arc', '#000', font))).toEqual([
      '0',
      '10',
      '20',
      '30',
      '40',
      'RÉSERVE',
    ]);
    const segments = reserveSvg(5, 'segments', '#000', font);
    expect(labels(segments)).toEqual(['BAS', 'HAUT']);
    expect(segments.match(/<path[^>]*fill="#D2352B"/g)).toHaveLength(1);
    expect(segments.match(/<path /g)).toHaveLength(5);
    expect(labels(reserveSvg(5, 'fuel', '#000', font))).toEqual(['E', 'F']);
  });

  it('pose l’échelle sur le pivot de l’aiguille, avec le reste de l’impression', () => {
    const config = withReserve('9h');
    const d = watchDimensions(config);
    const gauge = reserveGauge(config, d.dialSafeRadius)!;
    const lib = new MaterialLibrary();
    vi.spyOn(lib, 'dial').mockReturnValue(lib.polishedSteel());
    const parts = buildDial(config, d, lib, { print: true, printSize: 1 });
    const print = parts.print.getObjectByName('reserve-print')!.children[0]!;
    expect(print.position.x).toBeCloseTo(gauge.x);
    expect(print.position.y).toBeCloseTo(gauge.y);
    // Sans impression demandée (vignettes de matière), pas d'échelle.
    const bare = buildDial(config, d, lib, { print: false, printSize: 1 });
    expect(bare.print.getObjectByName('reserve-print')).toBeUndefined();
  });

  it('place l’aiguille sur son niveau, sous les aiguilles des heures', () => {
    const config = withReserve('12h');
    const d = watchDimensions(config);
    const gauge = reserveGauge(config, d.dialSafeRadius)!;
    const hands = buildHands(config, d, new MaterialLibrary());
    const pivot = hands.group.getObjectByName('reserve-hand')!;
    expect(pivot.position.x).toBeCloseTo(gauge.x);
    expect(pivot.position.y).toBeCloseTo(gauge.y);
    expect(pivot.rotation.z).toBeCloseTo((-reserveAngle() * Math.PI) / 180);
    const hour = hands.group.getObjectByName('hour-blade')!.parent!;
    expect(pivot.position.z).toBeLessThan(hour.position.z);
    // L'aiguille atteint l'échelle sans la dépasser.
    const blade = pivot.getObjectByName('reserve-blade') as THREE.Mesh;
    blade.geometry.computeBoundingBox();
    expect(blade.geometry.boundingBox!.max.y).toBeGreaterThan(gauge.r * 0.8);
    expect(blade.geometry.boundingBox!.max.y).toBeLessThan(gauge.r);
    // Pas d'aiguille de réserve sans réserve.
    const plain = buildHands(defaultConfig(), d, new MaterialLibrary());
    expect(plain.group.getObjectByName('reserve-hand')).toBeUndefined();
  });
});

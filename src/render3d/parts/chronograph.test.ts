import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { chronoCounters } from '../../core/config/chronograph';
import { defaultConfig } from '../../core/config/defaults';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import * as textures from '../textures';
import { buildWatch } from '../watch';
import { buildPushers } from './crown';
import { buildDial } from './dial';
import { buildHands } from './hands';
import { subdialSvg } from './subdial';

vi.spyOn(textures, 'svgTexture').mockImplementation(() => ({
  texture: new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement),
  ready: Promise.resolve(),
}));

function chrono(layout: string, extra: Record<string, string> = {}) {
  const config = defaultConfig();
  config.complications = [{ type: 'chronograph', position: layout, ...extra }];
  return config;
}

function lib() {
  const library = new MaterialLibrary();
  vi.spyOn(library, 'dial').mockImplementation(
    (config) => new THREE.MeshPhysicalMaterial({ color: config.dial.color }),
  );
  return library;
}

const font = { family: 'Arial', weight: 400 };
const labels = (svg: string) => [...svg.matchAll(/>(\d+)<\/text>/g)].map((m) => m[1]);

describe('chronographe en 3D', () => {
  it('gradue chaque compteur selon ce qu’il compte', () => {
    expect(labels(subdialSvg(5, 'flat', '#000', font, '', 'minutes'))).toEqual(['10', '20', '30']);
    expect(labels(subdialSvg(5, 'flat', '#000', font, '', 'hours'))).toEqual(['3', '6', '9', '12']);
    expect(subdialSvg(5, 'flat', '#000', font, '', 'minutes').match(/<line/g)).toHaveLength(30);
    expect(subdialSvg(5, 'flat', '#000', font, '', 'hours').match(/<line/g)).toHaveLength(12);
  });

  it('imprime un compteur par emplacement, et ajoute un disque en panda', () => {
    const plain = chrono('tricompax');
    const d = watchDimensions(plain);
    const parts = buildDial(plain, d, lib(), { print: true, printSize: 1 });
    expect(parts.print.getObjectByName('chrono-print')!.children).toHaveLength(3);
    expect(parts.dial.getObjectByName('chrono-counters')!.children).toHaveLength(0);
    const panda = buildDial(chrono('tricompax', { counters: 'black' }), d, lib(), {
      print: true,
      printSize: 1,
    });
    const discs = panda.dial.getObjectByName('chrono-counters')!.children as THREE.Mesh[];
    expect(discs).toHaveLength(3);
    const color = (discs[0]!.material as THREE.MeshStandardMaterial).color.getHexString();
    expect(color).toBe('17191d');
  });

  it('arrête le chrono à zéro et fait tourner les secondes courantes', () => {
    const config = chrono('bicompax');
    const d = watchDimensions(config);
    const hands = buildHands(config, d, lib());
    hands.setAngles({ hour: 30, minute: 120, second: 90 });
    const central = hands.seconds.getObjectByName('second-blade')!.parent!;
    expect(central.rotation.z).toBe(0);
    const running = hands.seconds.getObjectByName('seconds-counter')!;
    expect(running.rotation.z).toBeCloseTo((-90 * Math.PI) / 180);
    const counters = chronoCounters(config, d.dialSafeRadius);
    expect(running.position.x).toBeCloseTo(counters[0]!.x);
    const minutes = hands.group.getObjectByName('minutes-counter')!;
    expect(minutes.rotation.z).toBe(0);
    expect(minutes.position.x).toBeCloseTo(counters[1]!.x);
    // Sans chronographe, la trotteuse centrale tourne.
    const plain = buildHands(defaultConfig(), d, lib());
    plain.setAngles({ hour: 30, minute: 120, second: 90 });
    expect(plain.seconds.getObjectByName('second-blade')!.parent!.rotation.z).toBeCloseTo(
      (-90 * Math.PI) / 180,
    );
  });

  it.each(['round', 'pump'])('poussoirs %s : à 2 h et 4 h, hors du boîtier', (pushers) => {
    const config = chrono('bicompax', { pushers });
    const d = watchDimensions(config);
    const group = buildPushers(config, d, lib())!;
    expect(group.children.map((c) => c.name)).toEqual(['pusher-2h', 'pusher-4h']);
    group.updateMatrixWorld(true);
    for (const [i, pivot] of group.children.entries()) {
      const box = new THREE.Box3().setFromObject(pivot);
      const tip = box.max.x;
      expect(tip).toBeGreaterThan(d.caseRadius * 0.85);
      // 2 h au-dessus de l'axe de 3 h, 4 h au-dessous.
      const center = box.getCenter(new THREE.Vector3());
      expect(Math.sign(center.y)).toBe(i === 0 ? 1 : -1);
    }
    expect(buildPushers(defaultConfig(), d, lib())).toBeNull();
  });

  it('range les poussoirs avec la couronne', () => {
    const watch = buildWatch(chrono('tricompax'), lib(), { quality: 'fallback' });
    expect(watch.layers.crown.getObjectByName('pushers')).toBeDefined();
    expect(watch.layers.crown.getObjectByName('crown')).toBeDefined();
    watch.dispose();
  });
});

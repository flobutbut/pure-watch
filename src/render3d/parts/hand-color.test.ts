import * as THREE from 'three';
import { expect, it } from 'vitest';
import { defaultConfig } from '../../core/config/defaults';
import { watchDimensions } from '../../core/geometry/dimensions';
import { MaterialLibrary } from '../materials';
import { buildHands } from './hands';

it('uses physical metals or lacquer on the blades, with a truly matching second hand', () => {
  const lib = new MaterialLibrary();
  const config = defaultConfig();
  expect(lib.handMaterial(config, 'face')).toBe(lib.handSteel('face'));
  for (const finish of ['gold', 'blued', 'black', 'lacquer']) {
    config.hands.finish = finish;
    config.hands.color = '#B83D91';
    config.hands.second.color = 'match';
    const parts = buildHands(config, watchDimensions(config), lib, true, false, true);
    const hour = parts.group.getObjectByName('hour-blade') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshPhysicalMaterial[]
    >;
    const second = parts.seconds.getObjectByName('second-blade') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshPhysicalMaterial
    >;
    expect(hour.material[0]!.metalness).toBe(finish === 'lacquer' ? 0.05 : 1);
    expect(second.material.color.getHexString()).toBe(hour.material[0]!.color.getHexString());
    if (finish === 'lacquer') expect(second.material.color.getHexString()).toBe('b83d91');
    for (const group of [parts.group, parts.seconds])
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
  }
  lib.dispose();
});

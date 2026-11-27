import * as THREE from 'three';

/** Compact deterministic signatures keep failed geometry comparisons from trying
 * to produce a line diff of hundreds of thousands of individual coordinates. */
export function geometrySignature(root: THREE.Object3D, attributes = ['position']): string {
  let first = 0x811c9dc5,
    second = 0x9e3779b9,
    count = 0;
  const update = (array: ArrayBufferView) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    count += bytes.length;
    for (const byte of bytes) {
      first = Math.imul(first ^ byte, 16777619);
      second = Math.imul(second ^ byte, 2246822519);
    }
  };
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const name of attributes) {
      const attribute = o.geometry.getAttribute(name);
      if (attribute) update(attribute.array);
    }
    if (attributes.length > 1 && o.geometry.index) update(o.geometry.index.array);
  });
  return `${count}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

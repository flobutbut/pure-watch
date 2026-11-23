/**
 * Occlusion ambiante précalculée : la lumière entre mal dans les creux (corne contre
 * carrure, couronne contre flanc). On assombrit doucement les sommets proches de ces
 * jonctions, par couleurs de sommet. Aucun post-traitement : le même rendu sert aux
 * instantanés de cellules et à la montre en direct, sur ordinateur comme sur mobile.
 */
import * as THREE from 'three';
import type { WatchConfig } from '../../core/config/types';
import { crownAngle, type WatchDimensions } from '../../core/geometry/dimensions';
import { caseLevels } from './levels';

/** Facteur de lumière en un point (1 = pleine lumière, 0 = noir). */
export type Occlusion = (x: number, y: number, z: number) => number;

/** Creux gaussien : 1 loin de la jonction, 1 − depth au contact. */
const dip = (distance: number, sigma: number, depth: number) =>
  1 - depth * Math.exp(-((Math.max(0, distance) / sigma) ** 2));

/** Cotes verticales de la racine des cornes (partagées avec lugs.ts). */
export function lugRoot(d: WatchDimensions) {
  const { T, flankTop } = caseLevels(d);
  return { top: flankTop - 0.1 * T, bottom: d.z.back + 0.12 * T };
}

/** Occlusion sur la carrure : autour de la racine des cornes et du tube de couronne. */
export function caseOcclusion(config: WatchConfig, d: WatchDimensions): Occlusion {
  const { R, T } = caseLevels(d);
  const root = lugRoot(d);
  const lugs = config.case.lugs;
  // Cornes intégrées : un seul bloc sur toute la largeur ; aucune corne : pas d'ombre.
  const aIn = lugs === 'integrated' ? 0 : d.lugWidth / 2;
  const aOut = d.lugWidth / 2 + d.lugThickness;
  const crown = crownAngle(config.crown.position);
  const crownZ = d.z.back + 0.48 * T;
  const tubeRadius = d.crown.radius * 0.45;
  const guarded = config.crown.style === 'guarded' || config.crown.guard;
  const wingIn = d.crown.radius + 0.3;
  const wingOut = wingIn + Math.min(1.8, Math.max(1.1, d.crown.radius * 0.45));
  const wingHalf = d.crown.radius * 1.25;

  return (x, y, z) => {
    let light = 1;
    // Cornes : distance à la zone d'attache (bande en x, hauteur de la racine), même quart.
    const ax = Math.abs(x);
    if (lugs !== 'none' && Math.abs(y) > R * 0.55) {
      const dx = ax < aIn ? aIn - ax : ax > aOut ? ax - aOut : 0;
      const dz = z > root.top ? z - root.top : z < root.bottom ? root.bottom - z : 0;
      light *= dip(Math.hypot(dx, dz), 1.1, 0.45);
    }
    // Couronne : anneau d'ombre autour du tube sur le flanc.
    const theta = Math.atan2(y, x);
    const dTheta = Math.atan2(Math.sin(theta - crown), Math.cos(theta - crown));
    const onFlank = Math.hypot(dTheta * R, z - crownZ) - tubeRadius;
    light *= dip(onFlank, 0.9, 0.35);
    // Ailettes du protège-couronne : même ombre de raccord que les cornes.
    if (guarded && Math.abs(dTheta) < 0.6) {
      const lateral = Math.abs(Math.sin(dTheta) * Math.hypot(x, y));
      const dw = lateral < wingIn ? wingIn - lateral : lateral > wingOut ? lateral - wingOut : 0;
      const dz = Math.max(0, Math.abs(z - crownZ) - wingHalf);
      light *= dip(Math.hypot(dw, dz), 1, 0.38);
    }
    return light;
  };
}

/** Écrit un attribut de couleur (gris = facteur de lumière) sur une géométrie. */
export function applyOcclusion(
  geometry: THREE.BufferGeometry,
  occlusion: Occlusion,
  matrix?: THREE.Matrix4,
): void {
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (matrix) v.applyMatrix4(matrix);
    const light = occlusion(v.x, v.y, v.z);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = light;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Aucune occlusion (pièces sans jonction, pour garder un attribut de couleur homogène). */
export const noOcclusion: Occlusion = () => 1;

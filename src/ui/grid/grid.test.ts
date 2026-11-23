import { describe, expect, it } from 'vitest';
import { dragSteps, WheelStepper, wheelPixels } from './gestures';
import { gridMetrics, hierarchy, pixelSnap, rowEnds, visibleSlots } from './layout';

describe('gridMetrics', () => {
  it('reprend la grille Figma sur un écran de 1440 × 1024', () => {
    const m = gridMetrics(1440, 1024);
    expect(m.pitch).toBeCloseTo(216, 0);
    expect(m.cell).toBeCloseTo(160, 0);
    expect(m.colsHalf).toBe(5); // 3 visibles + rognées + marge
  });

  it('passe à 3 colonnes sur téléphone, cellules d’au moins 96 px de pas', () => {
    const m = gridMetrics(390, 844);
    expect(m.pitch).toBeGreaterThanOrEqual(96);
    expect(m.pitch).toBeLessThanOrEqual(130);
  });
});

describe('hierarchy', () => {
  it('estompe selon la distance de grille max(|Δcol|, |Δligne|)', () => {
    expect(hierarchy(0, 0)).toEqual({ scale: 1, opacity: 1 });
    expect(hierarchy(1, -1)).toEqual({ scale: 0.92, opacity: 0.9 });
    expect(hierarchy(-3, 1).opacity).toBe(0.45);
    expect(hierarchy(9, 0)).toEqual({ scale: 0.7, opacity: 0.25 });
  });
});

describe('visibleSlots', () => {
  const rows = [
    { variantCount: 1 },
    { variantCount: 12 },
    { variantCount: 6 },
    { variantCount: 3 },
  ];

  it('centre chaque ligne sur sa variante choisie et s’arrête aux bords', () => {
    const selection = [0, 11, 2, 1];
    const slots = visibleSlots(rows, 2, (r) => selection[r]!, { colsHalf: 2, rowsHalf: 1 });
    const size = slots.filter((s) => s.rowIndex === 1);
    expect(size.map((s) => s.dCol)).toEqual([-2, -1, 0]); // dernière variante : rien à droite
    const hands = slots.filter((s) => s.rowIndex === 2);
    expect(hands.map((s) => s.variantIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(slots.some((s) => s.rowIndex === 0)).toBe(false); // hors marge verticale
    expect(slots.find((s) => s.rowIndex === 3 && s.dCol === 0)?.dRow).toBe(1);
  });
});

describe('visibleSlots — lignes cycliques', () => {
  it('continue la liste des deux côtés sans doublon', () => {
    const rows = [{ variantCount: 11, looping: true }];
    const slots = visibleSlots(rows, 0, () => 0, { colsHalf: 5, rowsHalf: 0 });
    expect(slots.map((s) => s.dCol)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
    expect(slots[0]!.variantIndex).toBe(6); // à gauche du premier : la fin de la liste
    expect(new Set(slots.map((s) => s.variantIndex)).size).toBe(11);
  });
});

describe('WheelStepper', () => {
  it('verrouille l’axe sur le premier mouvement significatif', () => {
    const w = new WheelStepper();
    expect(w.push(3, 1, 0)).toBeNull();
    expect(w.push(30, 6, 10)).toBeNull(); // axe x verrouillé, accumulation 33
    expect(w.push(10, 40, 20)).toEqual({ axis: 'x', delta: 1 }); // le y est ignoré
  });

  it('ignore les rafales pendant un pas mais garde le surplus', () => {
    const w = new WheelStepper();
    expect(w.push(0, 50, 0)).toEqual({ axis: 'y', delta: 1 });
    expect(w.push(0, 50, 50)).toBeNull(); // pas en cours
    expect(w.push(0, 0.1, 200)).toEqual({ axis: 'y', delta: 1 }); // surplus libéré
  });

  it('une pause longue démarre une nouvelle séquence', () => {
    const w = new WheelStepper();
    w.push(0, 20, 0);
    expect(w.push(-50, 0, 1000)).toEqual({ axis: 'x', delta: -1 });
  });

  it('convertit les lignes en pixels et Maj + molette en horizontal', () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1, shiftKey: false })).toEqual({
      dx: 0,
      dy: 120,
    });
    expect(wheelPixels({ deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: true })).toEqual({
      dx: 40,
      dy: 0,
    });
  });
});

describe('dragSteps', () => {
  const pitch = 216;
  it('glisser vers la gauche avance', () => {
    expect(dragSteps(-220, 0, pitch)).toBe(1);
    expect(dragSteps(220, 0, pitch)).toBe(-1);
  });
  it('un petit geste rapide compte, un petit geste lent non', () => {
    expect(dragSteps(-40, -0.5, pitch)).toBeGreaterThanOrEqual(1);
    expect(dragSteps(-40, -0.05, pitch)).toBe(0);
  });
  it("l'inertie est plafonnée à 3 cellules", () => {
    expect(dragSteps(-300, -20, pitch)).toBe(3);
  });
});

describe('rowEnds', () => {
  const rows = [
    { variantCount: 6, looping: true },
    { variantCount: 6 },
    { variantCount: 1, looping: true },
  ];

  it('place un point entre la dernière et la première variante d’une ligne qui boucle', () => {
    const slots = visibleSlots(rows, 0, (r) => [5, 5, 0][r]!, { colsHalf: 5, rowsHalf: 2 });
    const ends = rowEnds(rows, slots);
    expect(ends).toEqual([{ rowIndex: 0, dCol: 0.5, dRow: 0 }]);
  });

  it('ne marque rien quand la jonction est hors de la fenêtre', () => {
    const slots = visibleSlots(rows, 0, (r) => [2, 0, 0][r]!, { colsHalf: 1, rowsHalf: 2 });
    expect(rowEnds(rows, slots)).toEqual([]);
  });
});

describe('pixelSnap', () => {
  it('cale le côté affiché et le coin sur des pixels physiques', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (const [cx, cy, size, scale] of [
        [453.5, 433.5, 100.72, 0.84],
        [453.5, 433.5, 710.94, 0.297],
        [200.3, 87.1, 355.5, 1],
      ] as const) {
        const p = pixelSnap(cx, cy, size, scale, dpr);
        expect(Number.isInteger(p.devicePx)).toBe(true);
        expect(size * p.scale * dpr).toBeCloseTo(p.devicePx, 9);
        expect((p.x * dpr) % 1).toBeCloseTo(0, 9);
        expect((p.y * dpr) % 1).toBeCloseTo(0, 9);
        // Le centre ne bouge pas de plus d'un pixel physique.
        expect(Math.abs(p.x + (size * p.scale) / 2 - cx)).toBeLessThanOrEqual(1 / dpr);
      }
    }
  });
});

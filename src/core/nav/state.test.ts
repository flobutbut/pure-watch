import { describe, expect, it } from 'vitest';
import { createNavState, PAGE_ROWS, selectedIndex, step, transition, type RowView } from './state';

const rows: RowView[] = [
  { id: 'case', variantCount: 1, looping: false },
  { id: 'size', variantCount: 12, looping: false },
  { id: 'hands', variantCount: 6, looping: false },
  { id: 'hue', variantCount: 4, looping: true },
];

describe('step — variantes', () => {
  it('avance et recule dans la ligne active', () => {
    let s = createNavState(rows, {}, 2);
    s = step(s, rows, { type: 'variant', delta: 1 }).state;
    s = step(s, rows, { type: 'variant', delta: 1 }).state;
    expect(selectedIndex(s, 'hands')).toBe(2);
    s = step(s, rows, { type: 'variant', delta: -1 }).state;
    expect(selectedIndex(s, 'hands')).toBe(1);
  });

  it("s'arrête au bord et signale le rebond", () => {
    const s = createNavState(rows, { hands: 5 }, 2);
    const r = step(s, rows, { type: 'variant', delta: 1 });
    expect(r.changed).toBe(false);
    expect(r.bump).toBe('right');
    expect(r.state).toBe(s);

    const left = step(createNavState(rows, {}, 2), rows, { type: 'variant', delta: -1 });
    expect(left.bump).toBe('left');
  });

  it("avance autant que possible avec l'inertie, puis rebondit", () => {
    const s = createNavState(rows, { hands: 4 }, 2);
    const r = step(s, rows, { type: 'variant', delta: 3 });
    expect(selectedIndex(r.state, 'hands')).toBe(5);
    expect(r.changed).toBe(true);
    expect(r.bump).toBe('right');
  });

  it('boucle sur les lignes cycliques, sans rebond', () => {
    const s = createNavState(rows, { hue: 3 }, 3);
    const r = step(s, rows, { type: 'variant', delta: 1 });
    expect(selectedIndex(r.state, 'hue')).toBe(0);
    expect(r.bump).toBeNull();
    const back = step(r.state, rows, { type: 'variant', delta: -2 });
    expect(selectedIndex(back.state, 'hue')).toBe(2);
  });

  it('une ligne à une seule variante ne bouge pas et rebondit', () => {
    const r = step(createNavState(rows), rows, { type: 'variant', delta: 1 });
    expect(r.changed).toBe(false);
    expect(r.bump).toBe('right');
  });

  it('Début et Fin vont aux extrémités de la ligne active', () => {
    let s = createNavState(rows, { size: 5 }, 1);
    s = step(s, rows, { type: 'last-variant' }).state;
    expect(selectedIndex(s, 'size')).toBe(11);
    s = step(s, rows, { type: 'first-variant' }).state;
    expect(selectedIndex(s, 'size')).toBe(0);
  });
});

describe('step — lignes', () => {
  it('chaque ligne garde sa propre sélection', () => {
    let s = createNavState(rows, {}, 2);
    s = step(s, rows, { type: 'variant', delta: 3 }).state; // hands = 3
    s = step(s, rows, { type: 'row', delta: -1 }).state; // size
    s = step(s, rows, { type: 'variant', delta: 2 }).state; // size = 2
    s = step(s, rows, { type: 'row', delta: 1 }).state; // retour sur hands
    expect(s.activeRow).toBe(2);
    expect(selectedIndex(s, 'hands')).toBe(3);
    expect(selectedIndex(s, 'size')).toBe(2);
  });

  it('les sauts de page sont bornés et signalent le bord', () => {
    const s = createNavState(rows, {}, 1);
    const down = step(s, rows, { type: 'row', delta: PAGE_ROWS });
    expect(down.state.activeRow).toBe(3);
    expect(down.bump).toBe('down');
    const up = step(createNavState(rows), rows, { type: 'row', delta: -1 });
    expect(up.changed).toBe(false);
    expect(up.bump).toBe('up');
  });
});

describe('step — goto', () => {
  it('recentre une cellule touchée dans une autre ligne', () => {
    const s = createNavState(rows, {}, 2);
    const r = step(s, rows, { type: 'goto', row: 1, variant: 7 });
    expect(r.state.activeRow).toBe(1);
    expect(selectedIndex(r.state, 'size')).toBe(7);
    expect(r.changed).toBe(true);
  });

  it('borne les index hors limites', () => {
    const r = step(createNavState(rows), rows, { type: 'goto', row: 99, variant: 99 });
    expect(r.state.activeRow).toBe(3);
    expect(selectedIndex(r.state, 'hue')).toBe(3);
  });
});

describe('createNavState', () => {
  it('borne une sélection initiale invalide', () => {
    const s = createNavState(rows, { hands: 42, size: -3 }, 10);
    expect(selectedIndex(s, 'hands')).toBe(5);
    expect(selectedIndex(s, 'size')).toBe(0);
    expect(s.activeRow).toBe(3);
  });
});

describe('vue 3D', () => {
  it('suit la machine à états : grille inerte pendant les transitions, parcourue dans la vue', () => {
    let s = createNavState(rows, {}, 2);
    s = transition(s, 'open');
    expect(s.mode).toBe('opening3d');
    expect(step(s, rows, { type: 'variant', delta: 1 }).changed).toBe(false);
    s = transition(s, 'opened');
    expect(s.mode).toBe('view3d');
    // In the preview, the arrows browse rows and variants as in the grid.
    const moved = step(s, rows, { type: 'row', delta: 1 });
    expect(moved.changed).toBe(true);
    expect(moved.state.mode).toBe('view3d');
    s = transition(s, 'close');
    expect(step(s, rows, { type: 'variant', delta: 1 }).changed).toBe(false);
    s = transition(s, 'closed');
    expect(s.mode).toBe('grid');
  });

  it("permet d'annuler pendant l'ouverture et ignore les événements hors séquence", () => {
    let s = transition(createNavState(rows), 'open');
    s = transition(s, 'close');
    expect(s.mode).toBe('closing3d');
    expect(transition(createNavState(rows), 'closed').mode).toBe('grid');
  });
});

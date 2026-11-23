import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../config/defaults';
import type { WatchConfig } from '../config/types';
import { compatibleMovements, movementFit, visibleDialMm } from './compatibility';
import { MOVEMENTS } from './movements';

const sized = (diameterMm: number, thicknessMm: number, size = 'compact'): WatchConfig => {
  const config = defaultConfig();
  return {
    ...config,
    case: { ...config.case, diameterMm, thicknessMm },
    dial: { ...config.dial, size },
  };
};

describe('compatibilité des mouvements', () => {
  it('le NH38 sans date convient tel quel à un boîtier de 38 mm à cadran compact', () => {
    const config = sized(38, 10.5);
    expect(visibleDialMm(config)).toBeLessThanOrEqual(28.5);
    expect(movementFit(config, MOVEMENTS.nh38!)).toMatchObject({ fit: 'ok', notes: [] });
  });

  it('les calibres à date demandent une adaptation sans guichet', () => {
    const fit = movementFit(sized(38, 10.5), MOVEMENTS.nh35!);
    expect(fit.fit).toBe('adapt');
    expect(fit.notes).toEqual(['Date masquée : le cadran n’a pas de guichet.']);
  });

  it('un petit boîtier fin refuse les NH3x avec leurs raisons', () => {
    const fit = movementFit(sized(30, 8.5), MOVEMENTS.nh38!);
    expect(fit.fit).toBe('no');
    expect(fit.notes[0]).toMatch(/trop étroit/);
    expect(fit.notes[1]).toBe('Boîtier trop fin : 8,5 mm, il en faut au moins 10 mm.');
  });

  it('une grande ouverture demande un cadran plus grand', () => {
    const fit = movementFit(sized(44, 12, 'open'), MOVEMENTS.nh38!);
    expect(fit.fit).toBe('adapt');
    expect(fit.notes.join(' ')).toMatch(/cadran sur mesure|grand format/);
  });

  it('une couronne déplacée pivote le mouvement', () => {
    const config = sized(38, 10.5);
    const fit = movementFit(
      { ...config, crown: { ...config.crown, position: '4h' } },
      MOVEMENTS.nh38!,
    );
    expect(fit.notes).toEqual(['Couronne à 4 h : mouvement pivoté, cadran percé en conséquence.']);
  });

  it('le quartz reste à vérifier et les mieux adaptés viennent en premier', () => {
    const list = compatibleMovements(sized(38, 10.5));
    expect(list.map((item) => item.movement.id)).toEqual(['nh38', 'nh35', 'nh36', 'quartz']);
    expect(list.at(-1)!.fit).toBe('check');
  });
});

import { expect, it } from 'vitest';
import { bezierGuide, easeC2 } from './case-guides';

it('matches endpoint heights, tangents and curvature while changing dome', () => {
  const a = { value: 8, slope: -0.1, curvature: -0.025 },
    b = { value: 1.3, slope: 0, curvature: 0 };
  for (const bulge of [0, 0.7]) {
    const curve = bezierGuide(14, 24, a, b);
    const dome = bezierGuide(14, 24, a, b, bulge);
    for (const [y, target] of [
      [14, a],
      [24, b],
    ] as const) {
      const actual = dome.at(y);
      expect(actual.value).toBeCloseTo(target.value, 10);
      expect(actual.slope).toBeCloseTo(target.slope, 10);
      expect(actual.curvature).toBeCloseTo(target.curvature, 10);
    }
    expect(dome.value(19) - curve.value(19)).toBeCloseTo(bulge, 10);
  }
});

it('joins the silhouette easing to a constant with zero slope and curvature', () => {
  const h = 0.0001;
  for (const y of [0, 1]) {
    expect((easeC2(y + h) - easeC2(y - h)) / (2 * h)).toBeCloseTo(0, 5);
    expect((easeC2(y + h) - 2 * easeC2(y) + easeC2(y - h)) / (h * h)).toBeCloseTo(0, 2);
  }
});

/** Metric guide curves shared by the silhouette, longitudinal profile and section sweep. */
export interface CurveJet {
  value: number;
  slope: number;
  curvature: number;
}
const clip = (v: number) => Math.max(0, Math.min(1, v));

/** Quintic Bézier easing: position, tangent and curvature match a constant at both ends. */
export function easeC2(value: number): number {
  const t = clip(value);
  return t * t * t * (10 + t * (-15 + 6 * t));
}

/** A Bézier guide with linear abscissa and prescribed endpoint jets.
 * Matching second derivatives makes the longitudinal profile C2 at its roots.
 * The elevated polynomial is precompiled once for the hot surface evaluator. */
export function bezierGuide(start: number, end: number, a: CurveJet, b: CurveJet, bulge = 0) {
  const span = Math.max(0.01, end - start);
  const controls = [
    a.value,
    a.value + (a.slope * span) / 5,
    a.value + (2 * a.slope * span) / 5 + (a.curvature * span * span) / 20,
    b.value - (2 * b.slope * span) / 5 + (b.curvature * span * span) / 20,
    b.value - (b.slope * span) / 5,
    b.value,
  ];
  // Elevate to degree six. Its middle control is free without changing either
  // endpoint's value, slope or curvature; this is the visible dome control.
  const points = [
    controls[0]!,
    ...Array.from({ length: 5 }, (_, j) => {
      const i = j + 1;
      return (i / 6) * controls[i - 1]! + (1 - i / 6) * controls[i]!;
    }),
    controls[5]!,
  ];
  points[3]! += bulge * 3.2;
  const polynomial = (controls: number[]) => {
    const differences = [...controls],
      coefficients: number[] = [];
    let binomial = 1;
    for (let k = 0; k < controls.length; k++) {
      coefficients.push(differences[0]! * binomial);
      for (let i = 0; i < controls.length - k - 1; i++)
        differences[i] = differences[i + 1]! - differences[i]!;
      binomial *= (controls.length - 1 - k) / (k + 1);
    }
    return (t: number) => {
      let value = coefficients[coefficients.length - 1]!;
      for (let i = coefficients.length - 2; i >= 0; i--) value = value * t + coefficients[i]!;
      return value;
    };
  };
  const first = points.slice(0, -1).map((v, i) => (6 * (points[i + 1]! - v)) / span);
  const second = first.slice(0, -1).map((v, i) => (5 * (first[i + 1]! - v)) / span);
  const valueAt = polynomial(points),
    slopeAt = polynomial(first),
    curvatureAt = polynomial(second);
  return {
    value: (y: number) => valueAt(clip((y - start) / span)),
    start,
    end,
    points,
    at(y: number): CurveJet {
      const t = clip((y - start) / span);
      return {
        value: valueAt(t),
        slope: slopeAt(t),
        curvature: curvatureAt(t),
      };
    },
  };
}

export interface Guide {
  value: (y: number) => number;
  at: (y: number) => CurveJet;
  start: number;
  end: number;
}

/**
 * Domed longitudinal guide: the taut guide is blended with a power curve that holds
 * the root height and rolls over towards the tip. Both curves leave the root with
 * zero slope and curvature, so the blend stays C2 there. The descent is monotonic:
 * it never rises above the root nor dips below the tip, whatever the amount.
 */
export function domedGuide(
  taut: Guide,
  from: number,
  to: number,
  amount: number,
  power = 3,
): Guide {
  const w = clip(amount),
    span = Math.max(0.01, taut.end - taut.start),
    drop = to - from;
  const at = (y: number): CurveJet => {
    const base = taut.at(y);
    if (!w) return base;
    const u = clip((y - taut.start) / span);
    const dome = {
      value: from + drop * u ** power,
      slope: (drop * power * u ** (power - 1)) / span,
      curvature: (drop * power * (power - 1) * u ** (power - 2)) / (span * span),
    };
    return {
      value: base.value + (dome.value - base.value) * w,
      slope: base.slope + (dome.slope - base.slope) * w,
      curvature: base.curvature + (dome.curvature - base.curvature) * w,
    };
  };
  return { value: (y) => at(y).value, at, start: taut.start, end: taut.end };
}

export function sampleJet(fn: (y: number) => number, y: number): CurveJet {
  const h = 0.02,
    value = fn(y),
    before = fn(y - h),
    after = fn(y + h);
  return {
    value,
    slope: (after - before) / (2 * h),
    curvature: (after - 2 * value + before) / (h * h),
  };
}

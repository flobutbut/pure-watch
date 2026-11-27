export interface OutlinePoint {
  x: number;
  y: number;
}

/** Periodic cubic B-spline sampled by arc length. The tangent used for the edge
 * sweep comes from this very curve, rather than the marching-grid gradient. */
export function guidedOutline(input: readonly OutlinePoint[], spacing: number) {
  const lengths = input.map((p, i) =>
    Math.hypot(p.x - input[(i + 1) % input.length]!.x, p.y - input[(i + 1) % input.length]!.y),
  );
  const length = lengths.reduce((a, b) => a + b, 0),
    count = Math.max(24, Math.ceil(length / spacing));
  const controls: OutlinePoint[] = [];
  let edge = 0,
    covered = 0;
  for (let i = 0; i < count; i++) {
    const distance = (i * length) / count;
    while (edge < input.length - 1 && covered + lengths[edge]! < distance)
      covered += lengths[edge++]!;
    const a = input[edge]!,
      b = input[(edge + 1) % input.length]!,
      t = (distance - covered) / lengths[edge]!;
    controls.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  const result: (OutlinePoint & { nx: number; ny: number })[] = [];
  for (let i = 0; i < count; i++) {
    const previous = controls[(i + count - 1) % count]!,
      current = controls[i]!,
      next = controls[(i + 1) % count]!,
      after = controls[(i + 2) % count]!;
    const ax = next.x - previous.x,
      ay = next.y - previous.y,
      bx = after.x - current.x,
      by = after.y - current.y;
    const turn = Math.acos(
      Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)))),
    );
    const steps = Math.max(1, Math.min(4, Math.ceil(turn / 0.14)));
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        u = 1 - t;
      const weights = [
        u ** 3 / 6,
        (3 * t ** 3 - 6 * t * t + 4) / 6,
        (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6,
        t ** 3 / 6,
      ];
      const derivatives = [
        (-u * u) / 2,
        (9 * t * t - 12 * t) / 6,
        (-9 * t * t + 6 * t + 3) / 6,
        (t * t) / 2,
      ];
      let x = 0,
        y = 0,
        dx = 0,
        dy = 0;
      for (let k = 0; k < 4; k++) {
        const p = controls[(i + k + count - 1) % count]!;
        x += weights[k]! * p.x;
        y += weights[k]! * p.y;
        dx += derivatives[k]! * p.x;
        dy += derivatives[k]! * p.y;
      }
      const norm = Math.hypot(dx, dy);
      result.push({ x, y, nx: dy / norm, ny: -dx / norm });
    }
  }
  return result;
}

/** Earcut may omit collinear boundary vertices. Restore these exact boundary
 * segments by splitting their incident face, rather than bowing straight edges. */
export function restoreBoundaryVertices(faces: number[][], loops: readonly number[][]): number[][] {
  const used = new Set(faces.flat()),
    output = [...faces];
  for (const loop of loops) {
    const first = loop.findIndex((id) => used.has(id));
    if (first < 0) throw new Error('Untriangulated case boundary');
    let a = loop[first]!,
      pending: number[] = [];
    for (let j = 1; j <= loop.length; j++) {
      const b = loop[(first + j) % loop.length]!;
      if (!used.has(b)) {
        pending.push(b);
        continue;
      }
      if (pending.length) {
        const faceIndex = output.findIndex((f) => f.includes(a) && f.includes(b));
        if (faceIndex < 0) throw new Error('Missing case boundary edge');
        const face = output[faceIndex]!,
          ai = face.indexOf(a),
          forward = face[(ai + 1) % 3] === b;
        const opposite = face.find((id) => id !== a && id !== b)!;
        const chain = [a, ...pending, b];
        const replacement = chain
          .slice(0, -1)
          .map((id, i) =>
            forward ? [id, chain[i + 1]!, opposite] : [chain[i + 1]!, id, opposite],
          );
        output[faceIndex] = replacement[0]!;
        output.push(...replacement.slice(1));
        pending = [];
      }
      a = b;
    }
  }
  return output;
}

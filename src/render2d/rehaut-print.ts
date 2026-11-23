/** Physical XY artwork projected onto the shaped, inclined rehaut surface. */
import type { WatchConfig } from '../core/config/types';
import { effectiveRehautScale, rehautColor } from '../core/config/rehaut';
import { contourExtents, dialContourFactor } from '../core/geometry/dial-shape';
import type { WatchDimensions } from '../core/geometry/dimensions';
import { inkForDial } from './dial-print';

export function rehautPrintExtent(d: WatchDimensions): number {
  return d.openingRadius * d.dialScale * contourExtents(d.dialShape).max * 1.01;
}

export function rehautPrintSvg(config: WatchConfig, d: WatchDimensions): string {
  const scale = effectiveRehautScale(config);
  const extent = rehautPrintExtent(d);
  const width = d.openingRadius - d.dialRadius;
  const minWidth = width * d.dialScale * contourExtents(d.dialShape).min;
  const stroke = minWidth * 0.055;
  const f = (n: number) => n.toFixed(4);
  const point = (minute: number, fraction: number) => {
    const a = (minute / 60) * Math.PI * 2;
    const r = (d.openingRadius - width * fraction) * dialContourFactor(d, Math.PI / 2 - a);
    return [r * Math.sin(a), -r * Math.cos(a)] as const;
  };
  const line = (minute: number, major: boolean) => {
    const [x1, y1] = point(minute, 0.09);
    const [x2, y2] = point(minute, major ? 0.36 : 0.24);
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${f(stroke * (major ? 1.5 : 1))}"/>`;
  };
  const label = (minute: number, value: number, small = false) => {
    const [x, y] = point(minute, 0.67);
    const angle = minute * 6;
    const rotate = angle > 90 && angle < 270 ? angle + 180 : angle;
    return `<text x="${f(x)}" y="${f(y)}" font-size="${f(minWidth * (small ? 0.35 : 0.43))}" transform="rotate(${f(rotate)} ${f(x)} ${f(y)})">${value}</text>`;
  };
  const marks: string[] = [];
  if (scale === 'minutes' || scale === 'five-minute') {
    for (let m = 0; m < 60; m++) marks.push(line(m, m % 5 === 0));
    if (scale === 'five-minute') for (let m = 0; m < 60; m += 5) marks.push(label(m, m || 60));
  } else if (scale === '24h') {
    for (let h = 0; h < 24; h++) {
      marks.push(line(h * 2.5, h % 2 === 0));
      if (h % 2 === 0) marks.push(label(h * 2.5, h || 24));
    }
  } else if (scale === 'tachymeter') {
    for (const value of [
      500, 400, 300, 250, 200, 180, 160, 140, 120, 110, 100, 90, 80, 75, 70, 65, 60,
    ]) {
      const minute = 3600 / value;
      marks.push(line(minute, true), label(minute, value, true));
    }
  }
  const ink = inkForDial(rehautColor(config));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="${-extent} ${-extent} ${extent * 2} ${extent * 2}"><g stroke="${ink}" fill="${ink}" stroke-linecap="round"><g fill="none">${marks.filter((m) => m.startsWith('<line')).join('')}</g><g stroke="none" font-family="Arial, sans-serif" font-weight="500" text-anchor="middle" dominant-baseline="central">${marks.filter((m) => m.startsWith('<text')).join('')}</g></g></svg>`;
}

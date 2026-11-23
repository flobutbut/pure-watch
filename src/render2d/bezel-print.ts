/** Artwork in physical millimetres, projected onto the flat rotating insert. */
import type { WatchConfig } from '../core/config/types';
import { bezelScale } from '../core/config/bezel';
import { inkForDial } from './dial-print';

export function bezelPrintSvg(config: WatchConfig, inner: number, outer: number): string {
  const width = outer - inner;
  const extent = outer * 1.01;
  const ink = inkForDial(config.bezel.color);
  const scale = bezelScale(config);
  const marks: string[] = [];
  const f = (n: number) => n.toFixed(4);
  const point = (angle: number, radius: number) => [
    radius * Math.sin(angle),
    -radius * Math.cos(angle),
  ];
  function tick(index: number, count: number, major: boolean) {
    const a = (index / count) * Math.PI * 2;
    const [x1, y1] = point(a, outer - width * 0.08);
    const [x2, y2] = point(a, outer - width * (major ? 0.3 : 0.22));
    marks.push(
      `<path d="M${f(x1!)} ${f(y1!)}L${f(x2!)} ${f(y2!)}" stroke="${ink}" stroke-width="${f(width * (major ? 0.055 : 0.035))}"/>`,
    );
  }
  function label(index: number, count: number, value: number) {
    const angle = (index / count) * 360;
    const [x, y] = point((angle * Math.PI) / 180, outer - width * 0.64);
    const turn = angle > 90 && angle < 270 ? angle + 180 : angle;
    marks.push(
      `<text x="${f(x!)}" y="${f(y!)}" transform="rotate(${turn} ${f(x!)} ${f(y!)})">${value}</text>`,
    );
  }
  if (scale === 'dive-60') {
    for (let m = 1; m < 60; m++) {
      if (m <= 15 || m % 5 === 0) tick(m, 60, m % 5 === 0);
      if (m % 10 === 0) label(m, 60, m);
    }
    const y = -outer + width * 0.12;
    marks.push(
      `<path d="M0 ${f(y + width * 0.7)}L${f(-width * 0.28)} ${f(y)}H${f(width * 0.28)}Z"/>`,
    );
  } else {
    const count = scale === '12h' ? 12 : 24;
    for (let h = 0; h < count; h++) {
      tick(h, count, true);
      if (count === 12 || h % 2 === 0) label(h, count, h || count);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="${-extent} ${-extent} ${extent * 2} ${extent * 2}"><g fill="${ink}" stroke-linecap="round" font-family="Arial, sans-serif" font-size="${f(width * 0.6)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${marks.join('')}</g></svg>`;
}

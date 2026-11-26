import { smallSeconds } from '../../core/config/small-seconds';
import { chronograph } from '../../core/config/chronograph';
import { powerReserve } from '../../core/config/power-reserve';
import type { WatchConfig } from '../../core/config/types';
import { dialSurface, indexAt } from '../../core/config/details';
import { indexColor } from '../../core/config/colors';
import { hasIntrinsicColor } from '../../core/config/dial';
import { isDialPatternFinish } from '../../render3d/dial-patterns';
import { SCALE_LABELS } from '../colors/scale-labels';
import { DETAIL_SETTINGS } from '../colors/detail-settings';
import type { Locale } from '../../core/i18n/locale';
import type { Trait } from './identity';
import { subdialAppearance, reserveAppearance } from '../../core/config/subdials';

/** Shared by the identity card and the AI-generation brief. */
export function detailTraits(row: string, config: WatchConfig, locale: Locale): Trait[] {
  const d = config.details;
  if (!d) return [];
  const m = DETAIL_SETTINGS[locale];
  const traits: Trait[] = [];
  const percent = (value: number) => `${Math.round(value * 100)} %`;
  const color = (label: string, value: string | undefined) => {
    if (value !== undefined)
      traits.push({
        label,
        value: value === 'auto' ? m.auto : value,
        ...(value === 'auto' ? {} : { swatch: value }),
      });
  };
  if (
    row === 'chapter-ring' &&
    config.dial.chapterRing === 'dots' &&
    d.chapterRing?.dotSize !== undefined
  ) {
    traits.push({
      label: locale === 'fr' ? 'Taille des points' : 'Dot size',
      value: percent(d.chapterRing.dotSize),
    });
  }
  if (row === 'chapter-ring' && config.dial.chapterRing !== 'none' && d.chapterRing) {
    const labels = SCALE_LABELS[locale];
    for (const [key, label] of [
      ['length', labels.length],
      ['lineWidth', labels.width],
      ['radius', labels.radius],
    ] as const)
      if (
        d.chapterRing[key] !== undefined &&
        (config.dial.chapterRing !== 'dots' || key === 'radius')
      )
        traits.push({ label, value: percent(d.chapterRing[key]!) });
    if (d.chapterRing.accentAt && d.chapterRing.accentAt !== 'none') {
      traits.push({
        label: labels.accents,
        value: d.chapterRing.accentAt === 'zero' ? labels.zero : labels.quarters,
      });
      color(labels.accent, d.chapterRing.accent);
    }
  }
  if (
    ((row === 'small-seconds' && smallSeconds(config)) ||
      (row === 'chronograph' && chronograph(config))) &&
    d.subdials
  ) {
    const mini = subdialAppearance(config);
    color(locale === 'fr' ? 'Couleur des sous-cadrans' : 'Sub-dial colour', mini.color);
    color(m.miniInk, d.subdials?.ink);
    if (mini.customFinish) traits.push(...detailTraits('dial-finish', mini.config, locale));
  }
  if (row === 'power-reserve' && powerReserve(config) && d.reserve) {
    const mini = reserveAppearance(config);
    if (mini.customColor)
      color(locale === 'fr' ? 'Couleur du fond de réserve' : 'Reserve surface colour', mini.color);
    if (mini.customFinish) traits.push(...detailTraits('dial-finish', mini.config, locale));
  }
  if (row === 'dial-finish' && d.dial && !hasIntrinsicColor(config.dial.finish)) {
    const surface = dialSurface(config);
    if (d.dial.fume !== undefined || surface.fume > 0)
      traits.push({ label: m.fume, value: percent(surface.fume) });
    if (surface.fume > 0) color(m.edge, d.dial.edgeColor);
    if (config.dial.finish === 'grained' || isDialPatternFinish(config.dial.finish)) {
      for (const [key, label] of [
        ['grainSize', config.dial.finish === 'grained' ? m.grainSize : m.motifSize],
        ['grainDepth', m.depth],
        ['grainRoughness', m.roughness],
      ] as const)
        if (d.dial[key] !== undefined) traits.push({ label, value: percent(surface[key]) });
    }
  }
  if (row === 'rehaut-scale' && d.rehaut) {
    color(m.ink, d.rehaut.ink);
    if (d.rehaut.accentAt && d.rehaut.accentAt !== 'none') {
      traits.push({ label: m.accentAt, value: d.rehaut.accentAt === 'zero' ? m.zero : m.quarters });
      color(m.accent, d.rehaut.accent);
    }
    if (d.rehaut.labelSize !== undefined)
      traits.push({ label: m.labelSize, value: percent(d.rehaut.labelSize) });
    if (d.rehaut.tickLength !== undefined)
      traits.push({ label: SCALE_LABELS[locale].length, value: percent(d.rehaut.tickLength) });
    if (d.rehaut.lineWidth !== undefined)
      traits.push({ label: m.lineWidth, value: percent(d.rehaut.lineWidth) });
  }
  if (row === 'numerals' && d.hourMarkers) {
    const names =
      locale === 'fr'
        ? { numeral: 'Chiffre', index: 'Index', none: 'Aucun' }
        : { numeral: 'Numeral', index: 'Index', none: 'None' };
    for (const [hour, kind] of Object.entries(d.hourMarkers).sort(
      ([a], [b]) => (Number(a) % 12) - (Number(b) % 12),
    ))
      traits.push({
        label: `${locale === 'fr' ? 'Repère' : 'Marker'} · ${hour} h`,
        value: names[kind],
      });
  }
  if (row === 'indices' && d.indices) {
    for (const hour of Object.keys(d.indices).sort((a, b) => (Number(a) % 12) - (Number(b) % 12))) {
      const part = indexAt(config, Number(hour) % 12);
      const i = part.dial.indices;
      traits.push({
        label: `${m.individual} · ${hour} h`,
        value: `${m.styles[i.style] ?? i.style} ; ${m.finishes[i.finish] ?? i.finish} ; ${m.length} ${percent(i.indexLength)} ; ${m.width} ${percent(i.indexWidth)} ; ${m.radius} ${percent(i.indexRadius)} ; ${i.lume ?? m.noLume}`,
        swatch: indexColor(part),
      });
    }
  }
  if (row === 'power-reserve' && powerReserve(config) && d.reserve) {
    if (d.reserve.size !== undefined)
      traits.push({ label: m.size, value: percent(d.reserve.size) });
    if (d.reserve.offsetX !== undefined)
      traits.push({ label: m.x, value: percent(d.reserve.offsetX) });
    if (d.reserve.offsetY !== undefined)
      traits.push({ label: m.y, value: percent(d.reserve.offsetY) });
    color(m.reserveInk, d.reserve.ink);
    color(m.low, d.reserve.lowColor);
    if (d.reserve.label !== undefined)
      traits.push({
        label: m.label,
        value: d.reserve.label || (locale === 'fr' ? 'Aucune inscription' : 'No inscription'),
      });
  }
  return traits;
}

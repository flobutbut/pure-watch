import type { ChapterMarkDetails, ChapterMarkGroup, ChapterRingDetails } from './details';

export const CHAPTER_TICK_EDGE = 0.985;
export const CHAPTER_DOT_POSITION = 0.955;

export function chapterTickStart(style: string, group: ChapterMarkGroup): number {
  if (style === 'ticks') return group === 'major' ? 0.9 : 0.94;
  return style === 'five-minute' ? 0.91 : 0.93;
}

/** Part de l’espace entre l’extrémité extérieure de la graduation et le centre. */
export function chapterMarkSpan(style: string, group: ChapterMarkGroup, mark: ChapterMarkDetails) {
  return (
    mark.span ??
    ((CHAPTER_TICK_EDGE - chapterTickStart(style, group)) * (mark.length ?? 1)) / CHAPTER_TICK_EDGE
  );
}

/** Position de référence du curseur, mesurée depuis le centre. */
export function chapterTrackPosition(style: string, track: ChapterRingDetails) {
  const reference = style === 'dots' ? CHAPTER_DOT_POSITION : CHAPTER_TICK_EDGE;
  return track.position ?? (track.radius ?? 1) * reference;
}

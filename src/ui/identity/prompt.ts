/**
 * Prompt de génération : la fiche d'identité réécrite pour un modèle d'IA, avec le lien de la
 * configuration pour qu'un agent muni d'un navigateur aille en faire une capture.
 */
import type { RowDef } from '../../core/catalog/types';
import type { WatchConfig } from '../../core/config/types';
import type { Locale } from '../../core/i18n/locale';
import { MESSAGES } from '../../core/i18n/messages';
import { identitySections, type Trait } from './identity';

/** One line per trait; the exact colour travels as hex, which a generator can follow. */
function traitLine(trait: Trait, colon: string): string {
  const details = [trait.swatch?.toUpperCase(), trait.reference].filter(Boolean);
  return `- ${trait.label}${colon}${trait.value}${details.length ? ` (${details.join(', ')})` : ''}`;
}

export function generationPrompt(
  rows: readonly RowDef[],
  config: WatchConfig,
  url: string,
  locale: Locale = 'fr',
): string {
  const p = MESSAGES[locale].prompt;
  const sheet = identitySections(rows, config, locale)
    .map((section) =>
      [`### ${section.title}`, ...section.traits.map((trait) => traitLine(trait, p.colon))].join(
        '\n',
      ),
    )
    .join('\n\n');
  return [
    p.task,
    `## ${p.referenceTitle}`,
    url,
    p.reference,
    `## ${p.sheetTitle}`,
    sheet,
    `## ${p.renderTitle}`,
    p.render.map((line) => `- ${line}`).join('\n'),
  ].join('\n\n');
}

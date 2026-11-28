const fr = {
  style: 'Style des graduations',
  previous: 'Précédent',
  next: 'Suivant',
  hidden:
    'Aucune graduation pour le moment. Les réglages sont conservés pour le prochain style choisi.',
  length: 'Longueur des traits',
  markLength: 'Longueur',
  markWidth: 'Épaisseur',
  marks: {
    minor: {
      name: 'Petites graduations',
      length: 'Longueur des petites graduations',
      lineWidth: 'Épaisseur des petites graduations',
      dotSize: 'Taille des petits points',
    },
    major: {
      name: 'Grandes graduations',
      length: 'Longueur des grandes graduations',
      lineWidth: 'Épaisseur des grandes graduations',
      dotSize: 'Taille des grands points',
    },
  },
  radius: 'Position de la piste',
  accents: 'Repères accentués',
  none: 'Aucun',
  zero: 'Repère de départ',
  quarters: 'Les quatre quarts',
  accent: 'Couleur des repères accentués',
  auto: 'Automatique',
};
export const SCALE_LABELS: Record<'fr' | 'en', typeof fr> = {
  fr,
  en: {
    style: 'Graduation style',
    previous: 'Previous',
    next: 'Next',
    hidden: 'There are no graduations yet. These settings are kept for the next style you choose.',
    length: 'Tick length',
    markLength: 'Length',
    markWidth: 'Weight',
    marks: {
      minor: {
        name: 'Minute marks',
        length: 'Minute mark length',
        lineWidth: 'Minute mark weight',
        dotSize: 'Minute dot size',
      },
      major: {
        name: 'Five-minute marks',
        length: 'Five-minute mark length',
        lineWidth: 'Five-minute mark weight',
        dotSize: 'Five-minute dot size',
      },
    },
    radius: 'Track position',
    accents: 'Accented markers',
    none: 'None',
    zero: 'Starting marker',
    quarters: 'Four quarters',
    accent: 'Accent marker colour',
    auto: 'Automatic',
  },
};

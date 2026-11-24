# Design system

L'interface d'Épure repose sur une petite base commune : des jetons, un bouton, un panneau.
Tout nouvel élément d'interface part de là plutôt que de redéfinir ses propres valeurs.

## Jetons (`src/app.css`)

| Famille   | Jetons                                                                                  | Usage                                                              |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Arrondis  | `--radius-xs` 4 px · `--radius-s` 10 px · `--radius-m` 14 px · `--radius-l` 22 px · `--radius-pill` | touches, boutons, groupes et cartes, panneaux, pilules             |
| Texte     | `--text-3xs` 8 px · `--text-2xs` 9 px · `--text-xs` 10 px · `--text-s` 11 px · `--text-m` 12 px · `--text-title` 19 px | aides, sur-titres, légendes, libellés, texte courant, titres       |
| Contrôles | `--control-height` 40 px                                                                | hauteur minimale d'une cible tactile                               |
| Teintes   | `--ink`, `--ink-soft`, `--ink-faint`, `--veil` | encre pleine, textes secondaires, repères inactifs, voile ; fixés par l'ambiance (cadran) puis par les panneaux |

Les teintes dérivées (contours, fonds légers) se calculent dans chaque composant avec
`color-mix()` à partir de `currentColor` ou de `--ink` : une variable déclarée sur `:root`
figerait l'encre de la page et ignorerait celle des panneaux.

### Lisibilité sur toutes les couleurs de cadran

La couleur du cadran fixe le fond et le ton (clair ou sombre) de toute l'interface
(`src/ui/ambience.ts`). Quelle que soit la couleur choisie :

- l'encre pleine et `--ink-soft` lisent à **4,5:1** au moins sur le fond, `--ink-faint` à
  **3:1** ;
- le ton suit la clarté du cadran, sauf quand l'encre retenue lirait mal : un orange ou
  un magenta vifs passent alors en ton clair ; les rares teintes que ni l'une ni l'autre
  encre ne lit assez s'éloignent légèrement de l'encre ;
- les panneaux gardent deux tons fixes ; leur `--ink-soft` (66 % d'encre) lit à 4,8:1 au
  moins.

Un texte secondaire prend `color: var(--ink-soft)`, jamais une opacité : l'opacité ne
connaît pas le fond. `src/ui/ambience.test.ts` balaie le nuancier RAL et l'espace des
couleurs pour tenir ces seuils.

Les tailles de glyphes (×, ↺, chiffres d'aide) et les cercles (`50%`) restent hors échelle.

## Couches CSS

`app.css` déclare `@layer base, kit;` :

- `base` : le vocabulaire commun des panneaux (police et couleur héritées, anneau de focus) ;
- `kit` : les composants du design system (`Button`) ;
- hors couche : les règles propres à chaque composant, qui l'emportent toujours. Un parent
  ajuste la mise en page d'un bouton avec `:global(.button)` (largeur, colonne, alignement)
  sans jamais en redéfinir l'apparence.

## Composants (`src/ui/kit`, `src/ui/sheet`)

### `Button`

| Variante  | Apparence                         | Exemples                                                    |
| --------- | --------------------------------- | ----------------------------------------------------------- |
| `control` | contour sur fond léger (défaut)   | finitions, luminescence, écriture des chiffres, capture     |
| `primary` | plein, à l'encre                  | Copier le lien, Copier le prompt                            |
| `quiet`   | sans contour, fond au survol      | onglets de la fiche, réglage de la lunette, Plus d'options  |

- `size="compact"` : 36 px de haut, pour les barres d'onglets et la commande de lunette.
- État choisi : `chosen`, ou à défaut `aria-pressed` / `aria-selected` — un seul rendu
  (contour et anneau à l'encre, fond à 12 %) dans toute l'interface.
- Désactivé : opacité 0,45. Occupé (`aria-busy`) : curseur d'attente.

### `RestoreButton`

« ↺ Rétablir », au pied des panneaux de réglage (couleurs, dimensions).

### `Sheet`

Le seul panneau de l'interface : en-tête (sur-titre facultatif, titre, croix), barre
d'outils, corps défilant, pied.

| Placement | Position                                    | Utilisé par                          |
| --------- | ------------------------------------------- | ------------------------------------ |
| `side`    | centré à droite                             | couleurs, dimensions                 |
| `stage`   | sous les outils de la vue 3D                | fiche d'identité, partage            |
| `center`  | au milieu, voile flouté                     | À propos                             |

Sous 760 px de large, `side` et `stage` deviennent une feuille en bas d'écran.

`modal` : le panneau prend le clavier et rend le focus à la fermeture. Avec
`inertPage={false}`, la montre reste manipulable à côté (couleurs, dimensions).

### Fermeture (`src/ui/sheet/dismiss.ts`)

Tout panneau se ferme par **Échap**, par **Espace** ou par la **croix**. Espace ne ferme
pas depuis un élément où elle a déjà un sens (champ, bouton, lien, onglet, curseur).
La touche ferme l'overlay qui a le focus : un panneau à côté de la montre se ferme seul,
puis la vue 3D. Fermé de l'intérieur, un panneau rend le focus à ce qui l'avait avant.

## Hors du kit, à dessein

Les commandes posées sur la scène gardent leur dessin propre : outils ronds de la vue 3D,
boutons de couleur des lignes de la grille, bouton Partager de l'en-tête, pastilles de
teinte et spectre du panneau couleur. Ils utilisent néanmoins les jetons d'arrondi et de
texte.

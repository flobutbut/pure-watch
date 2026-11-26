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
| `control` | contour sur fond léger (défaut)   | finitions, matières, luminescence, écriture des chiffres, capture |
| `primary` | plein, à l'encre                  | Copier le lien, Copier le prompt                            |
| `quiet`   | sans contour, fond au survol      | onglets de la fiche, réglage de la lunette, Plus d'options  |

- `size="compact"` : 36 px de haut, pour les barres d'onglets et la commande de lunette.
- État choisi : `chosen`, ou à défaut `aria-pressed` / `aria-selected` — un seul rendu
  (contour et anneau à l'encre, fond à 12 %) dans toute l'interface.
- Désactivé : opacité 0,45. Occupé (`aria-busy`) : curseur d'attente.

### `RestoreButton`

« ↺ Rétablir », au pied des panneaux de réglage (couleurs, dimensions).

### `SegmentedControl`

Deux à quatre **modes exclusifs** aux libellés courts, côte à côte dans un même rail
(contour et fond légers, `--radius-m`). Le segment choisi reprend le rendu « choisi » de
`Button` ; les segments se partagent la largeur à parts égales.

- Sémantique `radiogroup` / `radio` + `aria-checked` : une seule tabulation pour le groupe,
  ←/→ (ou ↑/↓), Début et Fin changent le choix sans faire défiler la grille derrière.
- `label` donne le nom accessible ; un libellé visible se pose au-dessus avec
  `.section-label`.
- Exemples : Automatique / Couleur libre, Arabes / Romains, Sans insert / Luminescent,
  Hériter / Personnaliser, jonction des cornes, repères accentués du réhaut.

### `Checkbox`

Une **option isolée** que l'on coche ou non, à côté d'un texte qui la nomme : « Ne plus afficher
ce message ». La case native reste dans le flux (clavier, lecteurs d'écran, libellé cliquable) ;
la case dessinée prend les tons de l'encre : contour à 40 % de `currentColor`, fond plein
`--ink` et coche `--veil` une fois cochée, `--radius-xs`, 18 px, cible à `--control-height`.
Anneau de focus à l'encre, désactivée à 0,45 comme `Button`.

```svelte
<Checkbox bind:checked={hideWarning}>Ne plus afficher ce message</Checkbox>
```

Deux à quatre modes exclusifs restent une `SegmentedControl`, et un choix parmi plusieurs
options, un `ChoiceGroup`.

### `ChoiceGroup`

Au-delà de quatre options, ou quand une option porte un aperçu (pastille de finition,
pigment), les choix restent des boutons `Button` avec `aria-pressed`, regroupés sous un
libellé et renvoyés à la ligne. Exemples : forme et finition de la lunette, dessin des index,
heures des index (quatre colonnes). Aucun menu déroulant.

### Réglage de couleur : `ColorField` (`src/ui/colors`)

**Toute couleur d'un panneau passe par `ColorField`** — couleur principale d'un élément,
encre du réhaut, fumé, réserve de marche, index personnalisé. Toujours dans cet ordre :

1. un libellé (`.section-label`), omis seulement quand le titre du panneau nomme déjà la
   couleur et qu'il n'y a pas de mode ;
2. une `SegmentedControl` des modes : d'abord les couleurs qui en suivent une autre
   (« Automatique », « Encre du cadran », « Assortie aux aiguilles », « Assorti au cadran »,
   « Matière du boîtier »), en dernier « Couleur libre » (`CUSTOM`) ;
3. en couleur libre seulement :
   - les couleurs d'autres éléments de la montre à reprendre d'un geste (`matches`), en
     boutons `compact` précédés de leur pastille ;
   - le `ColorPicker` : teintes proposées, couleurs récentes, spectre, curseur de teinte et
     champ HEX replié dans « Avancé ».

Un mode lié **masque** le sélecteur au lieu de le griser. Sans `modes`, le réglage se réduit
au sélecteur (couleur toujours libre). Le sélecteur natif du système n'est pas utilisé, et
aucun panneau n'appelle `ColorPicker` directement.

```svelte
<ColorField
  label={t().colors.color}
  value={color}
  {presets}
  modes={[
    { value: 'match', label: t().colors.dialInk },
    { value: CUSTOM, label: t().colors.custom },
  ]}
  mode={matched ? 'match' : CUSTOM}
  onmode={chooseMode}
  matches={[{ label: t().colors.handsColor, color: handColor(config) }]}
  onchange={selectHex}
/>
```

### Réglage de matière : `MaterialField` (`src/ui/colors`)

Une **matière** décrit la substance d'un petit élément imprimé ou appliqué — d'abord les
chiffres. Elle ne se confond pas avec une **finition de surface** (soleillé, guilloché,
azuré…), qui décrit le motif d'une grande surface et se choisit dans un carrousel avec
l'aperçu rond du motif (`FinishPreview`).

Le catalogue vit dans `src/core/config/material.ts` (trois axes, schéma du lien, résolution)
et le rendu dans `MaterialLibrary.printed` : un seul endroit pour ajouter une matière.
Le réglage suit toujours cet ordre :

1. un libellé (`.section-label`) ;
2. s'il existe, le mode qui suit un autre élément (« Comme les index ») ou
   « Personnalisée », en `SegmentedControl` ; suivre **masque** le reste ;
3. la **matière** : Encre / Métal / Lumineux, en `SegmentedControl` ;
4. l'**effet** de cette matière, en boutons avec pastille : Mat ou Vernis en relief pour
   l'encre, Poli ou Brossé pour le métal (le luminescent n'en a pas) ;
5. la **teinte** : le `ColorField` du panneau pour l'encre (passé en `ink`), les teintes de
   métal (Acier, Or, Acier bleui, Noir) ou les pigments luminescents, avec l'aperçu
   nocturne.

`MaterialSwatch` dessine la pastille : reflet pour le vernis et le poli, stries pour le
brossé, moitiés jour et nuit avec un halo pour le luminescent. Changer de matière repart
de ses valeurs par défaut, en gardant la teinte de métal et le pigment déjà choisis.

```svelte
<MaterialField
  label={t().material.numerals}
  value={details.numerals ?? {}}
  resolved={numeralMaterial(watch)}
  follow={t().material.followIndices}
  ink={elementColor}
  {night}
  {onnight}
  onchange={(numerals) => (details = { ...details, numerals })}
/>
```

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

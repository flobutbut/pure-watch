# Épure — Plan d'action

> Établi à partir de `configurateur.md` — version 2 du plan, 22 novembre 2026.
> Estimations en **jours de travail concentré pour une personne**, à prendre comme des ordres de grandeur.

---

## 0. Décisions prises

| # | Décision | Conséquence |
|---|---|---|
| D1 | **Le produit final est en 3D partout** : cellules de la grille, montre centrale et vue plein écran | Une seule source de vérité visuelle : le moteur 3D. Le SVG ne sert plus qu'à décrire des formes (aiguilles, index, impression du cadran) |
| D2 | **Le prototype SVG est jetable** côté rendu | On ne soigne pas le rendu 2D ; on garde tout le reste (cœur, entrées, grille, accessibilité) |
| D3 | **« Ce qu'on ne voit pas n'existe pas »** : on ne charge que ce qui est visible, plus les variantes suivantes de la ligne active | Chargement et libération pilotés par la position dans la grille (§1.3) |
| D4 | **Un écran de chargement au lancement est acceptable**, et même cohérent avec l'esprit du produit | Le budget « ≤ 150 ko avant la première grille » de la spec est remplacé par un budget d'écran de chargement (§1.4) |
| D5 | **La taille = le diamètre du boîtier**, hors couronne (standard du marché) | Le diamètre du cadran en découle (boîtier − lunette, règle `range`) |
| D6 | **Direction artistique : élégant, moderne, flottant** ; animations **douces et rapides** | Traduction proposée au §1.5, à valider sur une maquette |

---

## 1. Architecture cible

### 1.1 Principe : un moteur 3D, deux façons de l'afficher

Dessiner 35 à 63 cellules en 3D **à chaque image** pendant le défilement coûterait trop cher sur mobile (appels de rendu, chauffe, batterie). Mais une cellule vue de face, qui ne fait que se déplacer dans la grille, **ne change pas d'apparence** : seule sa position change. D'où deux modes :

| Mode | Utilisé pour | Fonctionnement |
|---|---|---|
| **Instantané** | Toutes les cellules sauf la montre centrale | La pièce est rendue **une fois** en 3D (vraie lumière, vrais matériaux) dans le contexte WebGL partagé, puis gardée comme image (`ImageBitmap`). La grille ne déplace que des images : c'est aussi léger que du SVG, et c'est bien de la 3D |
| **Direct** | Montre centrale, vue plein écran | Rendu à chaque image : aiguilles qui tournent, reflets qui bougent légèrement (effet « flottant ») |

C'est le même principe que D3 appliqué au temps : **ce qui ne bouge pas n'est pas redessiné**.

Conséquence heureuse : l'ouverture de la vue plein écran devient un **simple mouvement de caméra** sur la montre centrale, déjà en 3D. Plus de fondu enchaîné 2D → 3D, plus de risque d'écran noir (§3.2 de la spec simplifié).

### 1.2 Un seul contexte WebGL

- Un seul `WebGLRenderer` pour toute la vie de la page (les navigateurs limitent le nombre de contextes à une quinzaine).
- Il sert à la fois à la montre centrale en direct et à la fabrication des instantanés, intercalés entre deux images (au plus 2 à 4 instantanés par image pour ne pas faire chuter la fluidité).
- Les instantanés sont produits à la taille réelle de la cellule × densité de l'écran (160 px × 2 = 320 px sur bureau).

### 1.3 Chargement guidé par la visibilité (D3)

**Ordre de priorité**, recalculé à chaque pas :

1. La montre centrale (toutes ses pièces).
2. Les cellules visibles de la ligne active.
3. Les **variantes suivantes et précédentes de la ligne active** (2 à 3 au-delà du bord de l'écran) : elles seront visibles au prochain pas.
4. Les cellules visibles des lignes voisines (±1, puis ±2).
5. La première cellule hors écran des lignes ±1 (prochain changement de ligne).

**Ce qui est chargé à chaque niveau** : la géométrie (glTF ou paramètres), les textures, puis l'instantané. Les instantanés sont mis en cache (mémoire + IndexedDB, clé = version du catalogue + paramètres dont dépend l'aperçu).

**Libération** : géométries et textures GPU libérées (`dispose()`) dès qu'elles ne servent plus à aucune cellule visible ni préchargée ; les instantanés, eux, restent en cache (quelques dizaines de ko chacun).

**Invalidation** : certains aperçus dépendent de la configuration (la ligne Couleur montre le cadran dans la finition choisie). Chaque ligne déclare de quels champs dépend son aperçu ; un changement de ces champs régénère uniquement les instantanés concernés.

### 1.4 Écran de chargement (D4)

- **Affiché immédiatement** : HTML et CSS en ligne dans la page, ≤ 15 ko, sans attendre le JavaScript.
- Il couvre : l'application, Three.js, l'environnement HDRI, le catalogue, puis les pièces et instantanés des niveaux 1 à 3 du §1.3.
- La grille apparaît quand la **ligne active est complète** ; le reste se charge derrière, sans bloquer.
- Pas de barre de progression technique : une animation sobre (par exemple la silhouette d'une montre qui se dessine), qui se fond dans la grille au lieu de disparaître d'un coup.
- **Budgets de départ** (à mesurer au prototype) : écran de chargement visible en ≤ 0,3 s ; grille utilisable en ≤ 2 s sur ordinateur, ≤ 4 s sur le téléphone de référence.
- Visites suivantes : tout vient du cache (PWA), l'écran ne fait qu'un passage bref.

### 1.5 Direction artistique (D6) — traduction proposée

À valider sur une maquette Figma avant de figer les jetons.

| Intention | Traduction proposée |
|---|---|
| **Élégant** | Peu d'éléments, beaucoup d'air ; palette restreinte (fond clair chaud proche du `#E5E5E3` actuel, une seule couleur d'accent) ; icônes au trait fin ; aucune ombre dure ni bordure épaisse |
| **Moderne** | Pas d'ornement ni d'effet skeuomorphe dans l'interface : seule la montre est riche, l'interface s'efface |
| **Flottant** | Les pièces ne reposent pas dans des disques gris : elles **flottent au-dessus du fond**, avec une ombre portée douce et diffuse, comme suspendues à 1–2 cm d'une table. Les lignes inactives semblent plus loin (échelle et opacité du §2.6, plus une ombre plus diffuse). La montre centrale « respire » : rotation très lente de 2–3° qui fait jouer les reflets |
| **Doux et rapide** | Durées courtes (150–250 ms, celles de la spec conviennent) mais courbes à **longue décélération**, sans à-coup au départ ; ressorts amortis sans rebond, sauf l'effet de bord. Une animation interrompue repart de sa position et de sa vitesse courantes, jamais d'un saut |

Le disque gris `#D9D9D9` de la spec (§2.2) devient donc une **zone de clic invisible** ; seul l'état focus reste dessiné (anneau fin).

---

## 2. Composants 3D : faits maison, générés par le code

Inchangé dans le principe : la combinatoire (tailles × formes × cornes × lunettes…) impose des pièces **paramétriques**, cohérentes entre elles et légères. Avec D1, c'est encore plus vrai : chaque pièce doit aussi être rendue seule, de face, en instantané de cellule.

| Pièce | Méthode | Prio |
|---|---|---|
| Boîtier rond, lunette lisse, cristal, couronne, fond | **Paramétrique** : profil en mm → révolution (`LatheGeometry`), chanfreins inclus | P0 |
| Boîtiers non ronds (coussin, tonneau, octogone, carré, Tank) | **Paramétrique** : contour (SVG Figma) → extrusion biseautée | P1 |
| Crans, cannelures, godrons | Révolution + **motif répété** (`InstancedMesh`) ou carte de normales | P1 |
| Aiguilles, index appliqués | **Extrusion des tracés SVG** Figma | P0 |
| Impression du cadran (piste, chiffres, textes, guichets), insert de lunette | **Texture générée depuis un SVG** (`CanvasTexture`, 2048 px) | P0 |
| Cornes, protège-couronne | **Blender**, avec cibles de déformation (longueur, courbure, entre-cornes) | P0 / P1 |
| Bracelet cuir, caoutchouc, NATO | **Paramétrique** : section balayée le long d'une courbe | P1 |
| Maillons, boucles, bracelet intégré | **Blender**, maillon instancié le long de la courbe | P2 |
| Mouvement visible (NH35, balancier « open heart ») | **Acheter / télécharger** puis simplifier | P2 |
| HDRI, textures (cuir, bois, pierres, carbone) | **Télécharger** (Poly Haven, ambientCG, CC0) ; paille : photo maison | P0 / P1 |

**Pipeline** :

```
Figma (SVG) ──► SVGO ──► catalogue ──┬──► extrusion aiguilles / index
                                     └──► textures d'impression (cadran, lunette)
Code (profils en mm) ──► révolution / extrusion ──► boîtier, lunette, cristal, couronne, bracelet
Blender ──► glTF ──► gltf-transform (meshopt + KTX2) ──► cornes, maillons, boucles
                          │
                          ▼
                 moteur 3D ──┬──► instantanés des cellules
                             └──► montre centrale et vue plein écran (direct)
```

La crédibilité viendra des **chanfreins**, des **matériaux** et de l'**environnement**, pas de la densité de triangles.

---

## 3. Phase 0 — Préparation (3 à 5 jours)

| # | Tâche | Livrable |
|---|---|---|
| 0.1 | Choisir le framework d'interface (recommandation : **Svelte 5**, empreinte légère ; Vue 3 en second choix) | Décision |
| 0.2 | Initialiser le dépôt : Vite + TypeScript strict + Vitest + Playwright + lint, `git init` | Dépôt qui compile |
| 0.3 | Arborescence du §9.2 de la spec ; `core/` n'importe rien du framework ni de Three.js | Squelette |
| 0.4 | Définir l'**interface de rendu de pièce** (`PartRenderer`) que le prototype SVG puis le moteur 3D implémenteront tous les deux (§4) | Type TypeScript |
| 0.5 | Nettoyer le Figma pour l'export (cadres 160 × 160 centrés, noms stables, variables) | Composants exportables |
| 0.6 | Script d'export Figma → SVG → SVGO | `npm run assets` |
| 0.7 | Catalogue P0 en JSON + schéma zod | `catalog.json` valide |

---

## 4. Phase 1 — Prototype de navigation en SVG (8 à 12 jours)

**But** : valider l'interaction en croix. Le rendu est volontairement sommaire.

**Ce qu'on garde pour le produit final** :

- `core/` : catalogue, réducteur de navigation, `WatchConfig`, horloge, tests.
- La **couche d'entrée unifiée** (clavier, molette, pavé tactile avec verrouillage d'axe, souris, tactile).
- La **grille** : positionnement, virtualisation, hiérarchie visuelle, animations, accessibilité.
- L'**interface `PartRenderer`** : la grille demande « l'image de la variante X de la ligne Y dans tel contexte » et ne sait pas si elle vient d'un SVG ou d'un instantané 3D.

**Ce qu'on jette** : l'implémentation SVG de `PartRenderer` (assemblage sommaire des exports Figma, sans finitions).

**Étapes** :

1. `core/` sans interface (2–3 j) : types, réducteur `step(...)`, gestion des bords, tests.
2. `PartRenderer` SVG minimal (1 j) : exports Figma bruts posés sur leurs contextes.
3. Grille (1–2 j) : `transform` uniquement, jetons du §2.2, échelle/opacité selon la distance, virtualisation.
4. Couche d'entrée unifiée (3–4 j) : seuils et verrouillage d'axe de la spec, **tactile inclus** dès maintenant.
5. Animations douces et rapides (1–2 j) : décélération longue, interruption sans saut, `prefers-reduced-motion`.
6. Accessibilité (1 j) : grille ARIA, focus itinérant, annonces.

**Critères de sortie** : navigation fluide à 60 i/s sur ordinateur et téléphone ; verrouillage d'axe sans dérive sur pavé tactile ; **test avec 3 à 5 personnes** : la navigation sans libellés est-elle comprise ?

---

## 5. Phase 2 — Moteur 3D et instantanés de cellules (15 à 20 jours)

C'est désormais **le chemin principal** du produit.

| # | Tâche | Jours |
|---|---|---|
| 2.1 | Renderer unique, environnement HDRI studio, caméra orthographique de face pour les instantanés | 2 |
| 2.2 | Pièces P0 : boîtier rond et cristal (révolution + chanfreins), cadran avec impression en texture, aiguilles et index extrudés, couronne | 5–6 |
| 2.3 | Cornes P0 dans Blender (2 variantes existantes dans le Figma) + pipeline glTF | 2–3 |
| 2.4 | Matériaux P0/P1 du §9.4 de la spec : acier brossé et poli, cadran mat / soleillé / iridescent, lume | 3 |
| 2.5 | `PartRenderer` 3D : production des instantanés, ombre portée douce « flottante », cache mémoire + IndexedDB, invalidation par dépendances | 2–3 |
| 2.6 | Ordonnanceur de chargement (§1.3) : priorités, préchargement de la ligne active, libération GPU | 2 |
| 2.7 | Montre centrale en direct : aiguilles animées à la cadence, « respiration » lente | 1 |
| 2.8 | Écran de chargement (§1.4) et fondu vers la grille | 1–2 |

**Mesures obligatoires** sur le téléphone de référence : temps de fabrication d'un instantané, fluidité pendant un pas qui déclenche des instantanés, mémoire GPU, temps jusqu'à la grille utilisable.

**Point de contrôle** : si un instantané coûte trop cher pour tenir la fluidité pendant les pas, augmenter le préchargement (niveau 3 du §1.3) pour qu'ils soient toujours prêts avant d'être nécessaires.

---

## 6. Phase 3 — Catalogue enrichi et règles (15 à 25 jours)

Comme le jalon 1 de la spec, avec des visuels 3D au lieu de SVG.

**Code** (8–12 j) : moteur de règles avec tests de propriétés ; lignes conditionnelles ; types `ordinal`, `palette`, `toggle`, `text` ; ligne Style ; lien de partage ; annuler / rétablir ; repères de groupe sur le bord.

**Contenu** (en parallèle) : la 3D paramétrique réduit fortement le volume de dessin, car couleurs, tailles, matières et finitions deviennent des **paramètres**, pas de nouveaux fichiers. Restent à dessiner : les formes d'aiguilles (6 → 16), d'index et de chiffres, les contours de boîtiers non ronds, les échelles de lunette. Ordre suggéré : finitions et couleurs de cadran → index et chiffres → aiguilles → trotteuse → lume → matières de boîtier → lunette → date / petite seconde / réserve de marche → styles.

**Critère** : ajouter une variante = un fichier (SVG ou glTF) + une entrée JSON, aucune ligne de code.

---

## 7. Phase 4 — Vue plein écran (10 à 15 jours)

Plus courte que prévu dans la spec grâce à D1 : la montre centrale est déjà en 3D.

- Agrandissement de la montre centrale + recul de la grille ; caméra de face → vue ¾ en un seul mouvement.
- Orbite avec inertie et limites, zoom, vues prédéfinies 1–5, réinitialisation.
- Mode nuit (lume émissif + bloom sélectif), 4 environnements, ombre de contact.
- Qualité adaptative (résolution dynamique), perte de contexte WebGL.
- Export PNG, bouton de partage.

---

## 8. Phase 5 — Mobile (6 à 10 jours)

La couche d'entrée tactile existe depuis la phase 1. Reste : mises en page portrait / paysage, zones de sécurité, zone morte du geste retour iOS, retour haptique, **PWA hors-ligne** (le cache d'instantanés de la phase 2 en est la base), `DeviceOrientation` pour l'iridescence, tests sur appareils réels.

---

## 9. Phase 6 — Compatibilité et exploration

- Mouvements NH35 / NH36 / NH38 et mode réaliste ; cadence par mouvement ; chronographe, GMT, phase de lune ; bracelets à maillons ; fond de boîte ; mouvement visible.
- Puis selon l'envie : calendrier perpétuel, tourbillon, manette, vidéo 360°.

Vérifier les fréquences marquées « à vérifier » (§7.2 de la spec) avant de publier le mode réaliste.

---

## 10. Risques et parades

| Risque | Parade |
|---|---|
| Fabrication des instantanés trop lente sur mobile, à-coups pendant les pas | Préchargement plus profond de la ligne active ; résolution d'instantané réduite puis remplacée quand l'appareil est au repos |
| Écran de chargement trop long au premier lancement | Grille affichée dès que la ligne active est prête ; HDRI et textures compressés ; PWA pour les visites suivantes |
| Mémoire GPU saturée en navigation longue | Libération stricte (§1.3) ; compteur de mémoire en développement |
| Matériaux physiques coûteux (transmission du cristal, anisotropie) | Replis décidés à la phase 2, mesures à l'appui |
| Navigation sans libellés mal comprise | Test utilisateur dès la fin de la phase 1 |
| ~30 lignes : on se perd verticalement | Repères de groupe discrets sur le bord |
| Cornes paramétriques peu crédibles | Blender dès le départ |

---

## 11. Points encore ouverts

1. **46 mm = 182 px ou 184 px** : la variante Figma mesure 182 px, la règle de 4 px/mm donne 184. Avec D5, la ligne Taille du Figma représente des boîtiers : corriger la variante ou noter l'exception.
2. **Largeur de lunette** : la spec suppose ≈ 3 mm de chaque côté (boîtier 46 → cadran 40). C'est épais pour une montre habillée ; proposer une largeur par type de lunette (fine ≈ 1,5 mm, standard ≈ 3 mm, plongée ≈ 3,5–4 mm).
3. **Distance « ≥ 4 » du §2.6** : jamais visible en 7 × 5, utile seulement pour les cellules de marge pendant une animation.
4. **Anisotropie radiale (soleillé)** : à valider en phase 2, sinon repli sur une texture de rayons.
5. **Maquette de la direction artistique** (§1.5) : à produire dans Figma avant de figer les jetons visuels.

---

## 12. Prochaines actions

**Fait (22 novembre)** : framework choisi (**Svelte 5**) ; dépôt initialisé (Vite, TypeScript strict, Vitest, Playwright, ESLint, Prettier, git) ; arborescence et règle d'import de `core/` ; contrat `PartRenderer` ; catalogue P0 validé par zod ; réducteur de navigation, lien sélection ↔ configuration, angles des aiguilles, avec 23 tests ; écran de chargement en ligne ; vue de contrôle provisoire pilotée au clavier.

**Lot 3D n° 1 (22 novembre)** — `src/render3d/` :

- Pièces paramétriques : boîtier rond (fond bombé, carrure galbée, chanfreins polis, lunette lisse brossée), rehaut, cornes droites et courbes (profil extrudé), couronnes oignon et cannelée, cristal plat / bombé / « boîte », cadran avec impression SVG en texture (piste chemin de fer), index bâtons appliqués, 6 jeux d'aiguilles (bâton, épée, dauphine, feuille, seringue, Breguet) avec pans facettés, trotteuse à contrepoids laquée.
- Matériaux : acier brossé (anisotropie) et poli, cadran mat, nacre et huile iridescentes, laque, saphir (transmission, repli transparent sur appareil modeste).
- Studio procédural (fond sombre + boîtes à lumière) à la place d'un HDRI : rien à télécharger.
- Montre centrale en direct (heure réelle, trotteuse à 6 pas/s, « respiration », orbite) et instantanés de cellules par le contexte WebGL unique ; vue de profil pour la ligne Cornes ; échelle commune pour la ligne Taille.
- Lignes ajoutées au catalogue : Cornes, Couronne ; la Taille fixe aussi entre-cornes, lug-to-lug et épaisseur (`proportionsForDiameter`).

Limites connues du lot 1 : faces latérales des cornes très claires (reflet plat de la boîte à lumière gauche) ; nacre encore discrète de face ; profils d'aiguilles dessinés dans le code en attendant les tracés Figma ; Blender absent de la machine, donc cornes paramétriques pour l'instant ; pas encore de bracelet ; Three.js pèse ≈ 160 ko compressés, chargé après le premier affichage.

**Grille en croix (22 novembre)** — `src/ui/grid/` : remplace l'atelier provisoire, d'après la maquette Figma `Desktop - 2 (variantes)`. Montre 3D en direct au centre de la ligne active, chaque ligne centrée sur sa variante choisie, instantanés 3D autour (masque circulaire doux, disque sombre derrière les aiguilles, R2) ; hiérarchie échelle / opacité (§2.6) ; bords avec rebond ; clavier, molette (verrouillage d'axe, accumulation), glisser souris et tactile avec inertie plafonnée, clic pour recentrer ; Entrée ou clic sur la montre : vue 3D agrandie (caméra de face → trois quarts, orbite), Échap / clic extérieur / ✕ pour revenir, focus rendu à la grille ; ARIA `grid`, annonces `aria-live` ; seules les cellules visibles + une de marge sont montées, instantanés fabriqués du centre vers l'extérieur et mis en cache selon les seules parties de configuration dont ils dépendent.

**Lot 3D n° 2 (22 novembre)** :

- Cadran séparé en **Finition** (mat, soleillé à anisotropie radiale, grainé, laqué, fumé, nacré, huile) et **Couleur** (11 teintes de la spec, ligne cyclique) ; le fond de l'interface suit les deux.
- **Piste des minutes** (aucune, chemin de fer, points, bâtons, 5 minutes), **Index** appliqués (bâtons, bâtons facettés, dauphine, points, triangles, baguettes, gouttes, aucun), **Chiffres** imprimés (12-3-6-9, 3-6-9, 12, 6-12, tous, romains) qui remplacent les index à leur place, **Typographie** (5 familles).
- **Trotteuse** : forme (fine, contrepoids, sucette, flèche, triangle) et couleur (orange, rouge, bleue, jaune, assortie aux aiguilles) ; calque séparé des aiguilles.
- **Cristal** : saphir plat, bombé, « boîte », acrylique, aperçus de profil. **Taille** : 44 et 48 mm ajoutés.
- **Lignes conditionnelles** (principe 5, §4.5) : `visibleWhen` évalué ; la ligne Typographie n'apparaît qu'avec des chiffres, la ligne active est retrouvée par son identifiant.
- Grille : **survol** (§2.3), **lignes cycliques** affichées des deux côtés sans traversée d'écran (§2.5), conteneur non défilable.
- Vue 3D : boutons **⌖** et **pause**, **double clic** pour réinitialiser, **flèches** par pas de 15°, **touches 1 à 5** (face, profil gauche, dessus, dos, trois quarts), **P** = pause des aiguilles (Espace et Entrée referment l'aperçu), **limites d'orbite** −10° à 90°.

**Couronnes (22 novembre)** : six formes (cannelée, oignon, pointue, carrée, pompe, à protège-couronne avec ailettes sur la carrure) et ligne **Position** (3 h, 4 h, 2 h) ; aperçus en gros plan qui suivent la position.

**Finition des jonctions (22 novembre)** : cornes taillées dans la masse (contour vu de dessus avec congés de raccord, extrudé avec arêtes arrondies puis cintré selon le profil droit ou courbe, acier satiné) ; occlusion ambiante précalculée en couleurs de sommet (racine des cornes, tube de couronne, pied du rehaut) et ombre du rehaut sur le bord du cadran — sans post-traitement, donc identique dans les cellules et sur mobile ; collerette chanfreinée et joint de couronne, pied élargi des ailettes du protège-couronne ; joint sombre du cristal ; chanfreins du boîtier élargis ; deux liserés arrière dans le studio.

**Typographies de style (22 novembre)** : six polices libres (licence OFL, paquets @fontsource) ajoutées à la ligne Typographie — Art nouveau (Federant), Art déco (Poiret One), Lapidaire (Cinzel), Condensée (Bebas Neue), Futuriste (Orbitron), Italique (Playfair Display). Chacune est un petit bloc chargé seulement quand on la choisit, puis embarquée dans le SVG d'impression (une image SVG ne peut pas charger de fichier externe).

**Cornes (22 novembre)** : huit styles — droites, courbes, pointues (effilées vers une pointe basse), chanfreinées (large facette polie), gouttes (section arrondie), percées (trous de barrette apparents), intégrées (bloc court sur toute la largeur, pour bracelet intégré), aucune.

**Cornes reconstruites (22 novembre)** : chaque corne (et chaque ailette de protège-couronne) est désormais une suite de sections aux coins arrondis reliées par des bandes régulières, au lieu d'un contour extrudé puis déformé ; le congé de raccord aboutit exactement sur le flanc et la partie cachée longe la surface juste en dessous. Contrôle numérique : aucun point sous la jonction ne dépasse de la carrure, pour les 7 styles en 22, 40 et 48 mm. Couronnes moletées : arêtes franches, plus de traînées sur la face.

**Boîtiers et grainé (22 novembre)** : six formes de boîtier — rond, coussin, tonneau, octogonal, carré, rectangulaire. La carrure et la lunette épousent la forme (déformation progressive depuis l'ouverture, qui reste ronde, comme le cadran) ; cornes, couronne et ailettes se raccordent au flanc réel de chaque forme (testé : rien ne dépasse). Cadran grainé refait : grains visibles à l'écran et grains polis qui scintillent, fond de l'interface légèrement grené. Limite : le cadran reste rond dans les boîtiers carrés et rectangulaires.

**Matière et finition du boîtier (22 novembre)** : ligne Matière (acier, titane, bronze, or jaune, or rose, laiton plaqué, céramique noire, carbone forgé) et ligne Finition (mixte, brossé, poli, sablé, noir PVD, patiné). Chaque surface a un rôle (grandes surfaces, chanfreins, cornes, couronne) et la finition décide de son aspect ; la couronne reste polie sauf finitions mates. Patine teintée selon la matière (vert-de-gris du bronze, brun du laiton…), carbone forgé en éclats procéduraux ; la ligne Finition disparaît pour la céramique et le carbone. Coordonnées de texture métriques sur la carrure (textures non étirées).

**Écarts restants avec la spec** (par priorité) :

- P0 : transition 2D → 3D avec caméra orthographique (§3.2, remplacée par un agrandissement de la montre déjà en 3D — écart assumé, voir D1) ; ligne Boîtier à une seule forme (rond) ; contexte `wrist` absent.
- Jalon 1 : moteur de règles complet (`requires`, `excludes`, `implies`, `default`, `range`, `layout`, point fixe, `auto-fix`) ; ligne **Style** (13 préréglages, §6) ; **lien de partage** (§9.6) ; **annuler / rétablir** (`Z`) ; **variante aléatoire** (`R`) ; lunette (types, échelles, inserts) ; lume (index, aiguilles, mode nuit `L`) ; date, petite seconde, réserve de marche ; textes du cadran (nom, seconde ligne) ; option « libellés » ; repères de groupe sur le bord ; appui long = infobulle.
- Vue 3D : export PNG, rotation automatique, environnements jour / intérieur / nuit, heure figée 10 h 10, panoramique, qualité adaptative, repli sans WebGL.
- Mobile : test sur appareils réels, retour haptique, PWA hors ligne, `DeviceOrientation` pour l'iridescence.
- Technique : cache IndexedDB des instantanés, libération des instantanés lointains, fondu de 120 ms à la mise à jour de la montre centrale (§2.8), internationalisation (clés de traduction).

**Ensuite** :

1. Test sur téléphone réel (gestes, mise en page portrait, performances des instantanés).
2. Bracelet (le premier lot ne modélise que la tête de montre).
3. Côté Figma : renommer et recadrer les composants (0.5), puis script d'export (0.6).
4. Esquisser la direction « flottante » sur une copie de `Desktop - 2`.

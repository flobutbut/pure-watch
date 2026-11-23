# Prototype du coussin bleu

Le prototype est intégré au rendu normal dès que `case.shape === 'cushion'`. Le modèle de départ de l’application reste rond. Aucun changement de schéma, catalogue, dimensions de référence ou données enregistrées ; aucun déploiement.

## Comparer localement

Lancer `npm run dev`, puis ouvrir :

- [Comparaison synchronisée](http://127.0.0.1:5173/review.html) : face, trois quarts, profil, fond, rotation commune, animation des aiguilles, deux qualités de verre. Le choix « Géométrie seule » conserve les matériaux initiaux ; « Géométrie + grain affiné » ajoute uniquement la modification du cadran. L’éclairage reste strictement identique.
- [Pilote intégré](http://127.0.0.1:5173/?pilot=cushion).
- [Même pilote, rendu initial](http://127.0.0.1:5173/?pilot=cushion&model=legacy).
- [Même pilote, géométrie seule](http://127.0.0.1:5173/?pilot=cushion&model=geometry).

Les paramètres `pilot` et `model` sont des aides de contrôle, hors `WatchConfig`. Le pilote utilise la configuration existante : acier mixte, 40 × 11 mm, entre-cornes 20 mm, cornes courbes, cadran bleu grainé, chiffres géométriques (Futura / Avenir Next selon les polices installées), aiguilles dauphine, trotteuse rouge lollipop. L’heure et la respiration sont figées sur ce pilote pour comparer le configurateur à caméra égale. Les montres configurées normalement restent animées. L’outil de contrôle permet d’animer le pilote séparément.

`review.html` est une entrée de développement, absente du build de production. Le moteur actuel et le rendu initial sont conservés dans les mêmes sources, sans copie indépendante susceptible de diverger.

## État initial confirmé dans le code

Three.js 0.187, Svelte 5 et Vite ; aucune montre importée. Les pièces sont procédurales. Unité : millimètre, cadran à Z = 0, 12 h vers +Y, observateur vers +Z. Les dimensions et attaches restent dérivées de `watchDimensions`.

Le boîtier initial assemblait des profils tournés, déformés suivant la silhouette. Des finitions distinctes existaient déjà, ainsi qu’un rehaut et un joint de verre. En revanche : profil de boîtier continu sans joint fond/lunette, grain fortement accentué (`normalScale = 1.4`), verre sans sous-face fermée, gros bossages centraux et niveaux d’aiguilles fixes susceptibles d’intersection avec les facettes.

Six contours sont effectivement implémentés ; `asymmetric`, déclaré dans le type, retombe actuellement sur le contour rond. Ce prototype ne change pas cette limitation antérieure.

## Changements

- **Boîtier** : fond fermé, carrure et lunette distingués par des retraits de 0,06 mm maximum. Flanc peu galbé, chanfrein extérieur fin, petite cassure d’arête, ouverture circulaire conservée. Géométries regroupées par matériau pour maîtriser les appels de rendu.
- **Reflets** : tangentes continues autour du coussin et subdivisions radiales sur la large lunette. Cela corrige les bandes dues à l’orientation anisotrope calculée par triangle. Traitement explicite des pôles du fond pour éviter une base de tangentes nulle.
- **Cornes** : pour les options droites, courbes et percées, dessus brossé, flanc satiné, chanfrein poli fin ; effilement uniquement extérieur. L’entre-cornes, les profils de courbure et les points de raccord restent ceux du configurateur. Les autres styles gardent leur construction.
- **Cadran** : grain environ 2,3 fois plus fin, amplitude normale réduite de 1,4 à 0,22 et métal moins dominant. Aucune rayure ni salissure ajoutée. Rehaut discret et filet métallique au pied.
- **Verre** : volume fermé avec sous-face et petit biseau, épaisseur de coque jusqu’à 0,7 mm ; verre plat et profil boîte distingués. Le verre boîte descend jusqu’à son siège. Les deux shaders existants sont conservés : transmission et repli transparent.
- **Aiguilles** : lames affinées à 0,16 mm, bossages réduits, niveaux calculés suivant la plus haute facette et jeux axiaux de 0,09 mm avant adaptation aux boîtiers fins. Anneau et contrepoids de la trotteuse conservés. Aucun ajout de complication.
- **Couronne oignon** : galbe continu et prise discrète, cannelures peu profondes à amplitude progressive. Tube, position et collerette conservés ; autres options de couronne inchangées.

## Vérifications

- État initial : 106 tests, vérification Svelte/TypeScript sans erreur.
- Après : 128 tests unitaires. Comparaison exacte des positions, normales, UV, couleurs et indices des autres formes entre les deux modes. Configurations immuables ; toutes les options de cornes construites à 22 / 40 / 48 mm, coordonnées finies et groupes de matériaux bornés.
- Tous les jeux d’aiguilles testés à plusieurs angles pour leur dégagement axial ; rayons lancés sur la sous-face réelle des cinq verres à 22 / 40 / 48 mm pour contrôler le dégagement du pilote. Léger décalage numérique des rayons pour éviter la couture du maillage de révolution.
- Huit parcours Playwright réussis : navigation, ouverture/fermeture, changement de trotteuse sur le pilote, sur ordinateur et Pixel 7 émulé.
- `npm run check`, `npm run lint` et `npm run build` réussis.
- Captures des vues face, trois quarts, profil et fond avec les deux qualités de verre, comparaison géométrie seule, contrôle effectif de rotation commune et mouvement de la trotteuse, puis capture du configurateur intégré.

Les images de ce dossier sont des captures WebGL du projet, sans retouche. Les paramètres caméra, configuration et éclairage sont partagés entre avant/après. La géométrie du verre et le grain peuvent naturellement modifier les reflets perçus sur le cadran.

## Coût et limites

Les compteurs et mesures détaillés figurent dans `measurements.json`. Ils incluent le rendu du verre ; les triangles du modèle sont comptés séparément des triangles effectivement soumis lors des passes.

| Mesure sur le pilote | Avant | Après |
| --- | ---: | ---: |
| Triangles du modèle | 45 408 | 37 616 (−17,2 %) |
| Maillages | 26 | 21 |
| Appels de rendu, transmission | 51 | 57 (+11,8 %) |
| Appels de rendu, repli | 26 | 29 (+11,5 %) |
| Triangles soumis, transmission | 80 256 | 62 432 |
| Textures actives, transmission / repli | 7 / 6 | 7 / 6 |
| Intervalle médian, transmission logicielle | 174,4 ms | 167,3 ms |
| Intervalle médian, repli logiciel | 116,9 ms | 116,6 ms |
| Soumission JS médiane, transmission | 0,6 ms | 0,6 ms |

Échantillons indicatifs de 30 images après 15 images de chauffe, caméra trois quarts. La baisse de triangles compense ici l’ajout de surfaces de finition ; les intervalles ne permettent pas de conclure à un gain généralisable de cadence. Après reconstruction, les nombres de géométries et textures actives restent identiques. Le script termine sans erreur JavaScript ni erreur console.

Aucun éclairage, post-traitement, fichier HDRI ou texture plus grande n’a été ajouté. Les deux textures de grain restent en 512 × 512 ; la texture d’impression conserve sa résolution. Le mode transmission était déjà présent et reste le poste coûteux ; le repli mobile est conservé.

Les temps proviennent de Chromium headless sur un moteur logiciel, avec une seule montre rendue pendant chaque échantillonnage, à 750 × 750 pixels et DPR 1. Ils mesurent cette machine et cette exécution, et ne constituent pas un engagement de cadence sur GPU ou téléphone. Le temps de soumission JavaScript n’est pas un temps GPU. Une validation sur appareils physiques reste nécessaire.

L’étude conserve un studio procédural relativement simple. Le rendu du verre reste une approximation temps réel ; les configurations extrêmes hors des tailles contrôlées ne sont pas toutes validées. Les attaches sont préservées, mais les cornes percées existantes simulent toujours leurs trous par des puits sombres, sans soustraction géométrique. Aucun bracelet n’a été ajouté.

## Reproduire les captures

Avec Vite sur le port 5173 et Chromium Playwright installé :

```sh
node scripts/cushion-review.mjs
```

Si le navigateur disponible ne correspond pas à celui attendu par la version de Playwright, définir `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` vers son exécutable local. La même variable est reconnue par les parcours `npm run test:e2e`. Le script écrit les captures et les mesures dans ce dossier.

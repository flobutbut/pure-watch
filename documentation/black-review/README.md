# Tonneau noir — deuxième passe de finition

Configuration relevée dans le configurateur ouvert : tonneau en céramique noire, 40 mm, sans cornes, couronne cannelée à 3 h, saphir boîte, cadran noir soleillé, chiffres condensés, piste bâtons, aiguilles bâton et trotteuse sucette jaune. Une configuration reproductible est disponible dans `blackTonneauPilot()` ; elle ne remplace pas le modèle de départ.

## Voir le résultat

Avec le front sur le port 5173 :

- [Pilote amélioré](http://127.0.0.1:5173/?pilot=black).
- [Même pilote, construction initiale](http://127.0.0.1:5173/?pilot=black&model=legacy).
- [Comparaison synchronisée](http://127.0.0.1:5173/review.html?pilot=black) : vues de face, trois quarts, profil, dos, rotation, aiguilles et deux qualités de verre. Le choix « Géométrie seule » garde les anciens matériaux.

L’heure de présentation est figée sur le pilote pour comparer les formes ; l’outil de comparaison permet d’animer les aiguilles. Les configurations normales continuent à utiliser l’heure courante. Le studio et les paramètres de caméra sont identiques entre avant/après.

## Modifications

- **Aiguilles bâton** : silhouette et portée conservées, lames de 0,16 mm avec biseaux à 45° jusqu’à 0,048 mm sur ce pilote ; faces satinées, tranches polies. Les groupes de matériaux sont contigus, sans appel de rendu par facette.
- **Axe** : bossages réduits, niveaux axiaux calculés en fonction des facettes, adaptation verticale aux boîtiers fins. Anneau et contrepoids jaunes conservés.
- **Boîtier** : épaulement satiné, cassure d’arête plus fine et joint sous lunette de 0,05 mm dans le profil de révolution, avant déformation tonneau. Les maillages sont regroupés par matériau.
- **Céramique** : grands volumes plus satinés avec moins de vernis ; arêtes et couronne restent brillantes. La clé du cache distingue cette finition des autres boîtiers en céramique.

Les modifications sont appliquées au tonneau en céramique, sans condition sur la couleur du cadran. Les autres matières et formes gardent leur rendu. Les autres jeux d’aiguilles restent disponibles. Le cadran soleillé, le verre et l’éclairage sont conservés : la grande variation lumineuse du cadran ne provenait pas uniquement du verre.

## Validation et coût

134 tests unitaires et 10 parcours Playwright réussis (ordinateur et Pixel 7 émulé), vérification Svelte/TypeScript sans erreur, ESLint/Prettier et build réussis. Tests ajoutés pour l’encombrement des aiguilles, leurs groupes de matériaux, leur espacement à 22 / 40 / 48 mm, l’absence de modification d’un tonneau en acier et l’isolation des matériaux partagés.

| Compteur du pilote | Avant | Après |
| --- | ---: | ---: |
| Triangles | 31 344 | 30 220 (−3,6 %) |
| Maillages | 22 | 16 |
| Appels en transmission | 43 | 39 |
| Appels en repli mobile | 22 | 20 |
| Textures transmission / repli | 6 / 5 | 6 / 5 |

Captures WebGL du projet dans ce dossier, sans retouche. Détail des compteurs et des temps dans `measurements.json`. Les mesures Chromium utilisent SwiftShader, à 750 × 750 pixels et DPR 1 : elles ne prédisent pas la cadence sur appareils physiques. Aucun post-traitement ni texture supplémentaire.

Reproduction :

```sh
node scripts/cushion-review.mjs --black
```

Le script vérifie les deux qualités de verre, la rotation synchronisée, le mouvement de la trotteuse et l’intégration au configurateur. La variable facultative `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un Chromium local déjà installé. Rien n’a été déployé.

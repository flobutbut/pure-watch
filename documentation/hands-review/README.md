# Audit et finition des six jeux d’aiguilles

Les six jeux ont été examinés en gros plan avec le même studio, la même caméra et le même horaire. Les captures `initial-*` ont été faites avant cette passe. Les images sans préfixe comparent la version précédente (gauche) et la version affinée (droite), sans verre pour distinguer les formes des reflets du cristal. Les captures `watch-*` vérifient le résultat dans le configurateur complet.

## Résultat de l’audit

| Jeu | Observation initiale | Correction appliquée |
| --- | --- | --- |
| Bâton | Déjà biseauté sur le tonneau noir, encore simplifié ailleurs | Même géométrie aboutie sur tous les boîtiers ; regroupement des chants et du moyeu |
| Feuille | Bandes de facettes transversales visibles sur les pans courbes | Normales lissées dans la longueur, arête centrale conservée, fin biseau périphérique |
| Seringue | Dessus plat et transitions d’épaisseur très franches | Chants biseautés polis, dessus satiné et épaules conservées |
| Breguet | Tige, anneau et pointe superposés, raccords de hauteur abrupts | Une seule lame percée continue, anneau biseauté, raccords intégrés ; œil ouvert |
| Épée | Facettes centrales déjà cohérentes | Conservation des pans et de la pointe ; fin biseau et chants distincts |
| Dauphine | Géométrie centrale déjà convaincante | Conservation de l’arête marquée ; finitions des bords affinées |

Les longueurs et les silhouettes distinctives sont conservées. La Breguet reçoit des ajustements de contour de quelques centièmes de millimètre nécessaires au biseau. Le moyeu réduit et les jeux axiaux adaptés sont désormais utilisés avec ces aiguilles sur toutes les formes de boîtier, et non uniquement les deux pilotes précédents. Le dessin de la trotteuse est conservé.

## Comparer

Avec le front sur le port 5173 :

- [Feuille avant/après](http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=leaf).
- [Breguet avant/après](http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=breguet).
- [Seringue avant/après](http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=syringe).

Le sélecteur **Jeu** donne accès aux six variantes. Les boutons permettent de voir la face, les trois quarts, le profil, le dos et les aiguilles animées. **Géométrie seule** conserve les anciens matériaux sur la version améliorée ; le boîtier est exclu du gros plan. Les paramètres de comparaison restent hors de la configuration enregistrable.

L’option de construction `handDetail: 'legacy'` conserve la version précédant cette passe, indépendamment du boîtier. Le mode global `model=legacy` conserve toujours la construction historique complète.

## Coût mesuré

Comparaison sur le tonneau noir de 40 mm, heures/minutes et trotteuse visibles. Le Bâton était déjà biseauté sur ce modèle avant cette passe. Les compteurs complets sont dans `measurements.json`.

| Jeu | Triangles avant | Triangles après | Écart |
| --- | ---: | ---: | ---: |
| Bâton | 1 612 | 1 612 | 0 |
| Épée | 1 636 | 1 668 | +32 |
| Dauphine | 1 616 | 1 640 | +24 |
| Feuille | 1 896 | 2 032 | +136 |
| Seringue | 1 674 | 1 722 | +48 |
| Breguet | 2 652 | 3 588 | +936 |

Deux groupes de matériaux par aiguille : dessus et chants. Cela ajoute deux appels de rendu pour la paire sur les cinq jeux initialement monomatière, et en enlève deux au Bâton précédemment découpé en trois groupes. La Breguet demande le plus de géométrie pour fermer et biseauter ses anneaux : le surcoût représente environ 3 % d’une montre complète de ce pilote.

Aucune texture, aucun post-traitement ni passe supplémentaire introduits. La transmission déjà existante soumet également les surfaces opaques supplémentaires à sa passe. Les captures Chromium utilisent SwiftShader ; aucun gain de cadence sur appareil physique n’est déduit de ces compteurs.

## Vérifications

- **144 tests unitaires réussis**, dont les six jeux aux tailles 22 / 40 / 48 mm : portée conservée à moins de 0,05 mm, groupes de matériaux sans trou ni chevauchement, coordonnées et normales finies, séparation axiale entre aiguilles.
- Breguet : rayons de contrôle dans l’œil et aux deux raccords, fermeture topologique de la lame, normales unitaires. L’anneau est une découpe réelle du même volume, et non une pièce superposée.
- Dégagement sous les cinq verres du pilote coussin, avec la nouvelle construction d’aiguilles ; géométrie des autres boîtiers inchangée entre les modes de rendu.
- **12 parcours Playwright réussis**, ordinateur et Pixel 7 émulé, dont la sélection successive des six jeux dans le configurateur.
- Capture de face, trois quarts et profil pour les six jeux ; mouvement effectif des heures et minutes vérifié ; six captures dans la montre complète. Aucune erreur JavaScript ni console pendant cet audit.
- `npm run check`, `npm run lint`, `npm run build` réussis.

## Reproduire

```sh
node scripts/hands-review.mjs
```

Vite doit être lancé sur le port 5173. La variable facultative `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un Chromium déjà installé. `--initial` capture uniquement l’état de référence et ses compteurs ; pour reproduire exactement les images initiales, utiliser le code antérieur à cette passe.

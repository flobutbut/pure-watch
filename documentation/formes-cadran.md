# Formes du cadran

La ligne **Forme du cadran** précède immédiatement **Finition du cadran**. Six choix indépendants du boîtier : rond, coussin, tonneau, octogonal, carré et rectangulaire.

Le contour est partagé par le cadran, l’ouverture de la lunette, le rehaut, le verre et son joint. L’enveloppe extérieure du boîtier garde sa forme. L’ouverture est ajustée uniformément pour conserver une paroi métallique ; une forme allongée dans un boîtier rond sera donc plus petite.

Les graduations, le chemin de fer, les chiffres et les index suivent le périmètre. Les lettres et les index gardent leurs proportions. Les aiguilles ont une longueur fixe calculée sur le cercle inscrit : elles peuvent tourner sans rencontrer le bord étroit du cadran. Les textures utilisent des coordonnées physiques, avec une ombre périphérique et un dégradé fumé adaptés au contour.

Les anciens liens restent ronds. Le champ supplémentaire `aa` du format URL v1 encode la forme ; les identifiants existants et les valeurs par défaut historiques restent inchangés.

## Vérification

Les tests couvrent les six boîtiers, les cinq nouveaux contours et les diamètres 22, 40 et 48 mm : paroi minimale, géométries finies, index contenus, longueurs d’aiguilles, dégagement sous les cinq types de verre et restitution par URL. Les parcours Playwright couvrent le placement de la ligne, les six choix, le rechargement et les anciens liens sur ordinateur et mobile.

Comparateur local : [`/review.html?scope=dial&body=square&dial=square`](http://127.0.0.1:5173/review.html?scope=dial&body=square&dial=square). Les images de `dial-review/` comparent le même boîtier avec le cadran rond à gauche et le contour choisi à droite, dans le même studio et à la même heure.

Mesures Chromium, verre en repli mobile : aucun appel de rendu supplémentaire. Sur le pilote carré, 45 432 → 47 672 triangles avant la correction des couronnes ; les 2 240 triangles supplémentaires ferment le volume du verre. Pas de post-traitement ajouté. Ces mesures de complexité ne constituent pas une mesure de fluidité sur téléphone physique.

Reproduction : `node scripts/dial-review.mjs` avec Vite actif ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet de choisir un Chromium installé.

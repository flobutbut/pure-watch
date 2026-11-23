# Raccord des couronnes

Le défaut reproduit sur un carré à 4 h venait de l’orientation radiale de la couronne, de racines de protège-couronne calculées en miroir malgré un flanc asymétrique dans leur repère, et de racines cachées pouvant dépasser le plan du cadran.

La couronne suit maintenant la normale locale au flanc. Sur un carré à 4 h, elle sort horizontalement du côté droit, plus bas que la position 3 h. Chaque ailette se raccorde à son propre côté réel ; sa racine commence sous le métal et reste sous le cadran. L’espace autour de la couronne tient compte du rayon réel de son modèle.

Ces combinaisons étant rendues cohérentes par la géométrie, aucune option du catalogue n’est interdite. Une restriction devra correspondre à une contrainte de produit explicite, par exemple une référence de boîtier réellement fabriquée avec une seule position de tige.

Les tests vérifient l’orientation normale aux trois positions du catalogue, les six styles de couronne et les six boîtiers aux diamètres 22 et 48 mm, avec des coordonnées finies et des ailettes sous le plan du cadran. Les captures `before-*` reproduisent le défaut ; les autres montrent les raccords corrigés. Reproduction : `node scripts/crown-review.mjs` avec Vite actif et, si nécessaire, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

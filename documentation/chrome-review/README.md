# En-tête et aides de navigation

Le logo Épure associe un E géométrique à un cercle ouvert. L'emblème du favicon reprend le même dessin sur un fond sombre pour rester lisible dans les onglets clairs et sombres.

L'en-tête suit la couleur de l'interface et place le partage en haut à droite. Les outils de la vue 3D sont décalés sous l'en-tête. Les rappels au bas de l'écran suivent le mode : navigation par pièces et variantes dans la grille, rotation, vues, pause et retour en 3D. Les appareils tactiles affichent des indications de gestes. Les aides sont masquées pendant la sélection d'une couleur.

Le bouton Partager utilise le partage natif lorsqu'il est disponible. Une annulation native n'entraîne aucune copie. Sinon, le lien de la configuration courante est copié dans le presse-papiers avec une confirmation temporaire. Si cet accès est refusé, un dialogue présente le lien sélectionné, avec retour du focus et sans fermer la vue 3D à l'appui sur Échap.

`e2e/chrome.spec.ts` couvre le lien courant après une modification, les aides contextuelles, l'espacement des contrôles, le favicon, le partage natif, l'annulation et le repli manuel sur ordinateur et mobile.

Les captures montrent la grille et la vue 3D ainsi que les couleurs claires et sombres. Pour les régénérer, démarrer Vite sur `127.0.0.1:5173`, puis lancer `node scripts/chrome-review.mjs` avec au besoin `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

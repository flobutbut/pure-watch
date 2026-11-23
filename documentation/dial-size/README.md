# Ouverture du cadran

La ligne « Ouverture du cadran » suit la forme du cadran et propose Compacte, Équilibrée et Ouverte pour tous les boîtiers. Les rapports de référence sont 0,88, 0,94 et 1 avant ajustement au contour du boîtier. Le choix est partagé dans le nouveau champ V1 `ag` ; les anciens identifiants et le lien par défaut restent inchangés.

Les ouvertures circulaires sont désormais ajustées aux côtés les plus étroits du boîtier, comme les autres contours l'étaient déjà. À 40 mm, un tonneau avec cadran rond conserve au moins 2,6 mm de métal au lieu d'environ 0,2 mm. L'ouverture la plus grande passe d'environ 34,8 à 29,9 mm de diamètre. Les variantes Compacte et Équilibrée réservent davantage de métal.

Le réglage recalcule l'ouverture, le verre, le joint, le réhaut, le cadran, ses impressions et les longueurs des aiguilles. La déformation de la carrure et du fond est découplée du rayon d'ouverture : la silhouette extérieure et les raccords des cornes et de la couronne restent stables.

Le cadran rond tient aussi dans le boîtier rectangulaire ; les exclusions historiques des lignes Lunette et Réhaut sont donc retirées pour cette combinaison. Les graduations du réhaut restent masquées sur son profil fin.

Les tests couvrent chaque boîtier, chaque contour de cadran, les trois ouvertures et les tailles 22 / 40 / 48 mm : marge de métal, rotation des aiguilles, géométries finies et stabilité de la partie basse du boîtier. Les tests de cache et de lien couvrent les dépendances ajoutées. Les parcours navigateur vérifient les choix, la navigation, le rechargement et la conservation des autres réglages sur ordinateur et mobile.

`comparison.png` compare les trois ouvertures sur le même tonneau à cadran rond ; les captures supplémentaires vérifient les autres boîtiers et le verre en transmission. Pour régénérer les images avec Vite sur `127.0.0.1:5173` : `node scripts/dial-size-review.mjs`, avec au besoin `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

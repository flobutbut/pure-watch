# Lunettes

Mise à jour : le réglage d’ouverture ajuste désormais aussi les cadrans ronds aux boîtiers étroits. La restriction historique rectangle / cadran rond décrite ci-dessous est levée ; voir `documentation/dial-size/README.md`.


Six profils fixes, dans une ligne « Lunette » placée avant « Cristal » : lisse (profil historique), bombée, double filet, cannelée, moletée et crantée. La matière et la finition suivent le boîtier. Les usinages sont géométriques, sans texture supplémentaire.

L'ouverture, le siège du verre, le réhaut et les dimensions des aiguilles restent inchangés. Le contour extérieur suit le boîtier et le contour intérieur suit le cadran. Les profils usinés interpolent linéairement entre ces deux contours pour éviter un repli sur les côtés étroits du tonneau.

La ligne est masquée pour l'ancien cadran rond dans un boîtier rectangulaire : cette ouverture dépasse déjà la carrure. Le rendu utilise alors le profil lisse historique ; le choix reste dans la configuration et revient avec un cadran compatible.

Les identifiants URL existants sont conservés. Les profils bombé et double filet utilisent les nouveaux identifiants `n:8` et `n:9`. Les champs réservés aux inserts et aux graduations ne sont pas exposés.

## Vérification

- Géométrie : six boîtiers, six cadrans et les deux extrêmes de taille (22 et 48 mm), hors combinaison incompatible ; ouverture libre, sommets et normales finis, gabarit inchangé.
- Usinage : siège du verre et carrure conservés ; six géométries distinctes ; repli lisse pour les identifiants inconnus.
- Navigation et partage : choix des six profils, rechargement du lien, passage vers Cristal et masquage/restauration sur ordinateur et mobile.
- Rendu : `overview.png` compare les six profils avec une même montre. Les captures complémentaires couvrent les contours carré, rectangulaire, coussin et tonneau.
- Coût de la montre ronde du comparatif : 42 744 à 55 416 triangles, 27 à 29 appels de rendu et six textures. Voir `measurements.json`.

Pour régénérer les captures avec Vite démarré sur `127.0.0.1:5173` : `node scripts/bezel-review.mjs`. Le chemin du navigateur peut être fourni dans `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

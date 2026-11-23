# Réhauts configurables

Mise à jour : le réglage d’ouverture ajuste désormais aussi les cadrans ronds aux boîtiers étroits. La restriction historique rectangle / cadran rond décrite ci-dessous est levée ; voir `documentation/dial-size/README.md`.


La ligne « Réhaut » est placée après le cristal. Elle propose quatre profils : fin (géométrie historique), biseauté, concave et à palier.

Les profils larges réservent 4,5 % du diamètre, entre 1 et 2,2 mm, à l'intérieur de l'ouverture existante. Le cadran, ses impressions, ses index et les longueurs d'aiguilles sont recalculés ensemble. Le boîtier, la lunette, le verre et le contour extérieur de l'ouverture restent identiques.

La ligne « Graduations du réhaut » apparaît pour les profils larges : sans graduations, minutes, minutes chiffrées, 24 heures ou tachymètre. Le choix est conservé quand cette ligne disparaît. La piste des minutes du cadran reste une personnalisation indépendante.

Le panneau de couleur est accessible sur la ligne Réhaut : assorti au cadran (suivi dynamique), matière du boîtier, ou couleur libre avec aperçu, validation et annulation. La teinte personnalisée est conservée lors des passages entre ces finitions.

La combinaison historique boîtier rectangulaire / cadran rond masque les deux lignes, comme pour la lunette. Le rendu utilise le réhaut fin assorti au cadran et retrouve les réglages mémorisés dès que le cadran est compatible.

## Rendu et ressources

Les inscriptions sont projetées en coordonnées XY physiques sur une copie du profil incliné. Elles suivent la forme du cadran sans étirer les chiffres. L'encre contraste avec le fond et le matériau reste opaque avec découpe alpha, pour apparaître dans la passe de transmission du verre. L'alpha-to-coverage est désactivé sur ce décor pour préserver les petits caractères foncés.

La montre attend le chargement du décor avant de remplacer le rendu précédent. Sa texture et son matériau sont libérés avec la montre ; la matière de surface partagée appartient à la bibliothèque de matériaux. Les cellules et les aperçus de couleur utilisent des textures de 1 024 px, la montre finale de 2 048 px.

## Liens et vérification

Les anciens liens V1 conservent leur réhaut historique. Les nouveaux champs sont ajoutés sans modifier les valeurs V1 gelées : `ac` profil, `ad` finition, `ae` teinte personnalisée et `af` graduations.

Les tests couvrent les raccords sur les six boîtiers et les six contours de cadran aux tailles extrêmes, les longueurs d'aiguilles, la compatibilité, les couleurs et les liens, les graduations SVG, les clés de cache, l'attente et la libération des ressources. Le parcours navigateur couvre la personnalisation, l'annulation, la conservation de la couleur libre, le masquage et la restauration des réglages sur ordinateur et mobile.

`overview.png` compare les quatre profils. Les captures complémentaires contrôlent les formes carré, rectangle et tonneau ainsi que le rendu sous le verre avec transmission. `measurements.json` conserve les mesures du comparatif : un décor ajoute un appel de rendu et une texture.

Avec Vite sur `127.0.0.1:5173`, régénérer les captures avec `node scripts/rehaut-review.mjs`. Le navigateur peut être indiqué par `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

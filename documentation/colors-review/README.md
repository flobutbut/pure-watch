# Couleurs contextuelles

Les palettes du catalogue restent les teintes proposées, mais ne constituent plus des lignes de navigation. La ligne Finition du cadran, les Aiguilles et la Trotteuse portent un bouton « Couleur ». Les teintes propres de la nacre et de l’huile sont indiquées par « Teinte naturelle » ; la couleur personnelle du cadran reste mémorisée.

Le panneau latéral sur ordinateur devient un volet inférieur sur mobile. La montre reste visible, agrandie et déplacée pour laisser le panneau libre. La surface saturation/luminosité, le curseur de teinte et le champ HEX permettent de choisir librement une couleur. Les flèches ajustent la surface au clavier (Maj = pas de dix). Le dialogue conserve le focus ; Échap, la croix ou Annuler rétablissent la configuration de départ.

L’aperçu actualise la montre et l’ambiance, mais ne modifie pas le lien avant « Appliquer ». Les huit dernières couleurs appliquées sont conservées localement, toutes pièces confondues. La navigation de l’URL pendant une édition ferme le panneau et charge le nouveau lien.

Les aiguilles distinguent acier, or, acier bleui, noir et laque. La couleur libre est conservée lors d’un passage à un métal. Une trotteuse « Assortie aux aiguilles » suit réellement leur matière, y compris la laque. « Couleur du cadran » copie la teinte actuelle du cadran ; cette copie reste ensuite indépendante.

Le champ URL `ab` encode la couleur laquée des aiguilles ; `J`, `x` et `M` gardent leur signification. Les liens précédents conservent leur configuration et la couleur implicite des aiguilles est celle de l’acier historique. Le fichier des valeurs par défaut v1 est inchangé.

Pendant les glissements, l’aperçu est limité à une actualisation toutes les 100 ms. Les vignettes restent sur la configuration validée. Les matières temporaires sont libérées à chaque remplacement : les couleurs parcourues ne s’accumulent pas dans le cache partagé de textures. La montre retrouve sa résolution d’impression complète à la validation ou à l’annulation.

Les tests couvrent conversion des couleurs, codes invalides, préservation des autres pièces, compatibilité des liens, matières 3D, annulation, clavier, couleurs récentes, rechargement, teintes naturelles et glissement continu. Les captures `desktop-*` et `mobile-*` sont produites par `e2e/colors.spec.ts`.

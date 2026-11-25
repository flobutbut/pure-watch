# Réglages détaillés du cadran

Les panneaux existants proposent des réglages supplémentaires, visibles immédiatement sur la montre et conservés dans le lien de configuration.

- **Cadran :** le fumé est un effet superposable au grain, aux reliefs et aux autres finitions colorables. Son intensité et la couleur de ses bords se règlent indépendamment. Il n’apparaît plus comme une finition distincte dans le catalogue. Les anciennes configurations sont converties en « Soleillé » avec effet fumé ; leur couleur, leur éclaircissement central et leur réponse métallique sont conservés.
- **Textures :** taille du grain ou échelle du motif, profondeur du relief et matité. Le motif **Topographique** représente des courbes de niveau génériques ; il ne correspond pas à une montagne réelle.
- **Réhaut :** couleur des inscriptions, accent sur le repère de départ ou les quatre quarts, couleur de cet accent, taille des inscriptions et épaisseur des traits. La couleur et la matière du support restent indépendantes.
- **Index :** la section « Index par heure » permet de personnaliser chaque repère : dessin, finition, couleur laquée ou imprimée, longueur, largeur, position et pigment lumineux. Désactiver la personnalisation fait à nouveau suivre le jeu général. Un chiffre ou une complication continue à occuper sa place : le panneau le signale lorsque l’index personnalisé est masqué.
- **Réserve de marche :** taille, déplacement horizontal et vertical, couleurs des graduations et de l’aiguille, couleur de la zone basse et inscription de l’échelle en heures. Une inscription vide masque le texte. La couleur basse concerne les styles à segments et la jauge E–F. Les déplacements sont limités pour conserver l’indicateur dans le cadran.

Les nouveaux réglages figurent dans la fiche d’identité et dans le prompt de génération d’image. Les paramètres masqués lors d’un changement de variante sont conservés. La réserve reste une représentation de concept : les réglages graphiques ne changent pas l’autonomie du mouvement.

Les ajouts sont facultatifs dans le format de lien existant (`bf`) : leur absence conserve le rendu des configurations déjà partagées. Le motif topographique ajoute un nouvel identifiant sans réaffecter ceux des autres finitions.

## Guillochés supplémentaires

- **Guilloché · tissé 3 brins** : tissage diagonal alternant des faisceaux de trois brins, avec relief arrondi et creux entre les brins.
- **Guilloché · pointe de Hongrie** : bandes en chevrons à 45°, assemblées pointe contre pointe, avec joints gravés et stries fines.
- **Guilloché · diamants en spirale** : petites pyramides à quatre facettes, disposées en losanges dans une trame polaire torsadée. Le relief converge vers un centre adouci sous le pivot des aiguilles. Ce nom descriptif reprend l’aspect du fond Arnold & Son fourni comme référence, sans reproduire les inscriptions ni le médaillon.

- **Guilloché · nid d’abeilles** : cellules hexagonales fermées, bords gravés et fonds légèrement concaves.
- **Guilloché · grain de riz** : petits grains allongés avec sillon central, inclinés en alternance sur des rangées décalées.
- **Guilloché · éventails** : rosaces superposées avec rayons fins et arcs concentriques.
- **Perlage** : disques de brossage circulaire qui se recouvrent. Le relief reste plus faible que celui des gravures ; c’est une finition abrasive, distincte du guilloché.

Ces sept reliefs sont colorables et compatibles avec l’effet fumé, l’échelle du motif, la profondeur et la matité. Ils utilisent des dimensions physiques en millimètres pour garder leur densité d’une forme de cadran à l’autre. Ils figurent aussi dans la fiche technique et le prompt d’image.

Leurs identifiants de lien sont 21 à 27. L’ancien identifiant 9 du fumé reste réservé à la lecture des liens historiques ; il n’est pas réattribué. Le marqueur interne `legacyFume` conserve le rendu historique uniquement sur le soleillé.

## Finitions des sous-cadrans

Les paramètres des lignes **Petite seconde**, **Chronographe** et **Réserve de marche**
regroupent directement le dessin du sous-cadran ou de l’échelle, sa finition, sa couleur,
ses effets et son aiguille. Les anciennes lignes « Sous-cadran », « Compteurs » et
« Échelle de réserve » ne sont plus affichées dans la grille ; leurs valeurs et les liens
historiques restent compatibles. Les poussoirs du chronographe gardent leur ligne.

Les finitions sont celles du cadran principal. Elles se règlent indépendamment de celui-ci ;
les compteurs du chronographe partagent leurs réglages, tandis que la réserve conserve son
propre fond et sa propre aiguille. Les couleurs panda restent la base tant qu’aucune couleur
libre n’est choisie. Un fond de réserve personnalisé ajoute un disque centré sur sa jauge ;
« Aspect d’origine » conserve le fond continu des configurations historiques.

Le panneau utilise les mêmes contrôles de couleur, fumé, échelle du motif, relief et matité.
Les finitions naturellement colorées gardent leurs teintes propres. Chaque motif radial
est centré dans son disque ; les motifs gravés conservent leur échelle physique.
Les trois types de mini-cadrans partagent le même choix de construction : **Plat** et **En creux**. Ce choix reste distinct de la finition. Les choix sont conservés dans les liens et la fiche technique.

Le dessin et la couleur des aiguilles se règlent dans le même panneau, avec le carrousel
et le sélecteur habituels. La couleur peut suivre les aiguilles principales ou être libre.
Pour une petite seconde, la ligne « Trotteuse » disparaît de la grille : ses anciens choix
restent repris dans les paramètres du sous-cadran. Sur un chronographe, la trotteuse centrale
garde sa ligne ; les aiguilles des compteurs se règlent ensemble et indépendamment.
La réserve conserve les anciennes couleurs d’aiguille et ajoute les mêmes choix de dessin.
Les anciens liens gardent leur rendu.

Le réglage commun `subdialStyle` est facultatif dans `details.subdials` (petite seconde ou
compteurs) et dans `details.reserve` (réserve). En son absence, les anciennes petites secondes
reprennent leur relief, les compteurs panda conservent leur azurage comme finition et la réserve
reste sans creux. Chaque famille conserve ses propres paramètres.

Le choix de **relief** propose uniquement **Plat** (au niveau du cadran principal) et
**En creux** (cuvette). Le mode en creux découpe réellement le cadran principal, ajoute les
parois et un fond ombré, puis abaisse les graduations et les aiguilles sur ce fond.

**Azuré** se choisit dans la liste des **finitions** des mini-cadrans : de fins sillons
concentriques espacés de 0,12 mm. Il reste compatible avec les deux reliefs, la couleur,
le fumé et les réglages du motif. Il n’est pas superposé à une autre finition. Son identifiant
est 28 dans les liens. Les anciennes valeurs de construction `azure` sont converties en
relief plat et finition azurée, en conservant une autre finition lorsqu’elle était déjà
explicitement choisie. Les petites secondes et les compteurs panda historiques restent lisibles.

Le chemin de fer, qui est une graduation graphique, ne figure plus dans le choix de
relief des mini-cadrans. Les anciennes valeurs `rail` sont lues comme `flat`, sans
rejeter les autres réglages du lien. Le chemin de fer du cadran principal reste indépendant.
Les reliefs et finitions figurent dans la fiche technique et le prompt de génération d’image.

## Organisation et couleurs des mini-cadrans

Les trois panneaux suivent le même ordre : relief, finition et couleur du fond, effets,
graduations, puis aiguille. La réserve ajoute ensuite ses réglages de taille et de position.
La couleur du fond se trouve immédiatement sous la finition. Une finition naturellement
colorée affiche sa coloration propre et ne propose pas de sélecteur inactif.

Les graduations des petites secondes et des compteurs, comme celles de la réserve, peuvent
rester automatiques (contraste calculé sur le fond effectif) ou recevoir une couleur libre.
En mode automatique, le sélecteur de couleur est masqué. La zone de réserve basse possède
ses propres modes automatique/couleur libre et n’apparaît que pour les segments et la jauge
E–F. L’inscription ne se règle que pour l’échelle en heures, où elle est réellement utilisée.
La couleur d’aiguille est indépendante : elle suit les aiguilles principales ou devient libre.
Les choix sont conservés dans le lien et dans la fiche d’identité.

Les boutons de paramètres de la réserve et du chronographe apparaissent lorsque leur
complication est activée (une position ou une disposition choisie, au lieu de « Sans »).

## Points de la piste des minutes

La variante « Points » propose un curseur « Taille des points » de 5 % à 250 %, avec
100 % comme référence historique. Il redimensionne le rayon et le contour des points
pour permettre une réduction réelle, tout en conservant leurs positions et la différence
entre les points de cinq minutes et les points intermédiaires. Le réglage apparaît seulement
pour cette variante, reste mémorisé lorsqu’on en choisit une autre et est conservé dans
le lien (`details.chapterRing.dotSize`), la fiche d’identité et le prompt d’image.

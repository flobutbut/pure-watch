# Bracelet

La ligne **Bracelet**, après les complications, propose quatre matières. Le bouton **Paramètres** ouvre les réglages, également accessibles dans l’aperçu 3D.

| Matière | Formes |
| --- | --- |
| Métal | 3 maillons, 5 maillons, maille milanaise |
| Caoutchouc | Lisse, cannelé, rallye perforé |
| Cuir | Grainé, lisse, rallye perforé ; surpiqûres facultatives et colorées |
| Tissu | Tissé, cannelé, rayé |

Trois longueurs de brins : court **65 / 105 mm**, standard **75 / 115 mm**, long **85 / 125 mm**. L’effilement se règle de 0 à 6 mm, avec une limite adaptée aux petits entre-cornes. La largeur d’attache suit l’entre-cornes, y compris lors d’un changement de taille du boîtier.

Le métal dispose de quatre teintes ; les autres matières ont une couleur libre. La boucle suit par défaut la matière et la finition du boîtier. En mode personnalisé, elle peut être en acier, or jaune, or rose ou noir. Les bracelets souples proposent une boucle ardillon ou déployante ; le métal utilise une déployante.

Le rendu est une présentation courbée des deux brins autour d’une ellipse, avec épaisseur, perforations, passants et fermoir. Les maillons et surpiqûres sont regroupés par matériau pour limiter les appels de dessin. Les dimensions sont des paramètres du prototype, pas une validation de fabrication ou de tour de poignet.

Les aperçus utilisent le même modèle que la montre assemblée. La fiche d’identité et le prompt de génération incluent le bracelet. Les liens existants restent lisibles ; les nouveaux réglages utilisent les identifiants ajoutés `bg` (longueur), `bh` (effilement), `bi` (finition de boucle), sans modifier les identifiants précédents ni les valeurs historiques.

Vérification : `npm run check`, `npm run lint`, `npm test`, `npm run build`, et `npx playwright test e2e/strap.spec.ts --workers=1` (ordinateur et mobile). Les captures du parcours se trouvent dans ce dossier.

## Modèles affinés

Les modèles détaillés gardent les mêmes variantes et les mêmes liens :

- **Métal** : maillons galbés, chanfreins polis, cinq maillons décalés, axes et vis latérales, embouts ajustés au contour du boîtier. La maille milanaise est constituée de fils entrelacés et de lisières, sans bande pleine au dos.
- **Cuir** : dessus rembourré qui s’affine vers la pointe, doublure claire, chants teintés et surpiqûres à deux brins au-dessus d’une gorge. Les trous traversent aussi la doublure ; les perforations rallye ne chevauchent pas les trous de réglage.
- **Caoutchouc** : bordures moulées, cannelures à fond creux, perforations et nervures de ventilation au revers.
- **Tissu** : trame avec fils en relief, lisières renforcées, coutures aux attaches et trous de réglage. Le tissage s’interrompt autour des trous. Les variantes cannelée et rayée gardent cette surface textile.
- **Boucles** : cadre ajouré avec axe et ardillon profilé ; déployante avec lames, axes, couvercle, verrou de sécurité et boutons latéraux. Les passants entourent réellement les brins.

Les cartes de couleur, normales et rugosité sont procédurales et utilisent une échelle physique de 8 mm. Les géométries sont regroupées par surface ; les tests vérifient les douze variantes standard sous 150 000 triangles et 24 objets. Un cache de six modèles par bibliothèque de matériaux réutilise les calculs lors des remontages, avec des copies de géométrie appartenant à chaque montre.

Les vues de contrôle détaillées sont dans `refined/`. Les tests couvrent également les normales des deux brins, les ouvertures traversantes, l’indépendance des ressources et la conservation des réglages par lien.

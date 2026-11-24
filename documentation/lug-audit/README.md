# Contrôle de toutes les cornes

Audit du 24 novembre 2026 : huit variantes (dont l’absence de cornes), trois
raccords et six formes de boîtier. Deux défauts ont été reproduits avant correction.

Le raccord fondu utilisait la partie centrale du boîtier pour calculer la face
intérieure de chaque corne. Cette face pouvait sauter d’un bord à l’autre et fermer
l’espace du bracelet. Le raccord intérieur est désormais limité à la racine de
chaque corne, avec un congé local progressif. Une limite rectiligne à cet endroit
créerait un gradin visible au pied de la corne.

Les grandes faces des cornes intégrées pouvaient aussi traverser le cadran alors
que leurs sommets restaient en dehors. Toute face large est maintenant subdivisée
avant de suivre le contour intérieur, même si aucun de ses trois sommets initiaux
ne nécessite de déplacement. Le bloc central propre aux cornes Intégrées reste
volontaire ; il ne doit pas entrer dans l’ouverture du cadran.

## Couverture

- `lug-clearance.test.ts` vérifie 576 configurations : toutes les variantes et tous
  les raccords sur six boîtiers, avec quatre scénarios de diamètre/profil/cadran.
  Les scénarios couvrent 22, 40 et 48 mm, les quatre profils de carrure et les
  cadrans ronds ou assortis au boîtier.
- Le contrôle porte sur les sommets, les milieux des arêtes et le centre des faces.
  Il recherche les empiétements dans l’ouverture au-dessus du cadran et la matière
  qui ferme le centre de l’espace du bracelet hors de la carrure.
- Douze planches WebGL montrent les 24 variantes par boîtier, de face et de trois
  quarts : 288 rendus. Elles utilisent le constructeur et le studio de production.
- Les parcours existants du panneau Cornes complètent ce contrôle sur ordinateur
  et mobile.

| Boîtier | Face | Trois quarts |
| --- | --- | --- |
| Rond | [Planche](round-front.png) | [Planche](round-quarter.png) |
| Coussin | [Planche](cushion-front.png) | [Planche](cushion-quarter.png) |
| Tonneau | [Planche](tonneau-front.png) | [Planche](tonneau-quarter.png) |
| Octogonal | [Planche](octagon-front.png) | [Planche](octagon-quarter.png) |
| Carré | [Planche](square-front.png) | [Planche](square-quarter.png) |
| Rectangulaire | [Planche](rectangle-front.png) | [Planche](rectangle-quarter.png) |

## Reproduire

Avec le serveur de développement :
[ouvrir la planche interactive](http://127.0.0.1:5173/lugs-review.html).
Les contrôles permettent aussi de choisir le profil, le diamètre et la forme du
cadran. Cette page de contrôle ne fait pas partie du build de production.

Tests géométriques :

```sh
npm test -- --maxWorkers=2 src/render3d/parts/lug-clearance.test.ts src/render3d/parts/lug-join.test.ts
```

Régénération des planches :

```sh
npm run test:e2e -- --config playwright.lugs.config.ts --workers=2
```

La variable `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d’utiliser un Chrome déjà
installé, comme pour les autres parcours navigateur.

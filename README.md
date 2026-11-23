# Épure — configurateur de montre

Prototype web / mobile. Spécification : [`documentation/configurateur.md`](documentation/configurateur.md) · plan : [`documentation/plan-action.md`](documentation/plan-action.md).

## Commandes

| Commande           | Effet                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`      | Serveur de développement (http://localhost:5173)                                        |
| `npm test`         | Tests unitaires (Vitest)                                                                |
| `npm run test:e2e` | Parcours navigateur (Playwright ; la première fois : `npx playwright install chromium`) |
| `npm run check`    | Vérification des types (Svelte + TypeScript strict)                                     |
| `npm run lint`     | ESLint + Prettier                                                                       |
| `npm run build`    | Build de production dans `dist/`                                                        |

## Organisation

```
src/
  core/        # cœur sans dépendance au framework ni à Three.js (règle ESLint)
    catalog/   # schéma zod du catalogue, chargement
    config/    # WatchConfig, valeurs par défaut, lecture/écriture par chemin
    nav/       # navigation en croix (réducteur pur), lien sélection ↔ configuration
    clock/     # angles des aiguilles, cadence
    rules/     # moteur de règles (jalon 1)
  render/      # contrat PartRenderer partagé par le rendu SVG et le rendu 3D
  render2d/    # rendu SVG du prototype (jetable)
  render3d/    # moteur 3D (produit final)
  ui/          # grille, vue 3D, accessibilité
  data/        # catalog.json
  assets/      # SVG exportés de Figma, textures, HDRI
```

## Prototype du coussin bleu

Comparaison locale et bilan : [étude du coussin](documentation/cushion-review/README.md). Avec `npm run dev`, ouvrir [`/review.html`](http://127.0.0.1:5173/review.html) pour comparer les vues synchronisées, ou [`/?pilot=cushion`](http://127.0.0.1:5173/?pilot=cushion) pour le pilote dans le configurateur.

Audit des six jeux d’aiguilles : [comparaisons, corrections et coût](documentation/hands-review/README.md) · [ouvrir le gros plan interactif](http://127.0.0.1:5173/review.html?pilot=black&scope=hands&hands=leaf).

## Liens de configuration

L’adresse `#v1.…` suit automatiquement les options choisies. Copier l’URL permet de retrouver la même montre après rechargement ou dans un autre onglet. Les anciens liens des pilotes restent compatibles. [Format et fonctionnement](documentation/liens-configuration.md).

Formes indépendantes du cadran : [fonctionnement et contrôles](documentation/formes-cadran.md). Raccord des couronnes aux boîtiers : [correction et comparaisons](documentation/crown-review/README.md).

Couleurs libres du cadran et des aiguilles : [panneau, matières et compatibilité](documentation/colors-review/README.md).

Catalogue étendu à 12 jeux d’aiguilles et 10 trotteuses : [nouvelles formes et planches 3D](documentation/hand-variants/README.md).

# Liens de configuration

L’adresse du configurateur décrit désormais la montre affichée :

```text
https://votre-site/#2AAMFCAYGCQESAxYCGQQaCB0CHgkiASUDJmDywjAvAg
```

Chaque choix met le fragment à jour, sans recharger la page. Copier l’adresse suffit pour retrouver la montre après actualisation ou dans un autre onglet/navigateur. Aucune configuration n’est stockée côté serveur ni dans le stockage local du navigateur.

Les boutons précédent/suivant et les changements de fragment restaurent la montre correspondante. La sélection successive des options remplace l’entrée courante de l’historique, pour éviter une entrée par flèche. La navigation entre les lignes ne modifie ni la montre ni le lien. La ligne active et la caméra ne sont pas enregistrées : elles restent distinctes de `WatchConfig`.

Les anciens liens `?pilot=black` et `?pilot=cushion` fonctionnent toujours ; ils sont convertis à l’ouverture. Un fragment explicite prend priorité sur le nom d’un pilote. Les liens « Ouvrir le pilote » du comparateur contiennent maintenant sa configuration réelle, notamment le jeu d’aiguilles sélectionné.

## Format et compatibilité

- Format `2` (fragment `#2…`), écrit depuis novembre 2026 : les champs sans leurs valeurs par défaut, sérialisés en octets compacts puis en base64url. Une couleur tient en 3 octets, un choix d’option en 1. Le lien ne contient que des lettres, des chiffres, `-` et `_` : pas de point que les messageries couperaient, et il est environ trois fois plus court que la v1 (44 caractères au lieu de 128 pour le tonneau noir). Le codec est dans `src/core/config/link-codec.ts`.
- Les liens `#v1.…` (JSON encodé en base64url) restent lus et donnent la même montre.
- Les deux formats partagent les identifiants de champs et d’options attribués dans `src/core/config/url.ts`, indépendamment de l’ordre du catalogue. Ne jamais réattribuer un identifiant ni changer la façon dont le format 2 range une valeur : un test fige un lien déjà partagé.
- Valeurs par défaut v1 figées dans `src/core/config/url-v1-defaults.json`, indépendamment des futurs changements du modèle de départ.
- Couleurs libres, textes Unicode, options masquées, bracelet, mouvement et données de complications conservés. Les champs inconnus ne deviennent jamais des chemins dans l’objet de configuration.
- Valeurs vérifiées à l’ouverture. Les valeurs invalides/inconnues prennent leur défaut ; un message discret signale l’ajustement. Un lien mal formé ou de version non prise en charge affiche la montre par défaut et un message.
- Fragments limités à 16 384 caractères à la lecture. Les liens des configurations pilotes typiques tiennent sous 80 caractères ; des textes et données personnalisés allongent naturellement le lien.

Les réglages de diagnostic du moteur (`model=legacy`, par exemple) restent séparés de la configuration et sont conservés si présents dans l’adresse.

## Vérification

Les tests couvrent toutes les variantes du catalogue, les valeurs personnalisées et Unicode, la stabilité après réorganisation du catalogue, les entrées invalides, le rechargement, l’ouverture dans un autre onglet, précédent/suivant, les choix masqués et l’ouverture de la configuration depuis le comparateur.

La montre qui était ouverte lors de cette modification a été conservée : tonneau en acier poli, 36 mm, sans cornes, verre acrylique, cadran noir mat, chiffres futuristes, aiguilles bâton et trotteuse jaune à contrepoids.

Validation finale : 176 tests unitaires, 26 parcours navigateur distincts (ordinateur et mobile émulé), contrôles de types, lint et build réussis. La configuration ouverte a également été rechargée depuis son lien et capturée dans `url-review/configuration-restored.png`.

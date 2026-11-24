# Raccord des cornes au boîtier

Dans la ligne **Cornes**, le bouton **Paramètres** propose trois raccords dans un contrôle segmenté,
indépendamment du dessin choisi :

| Mode | Dessus | Contour |
| --- | --- | --- |
| Détaché | En retrait, comme précédemment | Jonction visible |
| Affleurant | Racine alignée sur l’épaulement de la carrure | Cornes aux contours distincts |
| Fondu | Racine affleurante | Raccord latéral élargi et adouci dans la carrure |

L’alignement porte sur le dessus de la **carrure, sous la lunette**, pas sur le
dessus du cristal. Les cornes courbes conservent leur descente vers le poignet.
Les raccords suivent le contour réel des six formes de boîtier et les quatre
profils. La jonction est contenue hors de l’ouverture du cadran.

Le choix est prévisualisé dans le panneau, peut être rétabli avant fermeture et
est ensuite enregistré dans l’URL. La suppression des cornes masque le bouton
sans perdre le raccord mémorisé. Les anciens liens gardent le mode Détaché et
leur rendu historique ; le nouveau champ `case.lugJoin` utilise le jeton `ba`
(`1` détaché, `2` affleurant, `3` fondu), omis pour la valeur par défaut.

Les dessus et les flancs sont raccordés en géométrie ; l’ombre artificielle de
jonction est réduite en mode Affleurant et supprimée en mode Fondu. Les matières
continuent de suivre celles du boîtier. Les cornes perforées gardent leurs trous.
La couronne et ses protège-couronnes conservent leur propre raccord.

## Vérifications

- Tests géométriques aux diamètres extrêmes, sur les six formes et quatre profils,
  avec cornes droites, courbes et intégrées : sommets et normales finis, dessus
  aligné, ouverture du cadran dégagée.
- Conservation du lien par défaut et aller-retour du raccord avec cornes perforées.
- Contrôle de l’intérieur des faces, en plus des sommets : les grandes faces de
  la racine sont subdivisées avant projection pour éviter une corde dans le cadran.
- Parcours navigateur sur ordinateur et mobile : aperçu, rétablissement,
  rechargement, URL, masquage sans cornes et restitution du choix.
- Captures comparatives à trois quarts sur rond, coussin et carré, et de profil
  sur le rond. Les images sont produites par `e2e/lug-join.spec.ts`.

| Vue | Détaché | Affleurant | Fondu |
| --- | --- | --- | --- |
| Rond | [Vue](round-detached-desktop.png) | [Vue](round-flush-desktop.png) | [Vue](round-blended-desktop.png) |
| Profil rond | [Vue](round-detached-profile-desktop.png) | [Vue](round-flush-profile-desktop.png) | [Vue](round-blended-profile-desktop.png) |
| Coussin | [Vue](cushion-detached-desktop.png) | [Vue](cushion-flush-desktop.png) | [Vue](cushion-blended-desktop.png) |
| Carré | [Vue](square-detached-desktop.png) | [Vue](square-flush-desktop.png) | [Vue](square-blended-desktop.png) |

Panneau : [ordinateur](panel-desktop.png) · [mobile](panel-mobile.png).
Absence de débordement sur le cadran : [vue de face](round-blended-face-desktop.png).
Configuration signalée, cadran bleu et index ronds : [vue de face](reported-face-desktop.png).

Contrôle étendu après détection de ponts et de faces traversantes :
[audit de toutes les cornes, matrice géométrique et planches](../lug-audit/README.md).

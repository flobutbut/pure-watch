# Impression adoucie

Le filtrage des chiffres, pistes du cadran et graduations du réhaut revient à un biais de mipmap neutre. Le verre conserve sa lecture à pleine résolution.

L'anticrénelage agit uniquement sur une frange bornée autour du seuil alpha. Contrairement à la rampe non bornée de Three.js, cette frange atteint toujours la couverture complète avant un alpha de 0,5 : l'intérieur dense des traits reste plein. Le matériau reste dans la passe opaque du cristal.

Le test navigateur compare chaque rendu à un masque de cœur obtenu avec la même texture et la même géométrie au seuil 0,5. Plus de 98 % de ces pixels doivent rester opaques ; la présence de pixels de bord partiellement couverts vérifie aussi que le lissage est actif. Cadrans crème, blanc, noir et graduations du réhaut sont vérifiés sur ordinateur et mobile.

`comparison.png` et les captures natives comparent l'ancien découpage dur/accentué et le matériau final, aux tailles de 640 et 220 px. Le script `scripts/print-softness-review.mjs` reconstruit l'ancien rendu uniquement pour la comparaison et appelle le helper de production pour le nouveau. Une capture supplémentaire contrôle la transmission du verre.

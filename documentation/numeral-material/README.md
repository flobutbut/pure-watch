# Matière des chiffres

Le bouton **Paramètres** de la ligne **Chiffres** propose, sous la taille et la position,
la **matière des chiffres**. Elle suit le pattern `MaterialField` du design system :

| Matière   | Effets                 | Teinte                                  |
| --------- | ---------------------- | --------------------------------------- |
| Encre     | Mat, Vernis en relief  | couleur des chiffres (encre du cadran ou couleur libre) |
| Métal     | Poli, Brossé           | Acier, Or, Acier bleui, Noir            |
| Lumineux  | —                      | C3, BGW9, C1, Old Radium (aperçu nocturne) |

**Comme les index** reprend la finition des index : appliqués en métal → métal poli de
même teinte ; laqués → encre vernie à leur couleur ; imprimés → encre mate, ou matière
luminescente s'ils en portent une.

## Rendu

L'encre mate reste dans l'impression du cadran : les montres existantes ne changent pas.
Les autres matières sortent les chiffres de l'impression et les posent sur un calque à
part, sur le cadran et sur l'anneau éventuel :

- la forme vient d'une image des chiffres seuls, en blanc ;
- le vernis, le métal poli et la matière luminescente reçoivent un léger relief, tiré de
  la même image floutée ;
- le brossé reprend les lignes du cadran brossé vertical (une seule direction pour tout le
  cadran) ; il se voit surtout de près, sous une lumière rasante ;
- la matière luminescente brille dans l'aperçu nocturne.

La ligne de la grille et la fiche d'identité nomment la matière (« Or · Poli »,
« Lumineux · C3 »…).

## Lien

Le réglage vit dans `details.numerals` (champ `bf`) : `follow`, `kind`, `effect`, `metal`,
`lume`. Absent, il vaut encre mate : les liens existants sont inchangés. Le test du lien
qui parcourt le schéma des détails couvre chaque valeur.

## Vérification

`npm run check`, `npm run lint`, `npm test` : résolution des matières et du mode « Comme
les index », calque des chiffres (absent pour l'encre mate, présent sur le cadran et sur
l'anneau, matériaux poli, brossé, vernis et luminescent), aller-retour du lien.

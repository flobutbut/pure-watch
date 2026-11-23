/**
 * Nuancier RAL Classic : référence de fabrication pour les surfaces laquées ou peintes.
 *
 * Équivalents écran (sRGB) : https://en.wikipedia.org/wiki/List_of_RAL_colours.
 * Ce sont des approximations : la teinte réelle se valide sur un échantillon physique.
 * Les couleurs fluorescentes (1026, 2005, 2007, 3024, 3026, 6038) et celles sans
 * équivalent publié (6031, 6039) sont écartées : un écran ne peut pas les montrer.
 */
import { deltaE2000, hexToLab, type Lab } from './delta-e';

export interface RalColor {
  code: string;
  name: string;
  hex: string;
}

const TABLE = `
1000 CDBA88 Beige vert
1001 D0B084 Beige
1002 D2AA6D Jaune sable
1003 F9A800 Jaune de sécurité
1004 E49E00 Jaune or
1005 CB8E00 Jaune miel
1006 E29000 Jaune maïs
1007 E88C00 Jaune narcisse
1011 AF804F Beige brun
1012 DDAF27 Jaune citron
1013 E3D9C6 Blanc perlé
1014 DDC49A Ivoire
1015 E6D2B5 Ivoire clair
1016 F1DD38 Jaune soufre
1017 F6A950 Jaune safran
1018 FACA30 Jaune zinc
1019 A48F7A Beige gris
1020 A08F65 Jaune olive
1021 F6B600 Jaune colza
1023 F7B500 Jaune signalisation
1024 BA8F4C Jaune ocre
1027 A77F0E Jaune curry
1028 FF9B00 Jaune melon
1032 E2A300 Jaune genêt
1033 F99A1C Jaune dahlia
1034 EB9C52 Jaune pastel
1035 908370 Beige nacré
1036 80643F Or nacré
1037 F09200 Jaune soleil
2000 DD7907 Orangé jaune
2001 BE4E20 Orangé rouge
2002 C63927 Orangé sang
2003 FA842B Orangé pastel
2004 E75B12 Orangé pur
2008 F3752C Orangé rouge clair
2009 E15501 Orangé signalisation
2010 D4652F Orangé de sécurité
2011 EC7C25 Orangé foncé
2012 DB6A50 Orangé saumon
2013 954527 Orangé nacré
2017 FA4402 Orange RAL
3000 AB2524 Rouge feu
3001 A02128 Rouge de sécurité
3002 A1232B Rouge carmin
3003 8D1D2C Rouge rubis
3004 701F29 Rouge pourpre
3005 5E2028 Rouge vin
3007 402225 Rouge noir
3009 703731 Rouge oxyde
3011 7E292C Rouge brun
3012 CB8D73 Rouge beige
3013 9C322E Rouge tomate
3014 D47479 Vieux rose
3015 E1A6AD Rose clair
3016 AC4034 Rouge corail
3017 D3545F Rosé
3018 D14152 Rouge fraise
3020 C1121C Rouge signalisation
3022 D56D56 Rouge saumon
3027 B42041 Rouge framboise
3028 E72512 Rouge pur
3031 AC323B Rouge oriental
3032 711521 Rouge rubis nacré
3033 B24C43 Rose nacré
4001 8A5A83 Lilas rouge
4002 933D50 Violet rouge
4003 D15B8F Violet bruyère
4004 691639 Violet bordeaux
4005 83639D Lilas bleu
4006 992572 Pourpre signalisation
4007 4A203B Violet pourpre
4008 904684 Violet de sécurité
4009 A38995 Violet pastel
4010 C63678 Télémagenta
4011 8773A1 Violet nacré
4012 6B6880 Mûre nacré
5000 384C70 Bleu violet
5001 1F4764 Bleu vert
5002 2B2C7C Bleu outremer
5003 2A3756 Bleu saphir
5004 1D1F2A Bleu noir
5005 154889 Bleu de sécurité
5007 41678D Bleu brillant
5008 313C48 Bleu gris
5009 2E5978 Bleu azur
5010 13447C Bleu gentiane
5011 232C3F Bleu acier
5012 3481B8 Bleu clair
5013 232D53 Bleu cobalt
5014 6C7C98 Bleu pigeon
5015 2874B2 Bleu ciel
5017 0E518D Bleu signalisation
5018 21888F Bleu turquoise
5019 1A5784 Bleu capri
5020 0B4151 Bleu océan
5021 07737A Bleu d’eau
5022 2F2A5A Bleu nocturne
5023 4D668E Bleu distant
5024 6A93B0 Bleu pastel
5025 296478 Gentiane nacré
5026 102C54 Bleu nuit nacré
6000 327662 Vert patine
6001 28713E Vert émeraude
6002 276235 Vert feuillage
6003 4B573E Vert olive
6004 0E4243 Vert bleu
6005 0F4336 Vert mousse
6006 40433B Olive gris
6007 283424 Vert bouteille
6008 35382E Vert brun
6009 26392F Vert sapin
6010 3E753B Vert herbe
6011 68825B Vert réséda
6012 31403D Vert noir
6013 797C5A Vert jonc
6014 444337 Olive jaune
6015 3D403A Olive noir
6016 026A52 Vert turquoise
6017 468641 Vert mai
6018 48A43F Vert jaune
6019 B7D9B1 Vert blanc
6020 354733 Vert oxyde chromique
6021 86A47C Vert pâle
6022 3E3C32 Olive brun
6024 008754 Vert signalisation
6025 53753C Vert fougère
6026 005D52 Vert opale
6027 81C0BB Vert clair
6028 2D5546 Vert pin
6029 007243 Vert menthe
6032 0F8558 Vert de sécurité
6033 478A84 Turquoise menthe
6034 7FB0B2 Turquoise pastel
6035 1B542C Vert nacré
6036 005D4C Vert opale nacré
6037 25E712 Vert pur
7000 7E8B92 Gris petit-gris
7001 8F999F Gris argent
7002 817F68 Gris olive
7003 7A7B6D Gris mousse
7004 9EA0A1 Gris de sécurité
7005 6B716F Gris souris
7006 756F61 Gris beige
7008 746643 Gris kaki
7009 5B6259 Gris vert
7010 575D57 Gris tente
7011 555D61 Gris fer
7012 596163 Gris basalte
7013 555548 Gris brun
7015 51565C Gris ardoise
7016 373F43 Gris anthracite
7021 2E3234 Gris noir
7022 4B4D46 Gris terre d’ombre
7023 818479 Gris béton
7024 474A50 Gris graphite
7026 374447 Gris granit
7030 939388 Gris pierre
7031 5D6970 Gris bleu
7032 B9B9A8 Gris silex
7033 818979 Gris ciment
7034 939176 Gris jaune
7035 CBD0CC Gris clair
7036 9A9697 Gris platine
7037 7C7F7E Gris poussière
7038 B4B8B0 Gris agate
7039 6B695F Gris quartz
7040 9DA3A6 Gris fenêtre
7042 8F9695 Gris signalisation A
7043 4E5451 Gris signalisation B
7044 BDBDB2 Gris soie
7045 91969A Télégris 1
7046 82898E Télégris 2
7047 CFD0CF Télégris 4
7048 888175 Gris souris nacré
8000 887142 Brun vert
8001 9C6B30 Brun terre de Sienne
8002 7B5141 Brun de sécurité
8003 80542F Brun argile
8004 8F4E35 Brun cuivré
8007 6F4A2F Brun fauve
8008 6F4F28 Brun olive
8011 5A3A29 Brun noisette
8012 673831 Brun rouge
8014 49392D Brun sépia
8015 633A34 Marron
8016 4C2F26 Brun acajou
8017 44322D Brun chocolat
8019 3F3A3A Brun gris
8022 211F20 Brun noir
8023 A65E2F Brun orangé
8024 79553C Brun beige
8025 755C49 Brun pâle
8028 4E3B2B Brun terre
8029 773C27 Cuivre nacré
9001 EFEBDC Blanc crème
9002 DDDED4 Blanc gris
9003 F4F8F4 Blanc de sécurité
9004 2E3032 Noir de sécurité
9005 0A0A0D Noir foncé
9006 A5A8A6 Aluminium blanc
9007 8F8F8C Aluminium gris
9010 F7F9EF Blanc pur
9011 1C1C1C Noir graphite
9012 FFFDE6 Blanc salle blanche
9016 F7FBF5 Blanc signalisation
9017 2A2D2F Noir signalisation
9018 CFD3CD Blanc papyrus
9022 858583 Gris clair nacré
9023 7E8182 Gris foncé nacré
`;

export const RAL_CLASSIC: readonly RalColor[] = TABLE.trim()
  .split('\n')
  .map((line) => {
    const [code, hex, ...name] = line.split(' ');
    return { code: code!, hex: `#${hex}`, name: name.join(' ') };
  });

/** Au-delà de cet écart (CIEDE2000), la teinte n'a pas d'équivalent RAL crédible. */
export const RAL_MAX_DELTA = 6;

let labs: Lab[] | undefined;

export interface RalMatch {
  ral: RalColor;
  deltaE: number;
}

/** Teinte RAL la plus proche d'une couleur écran, ou null si aucune n'est assez proche. */
export function nearestRal(hex: string): RalMatch | null {
  const target = hexToLab(hex);
  if (!target) return null;
  labs ??= RAL_CLASSIC.map((c) => hexToLab(c.hex)!);
  let best = -1;
  let bestDelta = Infinity;
  labs.forEach((lab, i) => {
    const delta = deltaE2000(target, lab);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  });
  return bestDelta <= RAL_MAX_DELTA ? { ral: RAL_CLASSIC[best]!, deltaE: bestDelta } : null;
}

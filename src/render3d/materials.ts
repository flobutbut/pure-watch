/**
 * Bibliothèque de matériaux (spec §9.4). Les matériaux sont partagés entre les montres
 * (montre centrale, instantanés) et mis en cache par clé ; seule la bibliothèque les libère.
 */
import * as THREE from 'three';
import { effectiveDialShape } from '../core/geometry/dial-shape';
import { watchDimensions } from '../core/geometry/dimensions';
import { DIAL_PATTERN_SETTINGS, isDialPatternFinish } from './dial-patterns';
import { isBlackTonneau } from '../core/config/instrument';
import { effectiveDialColor, hasIntrinsicColor } from '../core/config/dial';
import { dialSurface } from '../core/config/details';
import { indexColor } from '../core/config/colors';
import { lumeChoice, lumePigment } from '../core/config/lume';
import type { WatchConfig } from '../core/config/types';
import { rehautColor, rehautSettings } from '../core/config/rehaut';
import {
  forgedCarbonTexture,
  grainTextures,
  dialPatternTextures,
  patinaTexture,
  radialAnisotropyTexture,
  radialGradientTexture,
  radialOcclusionTexture,
  swirlTexture,
} from './textures';

interface MetalSpec {
  color: string;
  roughness: number;
  metalness: number;
  clearcoat?: number;
}

/** Matières du boîtier (spec §5.1, §9.4). */
const METALS: Record<string, MetalSpec> = {
  steel: { color: '#C9CED6', roughness: 0.3, metalness: 1 },
  titanium: { color: '#9EA3AA', roughness: 0.4, metalness: 1 },
  bronze: { color: '#B5803A', roughness: 0.34, metalness: 1 },
  'gold-yellow': { color: '#E6C068', roughness: 0.2, metalness: 1 },
  'gold-rose': { color: '#E8B09B', roughness: 0.2, metalness: 1 },
  brass: { color: '#CDAA52', roughness: 0.28, metalness: 1 },
  ceramic: { color: '#0E0F12', roughness: 0.12, metalness: 0, clearcoat: 1 },
  carbon: { color: '#ffffff', roughness: 0.42, metalness: 0.25, clearcoat: 0.8 },
};

/** Teinte de patine par matière : vert-de-gris du bronze, brun du laiton, gris fumé de l'acier. */
const PATINA: Record<string, string> = {
  bronze: '#5E7A62',
  brass: '#6E5B2C',
  'gold-yellow': '#A8873E',
  'gold-rose': '#9C6F5E',
  steel: '#6F747B',
  titanium: '#5F646B',
};

/** Matières à surface propre (céramique, carbone) : la ligne Finition ne s'y applique pas. */
export const INTRINSIC_CASE_MATERIALS = ['ceramic', 'carbon'];

/**
 * Rôle d'une surface dans le boîtier :
 * - brushed : grandes surfaces (flanc, dessus de lunette), brossées si la finition le veut ;
 * - polished : chanfreins et flancs de lunette, polis en finition mixte ;
 * - satin : surfaces sans direction de brossage possible (cornes, ailettes) ;
 * - jewel : couronne et collerette, polies sauf finitions mates.
 */
export type MetalSurface = 'brushed' | 'polished' | 'satin' | 'jewel';

/** Aspect final d'une surface, une fois la finition appliquée. */
type Look = 'brushed' | 'polished' | 'satin' | 'matte';

function lookFor(finish: string, surface: MetalSurface): Look {
  switch (finish) {
    case 'polished':
      return 'polished';
    case 'brushed':
      return surface === 'jewel' ? 'polished' : surface === 'satin' ? 'satin' : 'brushed';
    case 'sandblasted':
    case 'patina':
      return 'matte';
    default: // mixte, PVD : grandes surfaces brossées, chanfreins et couronne polis
      return surface === 'jewel' ? 'polished' : surface;
  }
}

export type CrystalQuality = 'transmission' | 'fallback';

/**
 * Verre poli : ce qu'on voit au travers est lu tel quel, sans flou.
 *
 * three.js impose une rugosité minimale (0,0525) même à un matériau parfaitement lisse ;
 * pour la transmission, il lit alors l'image de la scène dans une mipmap intermédiaire
 * (≈ 0,55 niveau) avec un filtre bicubique lissant. Derrière le cristal, le cadran, ses
 * graduations et les aiguilles bavaient d'un à deux pixels. Le cristal d'une montre est
 * poli comme un miroir : on lit l'image à pleine résolution, en bilinéaire.
 */
function polishedTransmission(material: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const sample = 'textureBicubic( transmissionSamplerMap, fragCoord.xy, lod )';
  material.onBeforeCompile = (shader) => {
    if (!THREE.ShaderChunk.transmission_pars_fragment.includes(sample)) return;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_pars_fragment>',
      THREE.ShaderChunk.transmission_pars_fragment.replace(
        sample,
        'textureLod( transmissionSamplerMap, fragCoord.xy, 0.0 )',
      ),
    );
  };
  material.customProgramCacheKey = () => 'polished-transmission';
  return material;
}

export class MaterialLibrary {
  constructor(
    private readonly refined = true,
    private readonly night = false,
  ) {}
  private readonly cache = new Map<string, THREE.Material>();
  private readonly textures: THREE.Texture[] = [];

  private cached<T extends THREE.Material>(key: string, create: () => T): T {
    let material = this.cache.get(key) as T | undefined;
    if (!material) {
      material = create();
      this.cache.set(key, material);
    }
    return material;
  }

  /** Matière du boîtier, selon matière, finition et rôle de la surface. */
  caseMetal(
    config: WatchConfig,
    surface: MetalSurface,
    /** Vrai pour les géométries qui portent une occlusion en couleurs de sommet. */
    occlusion = false,
  ): THREE.MeshPhysicalMaterial {
    const material = config.case.material in METALS ? config.case.material : 'steel';
    const intrinsic = INTRINSIC_CASE_MATERIALS.includes(material);
    const finish = intrinsic ? 'mixed' : config.case.finish;
    const look = lookFor(finish, surface);
    const instrument = this.refined && isBlackTonneau(config);
    const key = `case:${material}:${finish}:${look}:${occlusion}:${instrument}`;
    return this.cached(key, () => {
      const spec = METALS[material]!;
      const params: THREE.MeshPhysicalMaterialParameters = {
        color: spec.color,
        metalness: spec.metalness,
        roughness: spec.roughness,
        clearcoat: spec.clearcoat ?? 0,
        clearcoatRoughness: 0.05,
        vertexColors: occlusion,
      };

      // Noir PVD / DLC : revêtement sombre sur le métal.
      if (finish === 'pvd-black') {
        params.color = '#1A1C20';
        params.metalness = 0.9;
        params.roughness = 0.36;
      }

      if (material === 'ceramic') {
        // Céramique : vernis miroir sur les chanfreins, satiné sur les grandes surfaces.
        params.roughness = look === 'polished' ? 0.08 : 0.28;
        params.clearcoatRoughness = look === 'polished' ? 0.03 : 0.25;
        if (instrument) {
          // Fired ceramic: satin broad surfaces, a restrained glossy edge.
          params.roughness = look === 'polished' ? 0.11 : look === 'satin' ? 0.43 : 0.36;
          params.clearcoat = look === 'polished' ? 0.85 : 0.18;
          params.clearcoatRoughness = look === 'polished' ? 0.07 : 0.34;
        }
      } else if (material === 'carbon') {
        params.map = this.carbon();
        params.roughness = 0.38;
        params.metalness = 0.35;
      } else if (finish === 'patina') {
        params.color = '#ffffff';
        params.map = this.patina(material);
        params.roughness = 0.55;
        params.metalness = 0.85;
      } else {
        switch (look) {
          case 'polished':
            params.color = new THREE.Color(params.color as string).offsetHSL(0, 0, 0.04);
            params.roughness = finish === 'pvd-black' ? 0.14 : 0.06;
            break;
          case 'brushed':
            // Brossage : reflets étirés le long des lignes (direction = coordonnée u du tour).
            params.anisotropy = 0.65;
            break;
          case 'satin':
            params.roughness = (params.roughness ?? 0.3) + 0.12;
            break;
          case 'matte':
            params.roughness = 0.62;
            break;
        }
      }
      return new THREE.MeshPhysicalMaterial(params);
    });
  }

  private carbonTexture: THREE.Texture | null = null;
  private carbon(): THREE.Texture {
    this.carbonTexture ??= this.keep(forgedCarbonTexture());
    return this.carbonTexture;
  }

  private patinaTextures = new Map<string, THREE.Texture>();
  private patina(material: string): THREE.Texture {
    let texture = this.patinaTextures.get(material);
    if (!texture) {
      const base = METALS[material]?.color ?? '#C9CED6';
      texture = this.keep(patinaTexture(base, PATINA[material] ?? '#6F747B'));
      this.patinaTextures.set(material, texture);
    }
    return texture;
  }

  /** Acier poli des aiguilles et index appliqués : un peu moins miroir, pour rester lisible. */
  polishedSteel(): THREE.MeshPhysicalMaterial {
    return this.cached('hands-steel', () => {
      return new THREE.MeshPhysicalMaterial({ color: '#E8EBF0', metalness: 1, roughness: 0.14 });
    });
  }

  indexMaterial(config: WatchConfig): THREE.MeshStandardMaterial {
    if (config.dial.indices.finish === 'printed') return this.matte(indexColor(config));
    return this.handMaterial(
      {
        ...config,
        hands: {
          ...config.hands,
          finish: config.dial.indices.finish.replace(/^applied-/, ''),
          color: config.dial.indices.color,
        },
      },
      'face',
    );
  }

  luminous(part: {
    lume?: string | null;
    lumeColor: `#${string}`;
    lumeEmission: `#${string}`;
  }): THREE.MeshStandardMaterial {
    const { day, night, kind } = lumeChoice(part);
    const pigment = lumePigment(kind);
    const gain = pigment?.lookGain ?? 1;
    return this.cached(`lume:${day}:${night}:${gain}`, () => {
      const material = new THREE.MeshStandardMaterial({
        color: day,
        roughness: 0.83,
        metalness: 0,
        emissive: night,
        emissiveIntensity: this.night ? 1.45 * gain : 0,
      });
      material.name = 'lume';
      return material;
    });
  }

  /** Satin blade faces and polished bevels; geometry-only comparison keeps old steel. */
  handSteel(surface: 'face' | 'edge'): THREE.MeshPhysicalMaterial {
    if (!this.refined) return this.polishedSteel();
    return this.cached(
      `hand:${surface}`,
      () =>
        new THREE.MeshPhysicalMaterial({
          color: surface === 'face' ? '#DDE2E9' : '#F0F3F7',
          metalness: 1,
          roughness: surface === 'face' ? 0.27 : 0.1,
        }),
    );
  }

  handMaterial(
    config: WatchConfig,
    surface: 'face' | 'edge' | 'plain',
  ): THREE.MeshPhysicalMaterial {
    const { finish, color } = config.hands;
    const metalColors: Record<string, string> = {
      gold: '#D3AA54',
      blued: '#253F79',
      black: '#292E35',
    };
    if (finish !== 'lacquer' && !metalColors[finish])
      return surface === 'plain' ? this.polishedSteel() : this.handSteel(surface);
    return this.cached(
      `hand-finish:${finish}:${finish === 'lacquer' ? color : ''}:${surface}`,
      () =>
        new THREE.MeshPhysicalMaterial({
          color: finish === 'lacquer' ? color : metalColors[finish],
          metalness: finish === 'lacquer' ? 0.05 : 1,
          roughness: surface === 'face' ? 0.25 : 0.12,
          clearcoat: finish === 'lacquer' ? 1 : 0,
          clearcoatRoughness: 0.12,
        }),
    );
  }

  private dialGrainCache: ReturnType<typeof grainTextures> | null = null;

  private grainCache: ReturnType<typeof grainTextures> | null = null;

  /** Textures de grain, partagées par toutes les couleurs de cadran grainé. */
  private grain(refined = false): ReturnType<typeof grainTextures> {
    if (refined) {
      if (!this.dialGrainCache) {
        // Keep the grains above the minification threshold at the normal watch size.
        this.dialGrainCache = grainTextures(512, 1.5);
        this.keep(this.dialGrainCache.normal);
        this.keep(this.dialGrainCache.roughness);
      }
      return this.dialGrainCache;
    }
    if (!this.grainCache) {
      this.grainCache = grainTextures();
      this.keep(this.grainCache.normal);
      this.keep(this.grainCache.roughness);
    }
    return this.grainCache;
  }

  /** Ombre portée du rehaut sur le bord du cadran (carte d'occlusion radiale, partagée). */
  private readonly dialShadows = new Map<string, THREE.Texture>();
  private readonly dialPatterns = new Map<string, ReturnType<typeof dialPatternTextures>>();

  /** Cadran, selon finition et couleur (spec §5.5, §9.4). */
  dial(config: WatchConfig, extentMm?: number): THREE.MeshPhysicalMaterial {
    const finish = config.dial.finish;
    const color = effectiveDialColor(config.dial);
    const refined = this.refined;
    const shape = effectiveDialShape(config.dial.shape);
    const span = isDialPatternFinish(finish)
      ? Number((2 * (extentMm ?? watchDimensions(config).dialExtent)).toFixed(3))
      : 0;
    const surface = dialSurface(config);
    const legacyFume =
      finish === 'fume' || (finish === 'sunburst' && config.details?.dial?.legacyFume === true);
    return this.cached(
      `dial:${finish}:${color}:${refined}:${shape}:${span}:${JSON.stringify(config.details?.dial)}`,
      () => {
        const material = this.dialMaterial(
          legacyFume ? 'fume' : finish,
          color,
          refined,
          shape,
          span / surface.grainSize,
        );
        if (config.details?.dial && !hasIntrinsicColor(finish)) {
          if (material.normalMap) {
            material.normalScale.multiplyScalar(surface.grainDepth);
            if (finish === 'grained' && surface.grainSize !== 1) {
              material.normalMap = this.keep(material.normalMap.clone());
              material.normalMap.repeat.multiplyScalar(1 / surface.grainSize);
              if (material.roughnessMap) {
                material.roughnessMap = this.keep(material.roughnessMap.clone());
                material.roughnessMap.repeat.multiplyScalar(1 / surface.grainSize);
              }
            }
            material.roughness = surface.grainRoughness;
          }
          if (surface.fume > 0 || legacyFume) {
            const center = new THREE.Color(color);
            if (legacyFume) center.offsetHSL(0, 0, 0.08);
            const edge =
              surface.edgeColor === 'auto'
                ? new THREE.Color(color).multiplyScalar(0.18)
                : new THREE.Color(surface.edgeColor);
            edge.copy(center.clone().lerp(edge, surface.fume));
            material.color.set('#ffffff');
            material.map = this.keep(
              radialGradientTexture(
                center.getStyle(),
                edge.getStyle(),
                shape === 'round' ? 512 : 256,
                shape,
              ),
            );
          }
        }
        let shadow = this.dialShadows.get(shape);
        if (!shadow) {
          shadow = this.keep(radialOcclusionTexture(shape === 'round' ? 512 : 256, shape));
          this.dialShadows.set(shape, shadow);
        }
        material.aoMap = shadow;
        material.aoMapIntensity = 1;
        return material;
      },
    );
  }

  private dialMaterial(
    finish: string,
    color: string,
    refined: boolean,
    shape: string,
    span: number,
  ): THREE.MeshPhysicalMaterial {
    const c = new THREE.Color(color);
    const light = c.getHSL({ h: 0, s: 0, l: 0 }).l > 0.45;
    if (isDialPatternFinish(finish)) {
      const key = `${finish}:${span}`;
      let maps = this.dialPatterns.get(key);
      if (!maps) {
        maps = dialPatternTextures(finish, span);
        this.keep(maps.normal);
        this.keep(maps.roughness);
        this.dialPatterns.set(key, maps);
      }
      return new THREE.MeshPhysicalMaterial({
        color: c,
        metalness: DIAL_PATTERN_SETTINGS[finish].metalness,
        roughness: 1,
        roughnessMap: maps.roughness,
        normalMap: maps.normal,
        normalScale: new THREE.Vector2(1, 1),
        anisotropy: finish === 'vertical-brushed' ? 0.88 : finish === 'circular-brushed' ? 0.78 : 0,
        anisotropyMap: finish === 'circular-brushed' ? this.keep(radialAnisotropyTexture()) : null,
        anisotropyRotation: Math.PI / 2,
        clearcoat: finish === 'hammered' ? 0.25 : 0,
        clearcoatRoughness: 0.24,
        sheen: finish === 'leather' ? 0.12 : 0,
        sheenRoughness: 0.9,
        sheenColor: finish === 'leather' ? c : new THREE.Color('#ffffff'),
      });
    }
    return (() => {
      switch (finish) {
        // L'iridescence colore la réflexion spéculaire : il faut un fond qui réfléchit
        // (métallique, assez clair) pour que les couleurs du film apparaissent.
        case 'iridescent-pearl':
          return new THREE.MeshPhysicalMaterial({
            color: c.clone().multiplyScalar(light ? 0.92 : 1),
            metalness: light ? 0.5 : 0.35,
            roughness: 0.32,
            iridescence: 1,
            iridescenceIOR: 1.4,
            iridescenceThicknessRange: [250, 950],
            iridescenceThicknessMap: this.keep(swirlTexture(9, 1.7)),
            sheen: light ? 0.5 : 1,
            sheenColor: new THREE.Color('#f4e9ff'),
            sheenRoughness: 0.45,
          });
        case 'iridescent-oil':
          return new THREE.MeshPhysicalMaterial({
            color: c.clone().lerp(new THREE.Color('#aeb4bf'), 0.45),
            metalness: 1,
            roughness: 0.26,
            iridescence: 1,
            iridescenceIOR: 1.6,
            iridescenceThicknessRange: [250, 1150],
            iridescenceThicknessMap: this.keep(swirlTexture(3.2, 4.1)),
          });
        // Soleillé : métal brossé en rayons depuis le centre.
        case 'sunburst':
          return new THREE.MeshPhysicalMaterial({
            color: c,
            metalness: 0.75,
            roughness: 0.3,
            anisotropy: 0.85,
            anisotropyMap: this.keep(radialAnisotropyTexture()),
          });
        // Fumé : soleillé dont le bord s'assombrit.
        case 'fume': {
          const center = c.clone().offsetHSL(0, 0, 0.08).getStyle();
          const edge = c.clone().multiplyScalar(0.18).getStyle();
          return new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            map: this.keep(
              radialGradientTexture(center, edge, shape === 'round' ? 512 : 256, shape),
            ),
            metalness: 0.65,
            roughness: 0.32,
            anisotropy: 0.8,
            anisotropyMap: this.keep(radialAnisotropyTexture()),
          });
        }
        // Grainé : visible relief and scattered reflections, independent of case shape.
        case 'grained': {
          const grain = this.grain(refined);
          const strength = refined ? (light ? 0.35 : 0.65) : 1.4;
          return new THREE.MeshPhysicalMaterial({
            color: c,
            metalness: refined ? 0.45 : 0.62,
            roughness: 1,
            roughnessMap: grain.roughness,
            normalMap: grain.normal,
            normalScale: new THREE.Vector2(strength, strength),
          });
        }
        // Laqué : couleur profonde sous un vernis miroir.
        case 'lacquer':
          return new THREE.MeshPhysicalMaterial({
            color: c,
            metalness: 0,
            roughness: 0.3,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
          });
        default:
          return new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.85 });
      }
    })();
  }

  /** Rehaut : anneau incliné entre lunette et cadran, mat, dans la teinte du cadran. */
  rehaut(config: WatchConfig): THREE.MeshStandardMaterial {
    const settings = rehautSettings(config);
    if (settings.finish === 'metal') return this.caseMetal(config, 'satin', true);
    const color = rehautColor(config);
    // (clé distincte de l'ancienne version sans couleurs de sommet)
    return this.cached(`rehaut:${settings.finish}:${color}`, () => {
      const c = new THREE.Color(color);
      if (settings.finish !== 'custom')
        c.offsetHSL(0, 0, c.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? -0.06 : 0.03);
      // Couleurs de sommet : le pied du rehaut, contre le cadran, est dans l'ombre.
      return new THREE.MeshStandardMaterial({
        color: c,
        metalness: 0,
        roughness: 0.8,
        vertexColors: true,
      });
    });
  }

  /** Laque colorée (trotteuse). */
  lacquer(color: string): THREE.MeshPhysicalMaterial {
    return this.cached(`lacquer:${color}`, () => {
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.35,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      });
    });
  }

  /** Matière mate unie (fonds de contexte des aperçus). */
  matte(color: string): THREE.MeshStandardMaterial {
    return this.cached(`matte:${color}`, () => {
      return new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 });
    });
  }

  /**
   * Cristal saphir. La transmission (réfraction réelle) coûte une passe de rendu
   * supplémentaire : repli sur un verre transparent à reflets sur appareil modeste.
   */
  crystal(
    config: WatchConfig,
    quality: CrystalQuality,
    /** Épaisseur traversée pour la réfraction (la loupe de date en veut moins). */
    thickness = 0.8,
  ): THREE.MeshPhysicalMaterial {
    const ior =
      config.crystal.type === 'acrylic' ? 1.49 : config.crystal.type === 'mineral' ? 1.52 : 1.77;
    const tint = config.crystal.coating === 'ar-blue' ? '#e6eeff' : '#ffffff';
    return this.cached(`crystal:${ior}:${tint}:${quality}:${thickness}`, () => {
      const common = {
        color: tint,
        metalness: 0,
        roughness: 0,
        ior,
        specularIntensity: 0.45, // traitement antireflet léger
        envMapIntensity: 1,
      };
      return quality === 'transmission'
        ? polishedTransmission(
            new THREE.MeshPhysicalMaterial({ ...common, transmission: 1, thickness }),
          )
        : new THREE.MeshPhysicalMaterial({
            ...common,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          });
    });
  }

  private keep<T extends THREE.Texture>(texture: T): T {
    this.textures.push(texture);
    return texture;
  }

  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.cache.clear();
    this.textures.length = 0;
  }
}

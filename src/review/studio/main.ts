/**
 * Banc de rendu studio (studio.html) : banc local, hors du build publié.
 * La montre vient du lien (#v1.… du configurateur) ; essais : ?tex=1024, ?key=1.5.
 */
import { mount } from 'svelte';
import '../../app.css';
import rawCatalog from '../../data/catalog.json';
import { parseCatalog } from '../../core/catalog/load';
import { configUrl, readConfigUrl } from '../../core/config/url';
import { refinementFromSearch } from '../../render3d/refinement';
import type { StudioBench as Engine } from './engine';
import StudioBench from './StudioBench.svelte';

declare global {
  interface Window {
    /** Le moteur du banc, pour la console et les tests de bout en bout. */
    __studio: Engine;
  }
}

const query = new URLSearchParams(location.search);
const { config } = readConfigUrl(new URL(location.href), parseCatalog(rawCatalog));

mount(StudioBench, {
  target: document.getElementById('app')!,
  props: {
    config,
    refinement: refinementFromSearch(location.search),
    configLink: configUrl(config, new URL('/', location.href)).href,
    textureSize: Number(query.get('tex')) || undefined,
    keyScale: Number(query.get('key')) || undefined,
  },
});

<script lang="ts">
  import { onMount } from 'svelte';
  import rawCatalog from './data/catalog.json';
  import { parseCatalog } from './core/catalog/load';
  import { visibleRows } from './core/rules/visibility';
  import { configUrl, encodeConfigHash, readConfigUrl } from './core/config/url';
  import { bezelAngle } from './core/config/bezel';
  import type { WatchConfig } from './core/config/types';
  import { withColorChoice, type ColorChoice, type ColorTarget } from './core/config/colors';
  import {
    applyVariant,
    selectionFromConfig,
    syncSelection,
    toRowViews,
  } from './core/nav/selection';
  import {
    createNavState,
    selectedIndex,
    step,
    transition,
    type Bump,
    type NavCommand,
  } from './core/nav/state';
  import type { PartRenderer } from './render/types';
  import Grid from './ui/grid/Grid.svelte';
  import Ambience from './ui/Ambience.svelte';
  import ColorPanel from './ui/colors/ColorPanel.svelte';
  import AppChrome from './ui/AppChrome.svelte';
  import { ambienceFor } from './ui/ambience';
  import { bootStage, bootTheme } from './ui/boot';

  const catalog = parseCatalog(rawCatalog);

  const initialLink = readConfigUrl(new URL(location.href), catalog);
  const initialConfig = initialLink.config;
  let linkNotice = $state(initialLink.notice);
  let lastConfigUrl = location.href;
  let config = $state.raw(initialConfig);
  let colorTarget = $state<ColorTarget | null>(null);
  const editing = $derived(colorTarget !== null);
  let cardShown = $state(false);
  let previewConfig = $state.raw<WatchConfig | null>(null);
  // Lignes affichées : celles dont les prérequis sont remplis (principe 5 de la spec).
  const rows = $derived(visibleRows(catalog.rows, config));
  const rowViews = $derived(toRowViews(rows));

  const initialRows = visibleRows(catalog.rows, initialConfig);
  let nav = $state.raw({
    // La sélection est mémorisée pour toutes les lignes, visibles ou non.
    ...createNavState(toRowViews(catalog.rows), selectionFromConfig(catalog, initialConfig)),
    activeRow: Math.max(
      0,
      initialRows.findIndex((row) => row.id === 'hands'),
    ),
  });
  let bump = $state.raw<{ dir: Bump; n: number }>({ dir: null, n: 0 });
  let announcement = $state('');
  let renderer = $state.raw<PartRenderer | null>(null);
  const ambience = $derived(ambienceFor((previewConfig ?? config).dial));
  const colorPresets = $derived([
    // Chiffres : blanc et noir d'impression, puis les accents de la trotteuse.
    ...(colorTarget === 'numerals'
      ? [
          { name: 'Blanc', color: '#F2F1EC' },
          { name: 'Noir', color: '#1B1F27' },
          { name: 'Or', color: '#C9A24A' },
        ]
      : []),
    ...(
      catalog.rows.find(
        (row) =>
          row.id ===
          (colorTarget === 'seconds' || colorTarget === 'numerals'
            ? 'seconds-color'
            : 'dial-color'),
      )?.variants ?? []
    )
      .filter((variant) => typeof variant.value === 'string' && variant.value.startsWith('#'))
      .map((variant) => ({ name: variant.i18n.name, color: variant.value as string })),
  ]);

  /** Leaves the panel without touching the configuration (a link took over). */
  function dropColor() {
    colorTarget = null;
    previewConfig = null;
  }
  function previewColor(choice: ColorChoice) {
    if (colorTarget) previewConfig = withColorChoice(config, colorTarget, choice);
  }
  /** Closing the panel saves: the watch keeps the colour it shows. */
  function closeColor(choice?: ColorChoice) {
    if (!colorTarget) return;
    const next = choice ? withColorChoice(config, colorTarget, choice) : previewConfig;
    if (next && encodeConfigHash(next) !== encodeConfigHash(config)) {
      config = next;
      linkNotice = '';
      announcement =
        colorTarget === 'numerals'
          ? 'Réglages des chiffres enregistrés'
          : colorTarget === 'indices'
            ? 'Réglages des index enregistrés'
            : 'Couleur enregistrée';
    }
    dropColor();
  }

  // Couleur de fond du document (barre d'adresse mobile, débordements) et thème clair/sombre.
  $effect(() => {
    document.documentElement.style.backgroundColor = ambience.base;
    document.documentElement.style.colorScheme = ambience.tone;
    // Read by CSS (sheets): light-dark() is transpiled away in production builds.
    document.documentElement.dataset.tone = ambience.tone;
    // La vue de chargement prend la teinte du cadran : elle se fond dans la grille.
    bootTheme(ambience.base, ambience.ink);
  });

  function syncConfigUrl(next: WatchConfig) {
    const url = configUrl(next, new URL(location.href));
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    lastConfigUrl = url.href;
  }

  // Replace the current entry: option browsing must not fill the Back history.
  $effect(() => syncConfigUrl(config));

  function followConfigUrl() {
    if (location.href === lastConfigUrl) return;
    dropColor();
    lastConfigUrl = location.href;
    const loaded = readConfigUrl(new URL(location.href), catalog);
    linkNotice = loaded.notice;
    if (encodeConfigHash(loaded.config) === encodeConfigHash(config)) {
      syncConfigUrl(config);
      return;
    }
    const rowId = rows[nav.activeRow]?.id ?? 'hands';
    const inspecting = nav.mode === 'view3d' || nav.mode === 'opening3d';
    clearTimeout(modeTimer);
    config = loaded.config;
    const nextRows = visibleRows(catalog.rows, config);
    const preferred = nextRows.findIndex((row) => row.id === rowId);
    nav = {
      ...createNavState(toRowViews(catalog.rows), selectionFromConfig(catalog, config)),
      activeRow:
        preferred >= 0
          ? preferred
          : Math.max(
              0,
              nextRows.findIndex((row) => row.id === 'hands'),
            ),
      mode: inspecting ? 'view3d' : 'grid',
    };
    announcement = 'Configuration chargée depuis le lien';
  }

  // Three.js n'est chargé qu'après le premier affichage (chargement paresseux, spec §9.8).
  onMount(() => {
    window.addEventListener('hashchange', followConfigUrl);
    window.addEventListener('popstate', followConfigUrl);
    let disposed = false;
    let instance: PartRenderer | null = null;
    import('./render3d/part-renderer').then(({ PartRenderer3D }) => {
      if (disposed) return;
      instance = new PartRenderer3D(catalog);
      renderer = instance;
      bootStage('engine');
    });
    return () => {
      window.removeEventListener('hashchange', followConfigUrl);
      window.removeEventListener('popstate', followConfigUrl);
      clearTimeout(modeTimer);
      disposed = true;
      instance?.dispose();
    };
  });

  function run(command: NavCommand) {
    if (editing) return;
    const result = step(nav, rowViews, command);
    if (result.bump) bump = { dir: result.bump, n: bump.n + 1 };
    if (!result.changed) return;
    const rowChanged = result.state.activeRow !== nav.activeRow;
    const row = rows[result.state.activeRow]!;
    const index = selectedIndex(result.state, row.id);
    // Moving between rows is navigation, not an instruction to overwrite a custom
    // value loaded from a link with the first catalog variant.
    let selectionByRow = result.state.selectionByRow;
    if (!rowChanged || command.type === 'goto') {
      const before = config;
      config = applyVariant(config, row, index);
      selectionByRow = syncSelection(catalog, before, config, selectionByRow, row.id);
      linkNotice = '';
    }
    // Une ligne a pu apparaître ou disparaître : on retrouve la ligne active par son identifiant.
    nav = {
      ...result.state,
      selectionByRow,
      activeRow: Math.max(
        0,
        rows.findIndex((r) => r.id === row.id),
      ),
    };
    const variant = row.variants[index]?.i18n.name ?? '';
    announcement = rowChanged ? `${row.i18n.name} : ${variant}` : variant;
  }

  const OPEN_MS = 450;
  let modeTimer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    if (editing) return;
    if (nav.mode !== 'grid') return;
    nav = transition(nav, 'open');
    announcement = 'Vue 3D : faites glisser pour tourner la montre, Échap pour revenir';
    clearTimeout(modeTimer);
    modeTimer = setTimeout(() => (nav = transition(nav, 'opened')), OPEN_MS);
  }

  function close() {
    if (nav.mode !== 'view3d' && nav.mode !== 'opening3d') return;
    nav = transition(nav, 'close');
    clearTimeout(modeTimer);
    modeTimer = setTimeout(() => (nav = transition(nav, 'closed')), OPEN_MS);
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      if (colorTarget) closeColor();
      else close();
    }
  }}
/>

<main style:--ink={ambience.ink} style:--veil={ambience.veil}>
  <Ambience {ambience} />
  <AppChrome
    url={configUrl(config, new URL(location.href)).href}
    inspecting={nav.mode === 'view3d' || nav.mode === 'opening3d'}
    colorEditing={editing}
    sheetShown={cardShown}
  />
  <Grid
    {rows}
    {nav}
    {config}
    {previewConfig}
    {colorTarget}
    {renderer}
    {bump}
    oncommand={run}
    onopen={open}
    onclose={close}
    oncard={(shown) => (cardShown = shown)}
    oncolor={(target) => {
      colorTarget = target;
    }}
    onbezel={(angle) => {
      config = { ...config, bezel: { ...config.bezel, angleDeg: bezelAngle(angle) } };
      linkNotice = '';
    }}
  />
  {#if colorTarget}
    <ColorPanel
      target={colorTarget}
      {config}
      presets={colorPresets}
      onpreview={previewColor}
      onclose={closeColor}
    />
  {/if}
  <p class="sr-only" aria-live="polite">{announcement}</p>
  {#if linkNotice}<p class="link-notice" role="status">{linkNotice}</p>{/if}
</main>

<style>
  main {
    --chrome-gutter: clamp(20px, 3vw, 40px);
    --chrome-top: calc(84px + env(safe-area-inset-top));
    color: var(--ink);
    transition: color 600ms var(--ease-out);
  }

  .link-notice {
    position: fixed;
    left: 50%;
    bottom: calc(64px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 20;
    max-width: min(36rem, calc(100vw - 2rem));
    width: max-content;
    margin: 0;
    padding: 0.7rem 1rem;
    border-radius: 0.5rem;
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 2px 18px #0003;
    font-size: 0.85rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>

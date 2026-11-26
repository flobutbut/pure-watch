<script lang="ts">
  import { onMount } from 'svelte';
  import rawCatalog from './data/catalog.json';
  import { parseCatalog } from './core/catalog/load';
  import { PANEL_ROWS, visibleRows } from './core/rules/visibility';
  import {
    configUrl,
    encodeConfigHash,
    opensPreview,
    readConfigUrl,
    shareUrl as sharedLink,
  } from './core/config/url';
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
    type NavState,
  } from './core/nav/state';
  import type { PartRenderer } from './render/types';
  import Grid from './ui/grid/Grid.svelte';
  import Ambience from './ui/Ambience.svelte';
  import ColorPanel from './ui/colors/ColorPanel.svelte';
  import DimensionsPanel from './ui/dimensions/DimensionsPanel.svelte';
  import {
    caseDimensions,
    withCaseDimensions,
    type CaseDimensions,
  } from './core/config/case-dimensions';
  import AppChrome from './ui/AppChrome.svelte';
  import { settingsForRow } from './ui/grid/row-settings';
  import { browsesFrom, commandFromKey, pointerSlider } from './ui/grid/keyboard';
  import { generationPrompt } from './ui/identity/prompt';
  import { ambienceFor, NIGHT_AMBIENCE } from './ui/ambience';
  import { bootStage, bootTheme } from './ui/boot';
  import { localizeCatalog } from './core/i18n/catalog-en';
  import { i18n, t } from './ui/i18n.svelte';

  const catalog = parseCatalog(rawCatalog);
  // Same rows, ids and values in every language: only the names change.
  const catalogs = { fr: catalog, en: localizeCatalog(catalog, 'en') };
  const named = $derived(catalogs[i18n.locale]);

  const initialLink = readConfigUrl(new URL(location.href), catalog);
  /** A received link opens straight on the 3D preview (the address bar then drops the marker). */
  const initialPreview = opensPreview(new URL(location.href));
  const initialConfig = initialLink.config;
  let linkNotice = $state(initialLink.notice);
  let lastConfigUrl = location.href;
  let config = $state.raw(initialConfig);
  let colorTarget = $state<ColorTarget | null>(null);
  let dimensionsEditing = $state(false);
  const editing = $derived(colorTarget !== null || dimensionsEditing);
  let cardShown = $state(false);

  let night = $state(initialConfig.view.night);
  let previewConfig = $state.raw<WatchConfig | null>(null);
  // Lignes affichées : celles dont les prérequis sont remplis (principe 5 de la spec).
  const rows = $derived(visibleRows(named.rows, config));
  const settingsRows = $derived(
    named.rows.filter((row) => (PANEL_ROWS as readonly string[]).includes(row.id)),
  );
  const rowViews = $derived(toRowViews(rows));
  /** Share panel open beside the 3D watch; `opened`: the 3D view was opened for it. */
  let sharing = $state<{ opened: boolean } | null>(null);
  /** Identity card open beside the 3D watch; `opened`: the 3D view was opened for it. */
  let card = $state<{ opened: boolean } | null>(null);
  const shareUrl = $derived(sharedLink(config, new URL(location.href)).href);
  const share = $derived(
    sharing
      ? { url: shareUrl, prompt: generationPrompt(rows, config, shareUrl, i18n.locale) }
      : null,
  );
  const initialRows = visibleRows(catalog.rows, initialConfig);
  let nav = $state.raw<NavState>({
    // La sélection est mémorisée pour toutes les lignes, visibles ou non.
    ...createNavState(toRowViews(catalog.rows), selectionFromConfig(catalog, initialConfig)),
    activeRow: Math.max(
      0,
      initialRows.findIndex((row) => row.id === 'hands'),
    ),
    mode: initialPreview ? 'view3d' : 'grid',
  });
  /**
   * Default dimensions: those of the size chosen in the grid, which the case panel marks on
   * its sliders (not the last saved values, which may be custom).
   */
  const sizeDefaults = $derived.by(() => {
    const row = named.rows.find((r) => r.id === 'case-size')!;
    const variant = row.variants[selectedIndex(nav, row.id)] ?? row.variants[0]!;
    const size = variant.value as Partial<WatchConfig['case']>;
    return {
      name: variant.i18n.name,
      values: caseDimensions({ ...config, case: { ...config.case, ...size } }),
    };
  });
  /**
   * The preview (3D view): the watch with the active row's settings beside it, following the
   * rows browsed with the arrows. The card and sharing take its place while they are open; the
   * panel's × puts the settings away until the view closes.
   */
  let settingsPreview = $state(false);
  const previewSettings = $derived(
    settingsPreview && nav.mode === 'view3d' && !card && !sharing
      ? settingsForRow(rows[nav.activeRow]?.id ?? '', config)
      : null,
  );
  /** The preview's settings panel, asked for its last change before the watch moves on. */
  let previewPanel = $state.raw<{ flush: () => void } | undefined>();
  /** Changes with every step in the preview: the panel starts afresh from the new watch. */
  let previewStep = $state(0);
  /** The colour panel open, in the grid or in the preview (its presets depend on it). */
  const panelTarget = $derived(
    colorTarget ?? (previewSettings && previewSettings !== 'dimensions' ? previewSettings : null),
  );
  let bump = $state.raw<{ dir: Bump; n: number }>({ dir: null, n: 0 });
  let announcement = $state('');
  let renderer = $state.raw<PartRenderer | null>(null);
  const nightPreview = $derived(
    night &&
      (nav.mode === 'view3d' ||
        nav.mode === 'opening3d' ||
        colorTarget === 'hands' ||
        colorTarget === 'indices' ||
        colorTarget === 'numerals'),
  );
  const ambience = $derived(
    nightPreview ? NIGHT_AMBIENCE : ambienceFor((previewConfig ?? config).dial),
  );
  const dialFinishes = $derived(
    (named.rows.find((row) => row.id === 'dial-finish')?.variants ?? []).map((variant) => ({
      value: String(variant.value),
      label: variant.i18n.name,
    })),
  );
  const colorPresets = $derived([
    // Chiffres et minuterie : blanc et noir d'impression, puis les accents de la trotteuse.
    ...(['numerals', 'chapterRing'].includes(panelTarget ?? '')
      ? [
          { name: t().app.white, color: '#F2F1EC' },
          { name: t().app.black, color: '#1B1F27' },
          { name: t().app.gold, color: '#C9A24A' },
        ]
      : []),
    ...(
      named.rows.find(
        (row) =>
          row.id ===
          (['seconds', 'numerals', 'chapterRing'].includes(panelTarget ?? '')
            ? 'seconds-color'
            : 'dial-color'),
      )?.variants ?? []
    )
      .filter((variant) => typeof variant.value === 'string' && variant.value.startsWith('#'))
      .map((variant) => ({ name: variant.i18n.name, color: variant.value as string })),
  ]);

  /** Keeps what the preview's settings panel shows on the watch (the panel saves as it goes). */
  function commitPreview() {
    if (editing) return;
    // A change made just before (the panel sends its preview at most every 100 ms).
    previewPanel?.flush();
    if (!previewConfig) return;
    const before = config;
    const next = previewConfig;
    previewConfig = null;
    if (encodeConfigHash(next) === encodeConfigHash(before)) return;
    config = next;
    nav = {
      ...nav,
      selectionByRow: syncSelection(catalog, before, next, nav.selectionByRow, ''),
    };
    linkNotice = '';
  }

  /** Tool button and R key in the preview: shows or hides the row's settings. */
  function toggleSettings() {
    if (card || sharing) {
      // The settings come back in place of the card or sharing.
      card = null;
      sharing = null;
      settingsPreview = true;
      return;
    }
    if (settingsPreview) commitPreview();
    settingsPreview = !settingsPreview;
  }

  /** The preview's panel closed by itself (×, Escape): the 3D view stays, without settings. */
  function closePreviewSettings(next: WatchConfig) {
    previewPanel?.flush();
    previewConfig = next;
    commitPreview();
    settingsPreview = false;
  }

  /** Leaves the panel without touching the configuration (a link took over). */
  function dropEditor() {
    colorTarget = null;
    dimensionsEditing = false;
    previewConfig = null;
  }
  function previewDimensions(values: CaseDimensions) {
    if (dimensionsEditing) previewConfig = withCaseDimensions(config, values);
  }
  function closeDimensions(values: CaseDimensions) {
    if (!dimensionsEditing) return;
    const before = config;
    const next = withCaseDimensions(config, values);
    if (encodeConfigHash(next) !== encodeConfigHash(before)) {
      config = next;
      nav = {
        ...nav,
        selectionByRow: syncSelection(catalog, before, next, nav.selectionByRow, ''),
      };
      linkNotice = '';
      announcement = t().app.dimensionsSaved;
    }
    dropEditor();
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
          ? t().app.numeralsSaved
          : colorTarget === 'indices'
            ? t().app.indicesSaved
            : t().app.colorSaved;
    }
    dropEditor();
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
  // The address follows the watch as shown, an open panel's change included, so a link copied
  // from the address bar keeps it. Panel changes arrive up to ten times a second while a slider
  // moves: they are grouped, which keeps clear of the browsers' history rate limits.
  $effect(() => {
    const shown = previewConfig;
    if (!shown) return syncConfigUrl(config);
    const timer = setTimeout(() => syncConfigUrl(shown), 300);
    return () => clearTimeout(timer);
  });

  function followConfigUrl() {
    if (location.href === lastConfigUrl) return;
    dropEditor();
    resume = null;
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
    announcement = t().app.linkLoaded;
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
    // The preview's settings are kept before the watch moves on to another variant or row.
    commitPreview();
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
    previewStep++;
    const variant = row.variants[index]?.i18n.name ?? '';
    announcement = rowChanged ? t().app.rowVariant(row.i18n.name, variant) : variant;
  }

  const OPEN_MS = 450;
  let modeTimer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    if (editing) return;
    if (nav.mode !== 'grid') return;
    nav = transition(nav, 'open');
    // However it opens, the preview shows the settings of the row it is on.
    settingsPreview = true;
    announcement = t().app.view3d;
    clearTimeout(modeTimer);
    modeTimer = setTimeout(() => (nav = transition(nav, 'opened')), OPEN_MS);
  }

  /** Settings panel left for the card or sharing: leaving the 3D view comes back to it. */
  let resume = $state.raw<{ color: ColorTarget } | { dimensions: true } | null>(null);

  /** Closes the settings panel, keeping what it shows, and says which panel it was. */
  function suspendEditor(): typeof resume {
    if (colorTarget) {
      const target = colorTarget;
      closeColor();
      return { color: target };
    }
    if (dimensionsEditing) {
      if (previewConfig) closeDimensions(caseDimensions(previewConfig));
      else dropEditor();
      return { dimensions: true };
    }
    return null;
  }

  /**
   * Shows the 3D watch with a panel beside it (card or sharing), from the grid, a settings
   * panel or the 3D view. `opened`: leaving the panel also leaves the view.
   */
  function openPanel(): { opened: boolean } | null {
    commitPreview();
    const from = suspendEditor();
    // Switching between card and sharing keeps the way back of the first one.
    const opened = nav.mode === 'grid' || (card?.opened ?? sharing?.opened ?? false);
    if (nav.mode === 'grid') open();
    else if (nav.mode !== 'view3d' && nav.mode !== 'opening3d') return null;
    if (from) resume = from;
    return { opened };
  }

  /** Sharing shows the watch in 3D beside the panel, as the identity card does. */
  function openShare() {
    if (sharing) return closeShare(true);
    const panel = openPanel();
    if (!panel) return;
    card = null;
    sharing = panel;
  }

  /** The header's card button: opens the 3D view with the identity card beside it. */
  function openCard() {
    if (card) return closeCard(true);
    const panel = openPanel();
    if (!panel) return;
    sharing = null;
    card = panel;
  }

  function closeCard(back: boolean) {
    const opened = card?.opened ?? false;
    card = null;
    if (back && opened) close();
  }

  /** In the 3D view (I key): shows or hides the card, the view stays open. */
  function toggleCard() {
    if (card) return closeCard(false);
    const opened = sharing?.opened ?? false;
    sharing = null;
    card = { opened };
  }

  function closeShare(back: boolean) {
    const opened = sharing?.opened ?? false;
    sharing = null;
    if (back && opened) close();
  }

  /** Curseur de l'aperçu en cours de glissement, à la souris ou au doigt. */
  let slider: Element | null = null;
  /** Relâché, il rend les flèches à la navigation, sans clic dans le vide. */
  function releaseSlider() {
    const control = slider;
    slider = null;
    if (!control) return;
    // Après le `change` du curseur, qui suit le relâchement.
    setTimeout(() => {
      if (document.activeElement !== control) return;
      document.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
    });
  }

  function close() {
    commitPreview();
    settingsPreview = false;
    sharing = null;
    card = null;
    if (nav.mode !== 'view3d' && nav.mode !== 'opening3d') return;
    nav = transition(nav, 'close');
    clearTimeout(modeTimer);
    modeTimer = setTimeout(() => (nav = transition(nav, 'closed')), OPEN_MS);
    // Back to the settings panel the view was opened from.
    const back = resume;
    resume = null;
    if (back && 'color' in back) colorTarget = back.color;
    else if (back) dimensionsEditing = true;
  }
</script>

<svelte:window
  onpointerdowncapture={(e) => {
    slider = previewSettings === null ? null : pointerSlider(e.target, '[data-preview-panel]');
  }}
  onpointerupcapture={releaseSlider}
  onpointercancelcapture={releaseSlider}
  onkeydown={(e) => {
    // Modal sheets own Escape and commit their last valid values.
    if (e.key === 'Escape' && !editing && !e.defaultPrevented) close();
    // The preview's panel is beside the view, outside the grid: its plain buttons leave the
    // arrows to the rows, and the view takes the keyboard back.
    if (previewSettings === null || e.defaultPrevented) return;
    const command = commandFromKey(e);
    if (!command || !browsesFrom(e.target, '[data-preview-panel]')) return;
    e.preventDefault();
    run(command);
    document.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
  }}
/>

<main
  style:--ink={ambience.ink}
  style:--ink-soft={ambience.inkSoft}
  style:--ink-faint={ambience.inkFaint}
  style:--veil={ambience.veil}
>
  <Ambience {ambience} />
  <AppChrome
    sharing={sharing !== null}
    onshare={openShare}
    card={card !== null}
    oncard={openCard}
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
    {dimensionsEditing}
    {renderer}
    {bump}
    night={nightPreview}
    onnight={() => (night = !night)}
    oncommand={run}
    onopen={open}
    settings={previewSettings !== null}
    settingsOn={settingsPreview && !card && !sharing}
    settingsAvailable={settingsForRow(rows[nav.activeRow]?.id ?? '', config) !== null}
    ontogglesettings={toggleSettings}
    onclose={close}
    card={card !== null}
    ontogglecard={toggleCard}
    oncardclose={() => closeCard(true)}
    onpanel={(shown) => (cardShown = shown)}
    {share}
    onshareclose={closeShare}
    captureBackground={ambience.base}
    oncolor={(target) => {
      colorTarget = target;
    }}
    ondimensions={() => {
      dimensionsEditing = true;
    }}
    onbezel={(angle) => {
      commitPreview();
      config = { ...config, bezel: { ...config.bezel, angleDeg: bezelAngle(angle) } };
      linkNotice = '';
    }}
  />
  {#if colorTarget}
    <ColorPanel
      target={colorTarget}
      {config}
      presets={colorPresets}
      finishes={dialFinishes}
      {settingsRows}
      {night}
      onnight={() => (night = !night)}
      onpreview={previewColor}
      onclose={closeColor}
    />
  {:else if dimensionsEditing}
    <DimensionsPanel
      {config}
      defaults={sizeDefaults}
      onpreview={previewDimensions}
      onclose={closeDimensions}
    />
  {:else if previewSettings === 'dimensions'}
    {#key previewStep}
      <div data-preview-panel class="preview-panel">
        <DimensionsPanel
          bind:this={previewPanel}
          {config}
          defaults={sizeDefaults}
          companion
          onpreview={(values) => (previewConfig = withCaseDimensions(config, values))}
          onclose={(values) => closePreviewSettings(withCaseDimensions(config, values))}
        />
      </div>
    {/key}
  {:else if previewSettings}
    {@const target = previewSettings}
    {#key `${target}:${previewStep}`}
      <div data-preview-panel class="preview-panel">
        <ColorPanel
          bind:this={previewPanel}
          {target}
          {config}
          presets={colorPresets}
          finishes={dialFinishes}
          {settingsRows}
          {night}
          companion
          onnight={() => (night = !night)}
          onpreview={(choice) => (previewConfig = withColorChoice(config, target, choice))}
          onclose={(choice) => closePreviewSettings(withColorChoice(config, target, choice))}
        />
      </div>
    {/key}
  {/if}
  <p class="sr-only" aria-live="polite">{announcement}</p>
  {#if linkNotice}<p class="link-notice" role="status">{t().linkNotice[linkNotice]}</p>{/if}
</main>

<style>
  main {
    --chrome-gutter: clamp(20px, 3vw, 40px);
    --chrome-top: calc(84px + env(safe-area-inset-top));
    color: var(--ink);
    transition: color 600ms var(--ease-out);
  }

  .link-notice {
    pointer-events: none;
    position: fixed;
    left: 50%;
    bottom: calc(64px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 20;
    max-width: min(36rem, calc(100vw - 2rem));
    width: max-content;
    margin: 0;
    padding: 0.7rem 1rem;
    border-radius: var(--radius-s);
    background: var(--veil);
    color: var(--ink);
    box-shadow: 0 2px 18px #0003;
    font-size: 0.85rem;
  }

  /* A wrapper only: the panel inside is placed on its own (fixed). */
  .preview-panel {
    display: contents;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>

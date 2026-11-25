<script lang="ts">
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { targetColor, type ColorTarget } from '../../core/config/colors';
  import { tint } from '../../core/color/names';
  import { hasIntrinsicColor } from '../../core/config/dial';
  import { turnBezel } from '../../core/config/bezel';
  import { matchesValue } from '../../core/config/path';
  import { mm } from '../../core/movement/compatibility';
  import { selectedIndex, type Bump, type NavCommand, type NavState } from '../../core/nav/state';
  import type { LiveWatch as LiveHandle, PartRenderer } from '../../render/types';
  import LiveWatch from '../view3d/LiveWatch.svelte';
  import BezelControl from '../view3d/BezelControl.svelte';
  import IdentityCard from '../identity/IdentityCard.svelte';
  import ShareDialog from '../ShareDialog.svelte';
  import Cell from './Cell.svelte';
  import { i18n, t } from '../i18n.svelte';
  import { dragSteps, WheelStepper, wheelPixels, type Axis } from './gestures';
  import { commandFromKey } from './keyboard';
  import { colorForRow as rowColor } from './row-settings';
  import {
    gridMetrics,
    hierarchy,
    pixelSnap,
    rowEnds,
    visibleSlots,
    type CellSlot,
  } from './layout';

  interface Props {
    rows: readonly RowDef[];
    nav: NavState;
    config: WatchConfig;
    previewConfig: WatchConfig | null;
    colorTarget: ColorTarget | null;
    dimensionsEditing?: boolean;
    night?: boolean;
    onnight: () => void;
    renderer: PartRenderer | null;
    /** Dernier rebond de bord, avec un compteur pour rejouer le même. */
    bump: { dir: Bump; n: number };
    oncommand: (command: NavCommand) => void;
    onopen: () => void;
    onclose: () => void;
    oncolor: (target: ColorTarget) => void;
    ondimensions: () => void;
    /** The preview shows a settings panel beside the watch. */
    settings?: boolean;
    /** The preview's settings are on (the row may have none to show). */
    settingsOn?: boolean;
    /** The active row has settings the preview can show. */
    settingsAvailable?: boolean;
    /** Shows or hides the preview's settings (tool button, R key). */
    ontogglesettings?: () => void;
    onbezel: (angle: number) => void;
    /** The identity card is wanted beside the 3D watch (header button or I key). */
    card?: boolean;
    /** I key in the 3D view: shows or hides the card. */
    ontogglecard?: () => void;
    /** The card closed itself (×, click outside, Escape). */
    oncardclose?: () => void;
    /** Signale l'affichage d'un panneau à côté de la montre (le pied de page lui laisse la place). */
    onpanel?: (shown: boolean) => void;
    /** Share panel, shown beside the watch in place of the identity card. */
    share?: { url: string; prompt: string } | null;
    /** `back`: also leave the 3D view if it was opened for sharing. */
    onshareclose?: (back: boolean) => void;
    /** Background the screenshot is laid on (the page's base colour). */
    captureBackground?: string;
  }

  let {
    rows,
    nav,
    config,
    previewConfig,
    colorTarget,
    dimensionsEditing = false,
    night = false,
    onnight,
    renderer,
    bump,
    oncommand,
    onopen,
    onclose,
    oncolor,
    ondimensions,
    settings = false,
    settingsOn = false,
    settingsAvailable = false,
    ontogglesettings,
    onbezel,
    card = false,
    ontogglecard,
    oncardclose,
    onpanel,
    share = null,
    onshareclose,
    captureBackground,
  }: Props = $props();
  /** A side panel is open: the grid steps back behind it. */
  const editing = $derived(colorTarget !== null || dimensionsEditing);

  let width = $state(0);
  let height = $state(0);
  let grid: HTMLDivElement;

  const metrics = $derived(gridMetrics(width || 1440, height || 1024));
  const open = $derived(nav.mode === 'opening3d' || nav.mode === 'view3d');
  const selected = (rowIndex: number) => selectedIndex(nav, rows[rowIndex]!.id);
  const sizePreset = (config: WatchConfig) =>
    rows
      .find((row) => row.id === 'case-size')
      ?.variants.find((v) => matchesValue(config.case, v.value));
  const sizeLabel = (config: WatchConfig) =>
    sizePreset(config)?.i18n.name ??
    `${mm(config.case.diameterMm, 1, i18n.locale)} · ${t().grid.custom}`;

  /** Dernière colonne de chaque cellule (non réactif : sert à détecter les sauts). */
  let lastCol: Record<string, number> = {};

  // Lignes et cellules montées : visibles + une de marge (« ce qu'on ne voit pas n'existe pas »).
  const rowShapes = $derived(
    rows.map((row) => ({ variantCount: row.variants.length, looping: row.looping })),
  );
  const slots = $derived(visibleSlots(rowShapes, nav.activeRow, selected, metrics));

  /** Dernière position de chaque point de fin de ligne (même usage que lastCol). */
  let lastEnd: Record<string, number> = {};
  const ends = $derived.by(() => {
    const seen: Record<string, number> = {};
    const marks = rowEnds(rowShapes, slots).map((end) => {
      const id = rows[end.rowIndex]!.id;
      const previous = lastEnd[id];
      seen[id] = end.dCol;
      return { ...end, id, jump: previous !== undefined && Math.abs(previous - end.dCol) > 2 };
    });
    lastEnd = seen;
    return marks;
  });

  const visibleRows = $derived.by(() => {
    // Les cellules arrivent triées par ligne : on les regroupe dans l'ordre.
    // Une cellule qui saute d'un bord à l'autre (ligne cyclique) ne traverse pas l'écran :
    // elle change de place sans transition.
    const groups: { row: RowDef; rowIndex: number; cells: (CellSlot & { jump: boolean })[] }[] = [];
    const seen: Record<string, number> = {};
    for (const raw of slots) {
      const key = `${rows[raw.rowIndex]!.id}/${raw.variantIndex}`;
      const previous = lastCol[key];
      const slot = { ...raw, jump: previous !== undefined && Math.abs(previous - raw.dCol) > 2 };
      seen[key] = raw.dCol;
      const last = groups[groups.length - 1];
      if (last?.rowIndex === slot.rowIndex) last.cells.push(slot);
      else groups.push({ row: rows[slot.rowIndex]!, rowIndex: slot.rowIndex, cells: [slot] });
    }
    lastCol = seen;
    return groups;
  });

  /* ---------- Glisser (souris, doigt) ---------- */

  interface Drag {
    id: number;
    x0: number;
    y0: number;
    axis: Axis | null;
    offset: number;
    samples: { t: number; p: number }[];
    target: { row: number; variant: number } | null;
    touch: boolean;
  }

  let drag = $state.raw<Drag | null>(null);
  const dragX = $derived(drag?.axis === 'x' ? drag.offset : 0);
  const dragY = $derived(drag?.axis === 'y' ? drag.offset : 0);

  function cellAt(target: EventTarget | null) {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>('[data-row]');
    if (!el) return null;
    return { row: Number(el.dataset['row']), variant: Number(el.dataset['variant']) };
  }

  function onpointerdown(event: PointerEvent) {
    if (open || editing || event.button > 0 || (event.target as HTMLElement).closest('button'))
      return;
    const touch = event.pointerType !== 'mouse';
    // Zone de 20 px à gauche : réservée au geste « retour » du système (iOS).
    if (touch && event.clientX < 20) return;
    drag = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      axis: null,
      offset: 0,
      samples: [],
      target: cellAt(event.target),
      touch,
    };
  }

  function resist(axis: Axis, offset: number): number {
    // Au bord, le geste résiste : la grille suit le doigt à un tiers de la distance.
    const row = rows[nav.activeRow]!;
    if (axis === 'x' && row.looping) return offset;
    const atStart = axis === 'x' ? selected(nav.activeRow) === 0 : nav.activeRow === 0;
    const atEnd =
      axis === 'x'
        ? selected(nav.activeRow) === row.variants.length - 1
        : nav.activeRow === rows.length - 1;
    return (offset > 0 && atStart) || (offset < 0 && atEnd) ? offset * 0.35 : offset;
  }

  function onpointermove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    let axis = drag.axis;
    if (!axis) {
      if (Math.hypot(dx, dy) < (drag.touch ? 10 : 6)) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      grid.setPointerCapture(event.pointerId);
    }
    const raw = axis === 'x' ? dx : dy;
    const samples = [...drag.samples, { t: event.timeStamp, p: raw }].filter(
      (s) => event.timeStamp - s.t < 100,
    );
    drag = { ...drag, axis, offset: resist(axis, raw), samples };
  }

  function onpointerup(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const ended = drag;
    drag = null;
    if (ended.axis) {
      const first = ended.samples[0];
      const last = ended.samples[ended.samples.length - 1];
      const velocity =
        first && last && last.t > first.t ? (last.p - first.p) / (last.t - first.t) : 0;
      const steps = dragSteps(ended.offset, velocity, metrics.pitch);
      if (steps !== 0) {
        oncommand(
          ended.axis === 'x' ? { type: 'variant', delta: steps } : { type: 'row', delta: steps },
        );
      }
      return;
    }
    if (event.type === 'pointercancel' || !ended.target) return;
    const { row, variant } = ended.target;
    if (row === nav.activeRow && variant === selected(row)) onopen();
    else oncommand({ type: 'goto', row, variant });
  }

  /* ---------- Molette et pavé tactile ---------- */

  const stepper = new WheelStepper();

  $effect(() => {
    // Écouteur non passif : on empêche le défilement de la page.
    const onwheel = (event: WheelEvent) => {
      if (open || editing) return;
      event.preventDefault();
      const { dx, dy } = wheelPixels(event);
      const step = stepper.push(dx, dy, event.timeStamp);
      if (step) {
        oncommand(
          step.axis === 'x'
            ? { type: 'variant', delta: step.delta }
            : { type: 'row', delta: step.delta },
        );
      }
    };
    grid.addEventListener('wheel', onwheel, { passive: false });
    return () => grid.removeEventListener('wheel', onwheel);
  });

  /* ---------- Clavier ---------- */

  let live = $state.raw<LiveHandle | null>(null);
  let paused = $state(false);
  let bezelEditing = $state(false);
  // Bezel setting belongs to one visit of the 3D view: it never outlives it.
  $effect(() => {
    if (!open) bezelEditing = false;
  });
  const sharing = $derived(open && share !== null);
  const cardShown = $derived(open && !sharing && card);
  /** One panel at a time beside the watch: the identity card, sharing or the row's settings. */
  const settingsShown = $derived(open && settings && !cardShown && !sharing);
  const panelShown = $derived(cardShown || sharing || settingsShown);
  $effect(() => onpanel?.(panelShown));
  const CAPTURE_PX = 2048;
  const capture = $derived(live ? () => live!.capture(CAPTURE_PX, captureBackground) : null);
  $effect(() =>
    live?.setBezelControl(open && config.bezel.type === 'rotating' && bezelEditing, onbezel),
  );

  /**
   * Vue 3D : les flèches parcourent lignes et variantes comme dans la grille (la montre suit),
   * la souris ou le doigt tournent la montre ; 1 à 5 = vues prédéfinies, P = pause,
   * Espace / Entrée / Échap = fermer. Pendant le réglage de la lunette, ← → la tournent.
   */
  function inspectKey(event: KeyboardEvent): boolean {
    if (config.bezel.type === 'rotating') {
      if (event.key.toLowerCase() === 'b') {
        bezelEditing = !bezelEditing;
        if (bezelEditing) live?.view(0);
        return true;
      }
      if (bezelEditing && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        onbezel(turnBezel(config, event.key === 'ArrowLeft' ? -3 : 3));
        return true;
      }
    }
    const command = commandFromKey(event);
    if (command) {
      oncommand(command);
      return true;
    }
    if (/^[1-5]$/.test(event.key)) {
      live?.view(Number(event.key) - 1);
      return true;
    }
    if (event.key === 'p' || event.key === 'P') {
      paused = live?.togglePause() ?? false;
      return true;
    }
    if (event.key === 'r' || event.key === 'R') {
      ontogglesettings?.();
      return true;
    }
    if (event.key === 'i' || event.key === 'I') {
      ontogglecard?.();
      return true;
    }
    if (event.key === 'n' || event.key === 'N') {
      onnight();
      return true;
    }
    // Les touches qui ouvrent l'aperçu le referment aussi.
    if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') {
      onclose();
      return true;
    }
    return false;
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (editing || target.closest('input, textarea, select')) return;
    // Panels beside the watch handle their own keys (Escape and Space close them).
    if (target.closest('dialog')) return;
    // Buttons retain their native activation; arrows still navigate after closing a colour panel.
    if (target.closest('button') && (event.key === 'Enter' || event.key === ' ')) return;
    if (open) {
      if (inspectKey(event)) event.preventDefault();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onopen();
      return;
    }
    const command = commandFromKey(event);
    if (!command) return;
    event.preventDefault();
    oncommand(command);
  }

  /* ---------- Rebond de bord (spec §2.5) ---------- */

  let bumpX = $state(0);
  let bumpY = $state(0);
  $effect(() => {
    const { dir, n } = bump;
    if (!dir || n === 0) return;
    const amount = 8;
    bumpX = dir === 'left' ? amount : dir === 'right' ? -amount : 0;
    bumpY = dir === 'up' ? amount : dir === 'down' ? -amount : 0;
    const timer = setTimeout(() => {
      bumpX = 0;
      bumpY = 0;
    }, 120);
    return () => clearTimeout(timer);
  });

  // Le focus revient sur la grille quand la vue 3D se referme (spec §3.7). Un lien reçu
  // s'ouvre directement sur l'aperçu : la vue prend aussi le clavier au chargement, avant
  // que la fiche ne s'ouvre (elle rend alors le focus à la vue, comme après Entrée).
  let keyboardGiven = false;
  $effect(() => {
    if (nav.mode === 'grid' || !keyboardGiven) grid.focus({ preventScroll: true });
    keyboardGiven = true;
  });

  /* ---------- Montre centrale : petite dans la grille, grande à l'ouverture ---------- */

  /** Densité de l'écran : les montres et cellules sont calées sur ses pixels (netteté). */
  const dpr = globalThis.devicePixelRatio ?? 1;
  /** Share of the height a settings sheet takes on phones, and the air left above it. */
  const PHONE_SHEET_SHARE = 0.66;
  const PHONE_SHEET_GAP = 12;
  const openSize = $derived(Math.round(Math.min(width, height) * 0.82 * dpr) / dpr);
  const liveScale = $derived(open ? 1 : metrics.watch / Math.max(1, openSize));
  const colorWatchSize = $derived(
    width >= 760
      ? Math.min(width - 400, height * 0.76, 520)
      : Math.min(width * 0.62, height * 0.28),
  );
  /** In the 3D view the identity card takes the right side (or the bottom on phones). */
  // On phones the card is a bottom sheet (52 % of the height): the watch fits between it and the tools.
  const cardBand = $derived({ top: 140, bottom: height * 0.48 });
  const cardWatchSize = $derived(
    width >= 760
      ? Math.min(width - 440, openSize)
      : Math.min(width * 0.86, cardBand.bottom - cardBand.top + 40, openSize),
  );
  const watchScale = $derived(
    editing
      ? colorWatchSize / Math.max(1, openSize)
      : panelShown
        ? cardWatchSize / Math.max(1, openSize)
        : liveScale,
  );
  const sidePanel = $derived(editing || panelShown);
  const watchX = $derived(sidePanel && width >= 760 ? (editing ? -175 : -182) : 0);
  const watchY = $derived(
    editing && width < 760
      ? // Settings are a bottom sheet on phones (Sheet.svelte, --sheet-max: 66dvh): the watch
        // rests just above its top edge instead of touching it.
        height * (1 - PHONE_SHEET_SHARE) - PHONE_SHEET_GAP - colorWatchSize / 2 - height / 2
      : panelShown && width < 760
        ? (cardBand.top + cardBand.bottom) / 2 - height / 2
        : dragY + bumpY,
  );
  const livePlace = $derived(
    pixelSnap(width / 2 + watchX, height / 2 + watchY, openSize, watchScale, dpr),
  );

  /** Metal hands are named by their material; painted surfaces by their tint. */
  const colorLabel = (target: ColorTarget) =>
    target === 'lugs'
      ? t().grid.lugsSettings
      : target === 'hands' && config.hands.finish !== 'lacquer'
        ? (t().handFinish[config.hands.finish] ?? '')
        : tint(targetColor(config, target), i18n.locale).name;

  const colorForRow = (id: string) => rowColor(id, config);

  const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
  const activeRowDef = $derived(rows[nav.activeRow]!);
  const activeVariant = $derived(activeRowDef.variants[selected(nav.activeRow)]!);
</script>

{#snippet settingsIcon()}
  <svg class="settings-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2 5h12M2 11h12" />
    <circle cx="10.5" cy="5" r="1.8" />
    <circle cx="5.5" cy="11" r="1.8" />
  </svg>
{/snippet}

<div
  class="grid"
  class:dragging={drag?.axis}
  class:open
  class:color-editing={editing}
  bind:this={grid}
  bind:clientWidth={width}
  bind:clientHeight={height}
  role="grid"
  aria-busy={nav.mode === 'opening3d' || nav.mode === 'closing3d'}
  tabindex="0"
  aria-label={t().grid.label}
  aria-activedescendant="cell-{activeRowDef.id}-{activeVariant.id}"
  style:--pitch="{metrics.pitch}px"
  style:--cell="{metrics.cell}px"
  style:--stage-x="{watchX}px"
  style:--stage-bottom={panelShown && width < 760 ? 'calc(52dvh + 12px)' : null}
  {onkeydown}
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  onpointercancel={onpointerup}
>
  <div class="cells" inert={open || editing}>
    {#each visibleRows as { row, rowIndex, cells } (row.id)}
      <div class="row" role="row" aria-label={row.i18n.name}>
        {#each cells as slot (row.variants[slot.variantIndex]!.id)}
          {@const variant = row.variants[slot.variantIndex]!}
          {@const isActiveRow = slot.dRow === 0}
          {@const isCenter = isActiveRow && slot.dCol === 0}
          {@const customSize = row.id === 'case-size' && slot.dCol === 0 && !sizePreset(config)}
          {@const h = hierarchy(slot.dCol, slot.dRow)}
          {@const place = pixelSnap(
            width / 2 + slot.dCol * metrics.pitch + (isActiveRow ? dragX + bumpX : 0),
            height / 2 + slot.dRow * metrics.pitch + dragY + bumpY,
            metrics.cell,
            h.scale,
            dpr,
          )}
          <div
            id="cell-{row.id}-{variant.id}"
            class="cell"
            class:center={isCenter}
            class:jump={slot.jump}
            role="gridcell"
            aria-selected={slot.dCol === 0 && !customSize}
            aria-label="{row.i18n.name}, {customSize
              ? sizeLabel(config)
              : `${variant.i18n.name}, ${t().grid.position(slot.variantIndex + 1, row.variants.length)}`}{isCenter
              ? t().grid.center
              : ''}"
            data-row={rowIndex}
            data-variant={slot.variantIndex}
            style:transform="translate({place.x}px, {place.y}px) scale({place.scale})"
            style:opacity={isCenter ? 0 : h.opacity}
          >
            <div class="face">
              <Cell
                {renderer}
                displayPx={place.devicePx}
                request={{
                  rowId: row.id,
                  variantId: variant.id,
                  context: row.previewContext,
                  config,
                  sizePx: Math.round(metrics.cell),
                  pixelRatio,
                  priority:
                    Math.max(Math.abs(slot.dCol), Math.abs(slot.dRow)) + (isActiveRow ? 0 : 0.5),
                }}
              />
            </div>
          </div>
        {/each}
      </div>
    {/each}

    <!-- Fin de ligne : un point entre la dernière variante et la première (la ligne boucle). -->
    {#each ends as end (end.id)}
      {@const isActiveRow = end.dRow === 0}
      <div
        class="row-end"
        class:jump={end.jump}
        aria-hidden="true"
        style:transform="translate({end.dCol * metrics.pitch + (isActiveRow ? dragX + bumpX : 0)}px, {end.dRow *
          metrics.pitch +
          dragY +
          bumpY}px)"
        style:opacity={hierarchy(Math.trunc(end.dCol), end.dRow).opacity * 0.4}
      ></div>
    {/each}

    <!-- Noms des lignes, fixes à gauche : ils suivent les changements de ligne mais pas le
         défilement des variantes. Un voile léger les garde lisibles au-dessus des cellules. -->
    <div class="label-veil" aria-hidden="true"></div>
    {#each visibleRows as { row, rowIndex } (row.id)}
      {@const dRow = rowIndex - nav.activeRow}
      {@const target = colorForRow(row.id)}
      <div
        class="label"
        class:active={dRow === 0}
        data-row={rowIndex}
        data-variant={selected(rowIndex)}
        style:transform="translateY({dRow * metrics.pitch + dragY + bumpY}px)"
        style:opacity={dRow === 0 ? 1 : hierarchy(0, dRow).opacity * 0.75}
      >
        <span class="label-name" aria-hidden="true">{row.i18n.name}</span>
        <span class="label-variant" aria-hidden="true">
          {row.id === 'case-size' ? sizeLabel(config) : row.variants[selected(rowIndex)]?.i18n.name}
        </span>
        {#if row.id === 'case-size'}
          <button
            class="color-button"
            type="button"
            tabindex={dRow === 0 ? 0 : -1}
            aria-label={t().grid.caseDimensions}
            onclick={ondimensions}
          >
            {@render settingsIcon()}
            <span>{t().grid.dimensions}</span>
          </button>
        {/if}
        {#if target}
          {#if target === 'dial' && hasIntrinsicColor(config.dial.finish)}
            <span class="natural" title={t().grid.naturalTitle}>
              {t().grid.natural}
            </span>
          {:else}
            <button
              class="color-button"
              type="button"
              tabindex={dRow === 0 ? 0 : -1}
              aria-label={target === 'chapterRing'
                ? t().grid.chapterRingColor
                : target === 'dial'
                  ? t().grid.dialColor
                  : target === 'lugs'
                    ? t().grid.lugsSettings
                    : target === 'bezel'
                      ? t().grid.bezelColor
                      : target === 'hands'
                        ? t().grid.handsColor
                        : target === 'rehaut'
                          ? t().grid.rehautColor
                          : target === 'numerals'
                            ? t().grid.numeralsSettings
                            : target === 'indices'
                              ? t().grid.indicesSettings
                              : target === 'date' || target === 'ring'
                                ? t().colors[target]
                                : target === 'powerReserve' || target === 'subdials'
                                  ? target === 'subdials' &&
                                    config.complications.some((c) => c.type === 'chronograph')
                                    ? t().colors.chronograph
                                    : t().colors[target]
                                  : t().grid.secondsColor}
              title={colorLabel(target)}
              data-color={targetColor(config, target)}
              onclick={() => oncolor(target)}
            >
              {#if ['numerals', 'indices', 'hands', 'bezel', 'lugs', 'powerReserve', 'subdials', 'date', 'ring'].includes(target)}
                {@render settingsIcon()}
              {:else}
                <span class="color-dot" style:background={targetColor(config, target)}></span>
              {/if}
              <span>
                {[
                  'numerals',
                  'indices',
                  'hands',
                  'bezel',
                  'lugs',
                  'powerReserve',
                  'subdials',
                  'date',
                  'ring',
                ].includes(target)
                  ? t().grid.settings
                  : t().grid.color}
                {#if target !== 'indices' && target !== 'bezel' && target !== 'lugs' && target !== 'powerReserve' && target !== 'subdials' && target !== 'date' && target !== 'ring'}<span
                    class="color-value"
                  >
                    · {target === 'rehaut' && config.rehaut.finish !== 'custom'
                      ? config.rehaut.finish === 'metal'
                        ? t().grid.caseMatch
                        : t().grid.dialMatch
                      : target === 'seconds' && config.hands.second.color === 'match'
                        ? t().grid.handsMatch
                        : (target === 'numerals' && config.dial.indices.numeralColor === 'match') ||
                            (target === 'chapterRing' && config.dial.chapterRingColor === 'match')
                          ? t().grid.ink
                          : colorLabel(target)}
                  </span>{/if}
              </span>
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Mise au point : la montre reste nette, tout le reste passe dans le flou. -->
  <div class="focus-veil" aria-hidden="true"></div>

  <!-- Preview: the active row's name and variant stay sharp, where the grid shows them (on
       phones, level with the watch when a panel takes the bottom of the screen). -->
  <div
    class="preview-label"
    aria-hidden="true"
    style:transform="translateY({open ? watchY : bumpY}px)"
  >
    <span class="label-name">{activeRowDef.i18n.name}</span>
    <span class="label-variant">
      {activeRowDef.id === 'case-size' ? sizeLabel(config) : activeVariant.i18n.name}
    </span>
  </div>

  {#if open}
    {#if config.bezel.type === 'rotating'}
      <BezelControl
        {config}
        bind:editing={bezelEditing}
        onchange={onbezel}
        onedit={() => live?.view(0)}
      />
    {/if}
    <!-- The void around the watch: a click here first closes an open panel (Sheet). -->
    <button class="backdrop" data-backdrop aria-label={t().grid.close3d} onclick={onclose}></button>
    <div class="tools">
      <button
        class="tool"
        aria-label={t().grid.resetView}
        title={t().grid.resetViewTitle}
        onclick={() => live?.view(4)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </svg>
      </button>
      <button
        class="tool"
        aria-label={paused ? t().grid.resume : t().grid.pause}
        aria-pressed={paused}
        title={t().grid.pauseTitle}
        onclick={() => (paused = live?.togglePause() ?? false)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if paused}<path d="M8 5l11 7-11 7z" />{:else}<path d="M9 5v14M15 5v14" />{/if}
        </svg>
      </button>
      <button
        class="tool toggle"
        aria-label={t().grid.rowSettings}
        aria-pressed={settingsOn}
        title={settingsAvailable ? t().grid.rowSettingsTitle : t().grid.noSettings}
        onclick={() => ontogglesettings?.()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16M4 16h16" /><circle cx="15" cy="8" r="2.4" /><circle
            cx="9"
            cy="16"
            r="2.4"
          />
        </svg>
      </button>
      <button
        class="tool"
        aria-label={t().lume.preview}
        aria-pressed={night}
        title={t().lume.previewTitle}
        onclick={onnight}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.6 15.4A8 8 0 0 1 8.6 4.4a8 8 0 1 0 11 11Z" />
        </svg>
      </button>
      <button
        class="tool"
        aria-label={t().grid.close}
        title={t().grid.closeTitle}
        onclick={onclose}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    {#if sharing && share && nav.mode === 'view3d'}
      <ShareDialog
        url={share.url}
        prompt={share.prompt}
        {capture}
        onclose={() => onshareclose?.(true)}
      />
    {:else if cardShown && nav.mode === 'view3d'}
      <IdentityCard {rows} {config} onclose={() => oncardclose?.()} />
    {/if}
  {/if}

  <div
    class="live-slot"
    style:width="{openSize}px"
    style:height="{openSize}px"
    style:transform="translate({livePlace.x}px, {livePlace.y}px) scale({livePlace.scale})"
  >
    <!-- Double clic : réinitialise la vue (spec §3.3). -->
    <div class="live-hit" role="presentation" ondblclick={() => live?.view(4)}>
      <LiveWatch
        {renderer}
        config={{
          ...(previewConfig ?? config),
          view: { ...(previewConfig ?? config).view, night },
        }}
        transient={previewConfig !== null}
        mode={open || editing ? 'inspect' : 'grid'}
        displayScale={livePlace.scale}
        bind:handle={live}
      />
    </div>
  </div>
</div>

<style>
  .grid {
    position: fixed;
    inset: 0;
    /* « clip » et non « hidden » : les cellules de marge hors écran ne doivent jamais
       rendre la grille défilable (un focus ou un scrollIntoView la décalerait). */
    overflow: clip;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left);
  }

  .cells {
    position: absolute;
    inset: 0;
    overflow: clip;
    transition:
      opacity var(--dur-open) var(--ease-open),
      transform var(--dur-open) var(--ease-open);
  }

  .grid.open .cells {
    transform: scale(0.96);
  }

  .grid.color-editing .cells {
    opacity: 0.12;
    pointer-events: none;
  }
  .settings-icon {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
  }
  .settings-icon circle {
    fill: currentColor;
  }
  .color-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: var(--radius-l);
    background: color-mix(in srgb, var(--veil) 80%, transparent);
    color: var(--ink);
    padding: 5px 8px;
    min-height: 32px;
    max-width: 100%;
    margin-top: 5px;
    font: inherit;
    font-size: var(--text-xs);
    letter-spacing: 0;
    cursor: pointer;
  }
  .color-button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 3px;
  }
  .color-button > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .color-dot {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px #8885;
  }
  .color-value {
    color: var(--ink-soft);
  }
  .natural {
    font-size: var(--text-xs);
    color: var(--ink-soft);
    margin-top: 8px;
  }

  .focus-veil {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: color-mix(in srgb, var(--veil) 35%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.15);
    backdrop-filter: blur(18px) saturate(1.15);
    transition: opacity var(--dur-open) var(--ease-open);
  }

  .grid.open .focus-veil {
    opacity: 1;
  }

  /* Shown over the veil only while the preview is open; the watch passes in front of it. */
  .preview-label {
    pointer-events: none;
    cursor: default;
    opacity: 0;
    transition:
      transform var(--dur-row) var(--ease-out),
      opacity var(--dur-open) var(--ease-open);
  }
  .grid.open .preview-label {
    opacity: 1;
  }

  .cell {
    position: absolute;
    /* Placée en JS (pixelSnap) : coin calé sur un pixel physique, réduction depuis le coin. */
    left: 0;
    top: 0;
    width: var(--cell);
    height: var(--cell);
    transform-origin: 0 0;
    border-radius: 50%;
    cursor: pointer;
    /* Masque circulaire doux (spec §2.3) : les gros plans (couronne, corne) s'estompent
       au bord au lieu d'être coupés net. */
    mask-image: radial-gradient(closest-side, #000 86%, transparent 100%);
    transition:
      transform var(--dur-row) var(--ease-out),
      opacity var(--dur-row) var(--ease-out);
  }

  .cell.center {
    cursor: zoom-in;
  }

  .label-veil {
    position: absolute;
    inset: 0 auto 0 0;
    width: clamp(140px, 22vw, 280px);
    pointer-events: none;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--veil) 85%, transparent) 0%,
      color-mix(in srgb, var(--veil) 55%, transparent) 55%,
      transparent 100%
    );
  }

  .label,
  .preview-label {
    position: absolute;
    left: calc(clamp(16px, 2.5vw, 32px) + env(safe-area-inset-left));
    top: 50%;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: clamp(110px, 18vw, 220px);
    line-height: 1.2;
    /* Deux lignes centrées sur l'axe de la rangée. */
    translate: 0 -50%;
    font-size: 13px;
    letter-spacing: 0.03em;
    color: var(--ink);
    cursor: pointer;
    transition:
      transform var(--dur-row) var(--ease-out),
      opacity var(--dur-row) var(--ease-out);
  }

  .label-name,
  .label-variant {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Variante choisie, sous le nom de la ligne : plus petite et plus discrète. */
  .label-variant {
    font-size: var(--text-m);
    letter-spacing: 0.01em;
    color: var(--ink-soft);
  }

  .label.active .label-name,
  .preview-label .label-name {
    font-weight: 600;
  }

  .label.active .label-variant,
  .preview-label .label-variant {
    color: color-mix(in srgb, var(--ink) 50%, var(--ink-soft));
  }

  .grid.dragging .label {
    transition: none;
  }

  .face {
    position: absolute;
    inset: 0;
    transition:
      transform 160ms var(--ease-out),
      filter 160ms var(--ease-out);
  }

  /* Survol (spec §2.3, §2.7) : la cellule est mise en valeur sans bouger de sa place. */
  @media (hover: hover) {
    .grid:not(.dragging):not(.open) .cell:not(.center):hover .face {
      transform: scale(1.08);
      filter: brightness(1.12);
    }
  }

  .row-end {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 3px;
    height: 3px;
    margin: -1.5px 0 0 -1.5px;
    border-radius: 50%;
    background: var(--ink);
    pointer-events: none;
    transition:
      transform var(--dur-row) var(--ease-out),
      opacity var(--dur-row) var(--ease-out);
  }

  .cell.jump,
  .row-end.jump,
  .grid.dragging .row-end,
  .grid.dragging .cell,
  .grid.dragging .live-slot {
    transition: none;
  }

  .grid:focus-visible .cell.center::after {
    content: '';
    position: absolute;
    inset: -14%;
    border-radius: 50%;
    border: 3px solid var(--ink);
    opacity: 0.6;
  }

  .live-slot {
    position: absolute;
    /* Placée en JS (pixelSnap), comme les cellules : rendu 3D pixel pour pixel. */
    left: 0;
    top: 0;
    transform-origin: 0 0;
    pointer-events: none;
    transition: transform var(--dur-open) var(--ease-open);
    will-change: transform;
  }

  .grid.open .live-slot,
  .grid.color-editing .live-slot {
    pointer-events: auto;
    cursor: grab;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: zoom-out;
  }

  .live-hit {
    width: 100%;
    height: 100%;
  }

  .tools {
    position: absolute;
    top: var(--chrome-top, calc(24px + env(safe-area-inset-top)));
    right: calc(var(--chrome-gutter, 24px) + env(safe-area-inset-right));
    z-index: 2;
    display: flex;
    gap: 10px;
  }

  .tool {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ink) 12%, transparent);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .toggle[aria-pressed='true'] {
    background: var(--ink);
  }
  .toggle[aria-pressed='true'] svg {
    stroke: var(--veil);
  }
  .toggle svg circle {
    fill: color-mix(in srgb, var(--ink) 12%, var(--veil));
  }
  .toggle[aria-pressed='true'] svg circle {
    fill: var(--ink);
  }

  .tool svg {
    width: 18px;
    height: 18px;
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linecap: round;
    fill: none;
  }
</style>

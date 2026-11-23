<script lang="ts">
  import type { RowDef } from '../../core/catalog/types';
  import type { WatchConfig } from '../../core/config/types';
  import { targetColor, type ColorTarget } from '../../core/config/colors';
  import { hasIntrinsicColor } from '../../core/config/dial';
  import { selectedIndex, type Bump, type NavCommand, type NavState } from '../../core/nav/state';
  import type { LiveWatch as LiveHandle, PartRenderer } from '../../render/types';
  import LiveWatch from '../view3d/LiveWatch.svelte';
  import Cell from './Cell.svelte';
  import { dragSteps, WheelStepper, wheelPixels, type Axis } from './gestures';
  import { commandFromKey } from './keyboard';
  import { gridMetrics, hierarchy, rowEnds, visibleSlots, type CellSlot } from './layout';

  interface Props {
    rows: readonly RowDef[];
    nav: NavState;
    config: WatchConfig;
    previewConfig: WatchConfig | null;
    colorTarget: ColorTarget | null;
    renderer: PartRenderer | null;
    /** Dernier rebond de bord, avec un compteur pour rejouer le même. */
    bump: { dir: Bump; n: number };
    oncommand: (command: NavCommand) => void;
    onopen: () => void;
    onclose: () => void;
    oncolor: (target: ColorTarget) => void;
  }

  let {
    rows,
    nav,
    config,
    previewConfig,
    colorTarget,
    renderer,
    bump,
    oncommand,
    onopen,
    onclose,
    oncolor,
  }: Props = $props();

  let width = $state(0);
  let height = $state(0);
  let grid: HTMLDivElement;

  const metrics = $derived(gridMetrics(width || 1440, height || 1024));
  const open = $derived(nav.mode === 'opening3d' || nav.mode === 'view3d');
  const selected = (rowIndex: number) => selectedIndex(nav, rows[rowIndex]!.id);

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
    if (open || colorTarget || event.button > 0 || (event.target as HTMLElement).closest('button'))
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
      if (open || colorTarget) return;
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

  /** Vue 3D (spec §3.3) : flèches = pas de 15°, 1 à 5 = vues prédéfinies, P = pause, Espace / Entrée / Échap = fermer. */
  function inspectKey(event: KeyboardEvent): boolean {
    const rotations: Record<string, [number, number]> = {
      ArrowLeft: [-15, 0],
      ArrowRight: [15, 0],
      ArrowUp: [0, 15],
      ArrowDown: [0, -15],
    };
    const rotation = rotations[event.key];
    if (rotation) {
      live?.rotate(...rotation);
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
    // Les touches qui ouvrent l'aperçu le referment aussi.
    if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') {
      onclose();
      return true;
    }
    return false;
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (colorTarget || target.closest('input, textarea, select')) return;
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

  // Le focus revient sur la grille quand la vue 3D se referme (spec §3.7).
  $effect(() => {
    if (nav.mode === 'grid') grid.focus({ preventScroll: true });
  });

  /* ---------- Montre centrale : petite dans la grille, grande à l'ouverture ---------- */

  const openSize = $derived(Math.min(width, height) * 0.82);
  const liveScale = $derived(open ? 1 : metrics.watch / Math.max(1, openSize));
  const colorWatchSize = $derived(
    width >= 760
      ? Math.min(width - 400, height * 0.76, 520)
      : Math.min(width * 0.62, height * 0.28),
  );
  const watchScale = $derived(colorTarget ? colorWatchSize / Math.max(1, openSize) : liveScale);
  const watchX = $derived(colorTarget && width >= 760 ? -175 : 0);
  const watchY = $derived(colorTarget && width < 760 ? -height * 0.3 : dragY + bumpY);

  const colorForRow = (id: string): ColorTarget | null =>
    id === 'dial-finish' ? 'dial' : id === 'hands' ? 'hands' : id === 'seconds' ? 'seconds' : null;

  const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
  const activeRowDef = $derived(rows[nav.activeRow]!);
  const activeVariant = $derived(activeRowDef.variants[selected(nav.activeRow)]!);
</script>

<div
  class="grid"
  class:dragging={drag?.axis}
  class:open
  class:color-editing={colorTarget !== null}
  bind:this={grid}
  bind:clientWidth={width}
  bind:clientHeight={height}
  role="grid"
  tabindex="0"
  aria-label="Configurateur : flèches pour naviguer, Entrée pour voir la montre en 3D"
  aria-activedescendant="cell-{activeRowDef.id}-{activeVariant.id}"
  style:--pitch="{metrics.pitch}px"
  style:--cell="{metrics.cell}px"
  {onkeydown}
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  onpointercancel={onpointerup}
>
  <div class="cells" inert={open || colorTarget !== null}>
    {#each visibleRows as { row, rowIndex, cells } (row.id)}
      <div class="row" role="row" aria-label={row.i18n.name}>
        {#each cells as slot (row.variants[slot.variantIndex]!.id)}
          {@const variant = row.variants[slot.variantIndex]!}
          {@const isActiveRow = slot.dRow === 0}
          {@const isCenter = isActiveRow && slot.dCol === 0}
          {@const h = hierarchy(slot.dCol, slot.dRow)}
          <div
            id="cell-{row.id}-{variant.id}"
            class="cell"
            class:center={isCenter}
            class:jump={slot.jump}
            role="gridcell"
            aria-selected={slot.dCol === 0}
            aria-label="{row.i18n.name}, {variant.i18n.name}, {slot.variantIndex + 1} sur {row
              .variants.length}{isCenter ? ' — montre complète, Entrée pour la voir en 3D' : ''}"
            data-row={rowIndex}
            data-variant={slot.variantIndex}
            style:transform="translate({slot.dCol * metrics.pitch +
              (isActiveRow ? dragX + bumpX : 0)}px, {slot.dRow * metrics.pitch + dragY + bumpY}px)
            scale({h.scale})"
            style:opacity={isCenter ? 0 : h.opacity}
          >
            <div class="face">
              <Cell
                {renderer}
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
          {row.variants[selected(rowIndex)]?.i18n.name}
        </span>
        {#if target}
          {#if target === 'dial' && hasIntrinsicColor(config.dial.finish)}
            <span class="natural" title="Cette finition possède sa propre coloration.">
              Teinte naturelle
            </span>
          {:else}
            <button
              class="color-button"
              type="button"
              tabindex={dRow === 0 ? 0 : -1}
              aria-label={target === 'dial'
                ? 'Couleur du cadran'
                : target === 'hands'
                  ? 'Matière et couleur des aiguilles'
                  : 'Couleur de la trotteuse'}
              title={targetColor(config, target)}
              onclick={() => oncolor(target)}
            >
              <span class="color-dot" style:background={targetColor(config, target)}></span>
              <span>
                Couleur <span class="color-value">
                  · {target === 'seconds' && config.hands.second.color === 'match'
                    ? 'Assortie'
                    : targetColor(config, target).toUpperCase()}
                </span>
              </span>
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Mise au point : la montre reste nette, tout le reste passe dans le flou. -->
  <div class="focus-veil" aria-hidden="true"></div>

  {#if open}
    <button class="backdrop" aria-label="Fermer la vue 3D" onclick={onclose}></button>
    <div class="tools">
      <button
        class="tool"
        aria-label="Réinitialiser la vue"
        title="Réinitialiser la vue (double clic)"
        onclick={() => live?.view(4)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </svg>
      </button>
      <button
        class="tool"
        aria-label={paused ? 'Relancer les aiguilles' : 'Mettre les aiguilles en pause'}
        aria-pressed={paused}
        title="Pause (P)"
        onclick={() => (paused = live?.togglePause() ?? false)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if paused}<path d="M8 5l11 7-11 7z" />{:else}<path d="M9 5v14M15 5v14" />{/if}
        </svg>
      </button>
      <button class="tool" aria-label="Fermer" title="Fermer (Échap)" onclick={onclose}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  {/if}

  <div
    class="live-slot"
    style:width="{openSize}px"
    style:height="{openSize}px"
    style:transform="translate(-50%, -50%) translate({watchX}px, {watchY}px) scale({watchScale})"
  >
    <!-- Double clic : réinitialise la vue (spec §3.3). -->
    <div class="live-hit" role="presentation" ondblclick={() => live?.view(4)}>
      <LiveWatch
        {renderer}
        config={previewConfig ?? config}
        transient={previewConfig !== null}
        mode={open ? 'inspect' : 'grid'}
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
  .color-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--veil) 80%, transparent);
    color: var(--ink);
    padding: 5px 8px;
    min-height: 32px;
    max-width: 100%;
    margin-top: 5px;
    font: inherit;
    font-size: 10px;
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
    opacity: 0.65;
  }
  .natural {
    font-size: 10px;
    opacity: 0.65;
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

  .cell {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--cell);
    height: var(--cell);
    margin: calc(var(--cell) / -2) 0 0 calc(var(--cell) / -2);
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

  .label {
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
    font-size: 12px;
    letter-spacing: 0.01em;
    opacity: 0.62;
  }

  .label.active .label-name {
    font-weight: 600;
  }

  .label.active .label-variant {
    opacity: 0.85;
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
    left: 50%;
    top: 50%;
    pointer-events: none;
    transition: transform var(--dur-open) var(--ease-open);
    will-change: transform;
  }

  .grid.open .live-slot {
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
    top: calc(24px + env(safe-area-inset-top));
    right: calc(24px + env(safe-area-inset-right));
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

  .tool svg {
    width: 18px;
    height: 18px;
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linecap: round;
    fill: none;
  }
</style>

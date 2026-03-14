<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { widgetStore, type WidgetConfig, type WidgetId } from "../stores/widgetStore.ts";
  import { CATEGORY_COLORS } from "../data/widgetDefaults.ts";
  import { router, type AppView } from "../stores/router.ts";

  export let config: WidgetConfig;
  export let showHeader = true;
  /** If set, shows a → button that navigates to this page */
  export let detailView: AppView | undefined = undefined;

  const dispatch = createEventDispatcher();

  let dragging = false;
  let resizing = false;
  let dragStart = { x: 0, y: 0, rx: 0, ry: 0 };

  // ── Drag ──
  function onHeaderDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest(".wc-btn")) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, rx: config.rect.x, ry: config.rect.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    widgetStore.bringToFront(config.id);
  }

  function onHeaderMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    widgetStore.moveWidget(config.id, dragStart.rx + dx, dragStart.ry + dy);
  }

  function onHeaderUp() {
    dragging = false;
  }

  // ── Resize ──
  function onResizeDown(e: PointerEvent) {
    e.stopPropagation();
    resizing = true;
    dragStart = { x: e.clientX, y: e.clientY, rx: config.rect.w, ry: config.rect.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    widgetStore.bringToFront(config.id);
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizing) return;
    const dw = e.clientX - dragStart.x;
    const dh = e.clientY - dragStart.y;
    widgetStore.resizeWidget(config.id, dragStart.rx + dw, dragStart.ry + dh);
  }

  function onResizeUp() {
    resizing = false;
  }

  function onMinimize() {
    widgetStore.toggleMinimize(config.id);
  }

  function onClose() {
    widgetStore.toggleVisible(config.id);
  }

  function onNavigate() {
    if (detailView) router.navigate(detailView);
  }

  function onBodyClick() {
    widgetStore.bringToFront(config.id);
  }

  $: isEditor = config.id === "editor";
  $: catColor = CATEGORY_COLORS[config.category];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="wc"
  class:wc-dragging={dragging}
  class:wc-resizing={resizing}
  class:wc-editor={isEditor}
  style:left="{config.rect.x}px"
  style:top="{config.rect.y}px"
  style:width="{config.rect.w}px"
  style:height={config.minimized ? "auto" : `${config.rect.h}px`}
  style:z-index={config.zIndex}
  on:click={onBodyClick}
>
  {#if showHeader}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="wc-header"
      on:pointerdown={onHeaderDown}
      on:pointermove={onHeaderMove}
      on:pointerup={onHeaderUp}
    >
      <span class="wc-cat-dot" style:background={catColor}></span>
      <span class="wc-label">{config.label}</span>
      <div class="wc-controls">
        {#if detailView}
          <button class="wc-btn wc-btn-nav" on:click|stopPropagation={onNavigate} title="Open detail page">→</button>
        {/if}
        <button class="wc-btn" on:click|stopPropagation={onMinimize} title={config.minimized ? "Expand" : "Minimize"}>
          {config.minimized ? "□" : "—"}
        </button>
        <button class="wc-btn" on:click|stopPropagation={onClose} title="Hide widget">×</button>
      </div>
    </div>
  {/if}

  {#if !config.minimized}
    <div class="wc-body">
      <slot />
    </div>
    <!-- Resize handle -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="wc-resize"
      on:pointerdown={onResizeDown}
      on:pointermove={onResizeMove}
      on:pointerup={onResizeUp}
    ></div>
  {/if}
</div>

<style>
  .wc {
    position: absolute;
    background: var(--glass-bg, rgba(255, 255, 255, 0.82));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    backdrop-filter: blur(var(--glass-blur, 24px));
    -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    overflow: hidden;
    pointer-events: auto;
    transition: box-shadow 200ms;
    display: flex;
    flex-direction: column;
  }

  .wc:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--border, #E5E0DA);
  }

  .wc-dragging {
    cursor: grabbing;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  /* ── Editor: transparent wrapper — HeroSection provides its own chrome ── */
  .wc-editor {
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .wc-editor:hover {
    box-shadow: none;
  }
  .wc-editor .wc-body {
    padding: 0;
    overflow: visible;
  }

  /* ── Header ── */
  .wc-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    cursor: grab;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0, 0, 0, 0.015);
    user-select: none;
    flex-shrink: 0;
  }

  .wc-dragging .wc-header {
    cursor: grabbing;
  }

  .wc-cat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .wc-label {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.56rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .wc-controls {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .wc-btn {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted, #9a9590);
    font-size: 0.65rem;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .wc-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-primary);
  }
  .wc-btn-nav {
    color: var(--accent, #D97757);
    font-weight: 700;
  }

  /* ── Body ── */
  .wc-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    padding: 8px 10px;
  }

  /* ── Resize handle ── */
  .wc-resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    z-index: 2;
  }
  .wc-resize::after {
    content: "";
    position: absolute;
    bottom: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid rgba(0, 0, 0, 0.12);
    border-bottom: 1.5px solid rgba(0, 0, 0, 0.12);
  }
</style>

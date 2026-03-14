<script lang="ts">
  import { widgetStore, allWidgets } from "../stores/widgetStore.ts";
  import { CATEGORY_COLORS, type WidgetId } from "../data/widgetDefaults.ts";

  export let loggedIn = false;

  function toggle(id: WidgetId) {
    widgetStore.toggleVisible(id);
  }

  function resetAll() {
    widgetStore.resetLayout(loggedIn);
  }
</script>

<div class="dock">
  <div class="dock-pills">
    {#each $allWidgets as w (w.id)}
      <button
        class="dock-pill"
        class:dock-pill-active={w.visible}
        on:click={() => toggle(w.id)}
        title={w.visible ? `Hide ${w.label}` : `Show ${w.label}`}
      >
        <span class="dock-dot" style:background={CATEGORY_COLORS[w.category]}></span>
        <span class="dock-name">{w.label}</span>
      </button>
    {/each}
  </div>
  <button class="dock-reset" on:click={resetAll} title="Reset layout">⟳</button>
</div>

<style>
  .dock {
    position: fixed;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--glass-bg, rgba(255, 255, 255, 0.88));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 20px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    z-index: 9999;
    pointer-events: auto;
    max-width: calc(100vw - 24px);
  }

  .dock-pills {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dock-pill {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 10px;
    padding: 3px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: all 150ms ease;
    opacity: 0.4;
  }

  .dock-pill:hover {
    opacity: 0.7;
    background: rgba(0, 0, 0, 0.03);
  }

  /* Active = widget is visible on canvas */
  .dock-pill-active {
    opacity: 1;
    background: rgba(0, 0, 0, 0.04);
    border-color: var(--border, #E5E0DA);
  }
  .dock-pill-active:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }

  .dock-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .dock-pill-active .dock-dot {
    box-shadow: 0 0 4px currentColor;
  }

  .dock-name {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.5rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
    transition: color 150ms ease;
  }
  .dock-pill-active .dock-name {
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
  }

  .dock-reset {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--text-muted, #9a9590);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    flex-shrink: 0;
    transition: all 150ms ease;
    opacity: 0.5;
  }
  .dock-reset:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-primary, #2D2D2D);
    opacity: 1;
  }
</style>

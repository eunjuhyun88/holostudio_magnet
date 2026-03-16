<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let hint = '';
  /** Optional inline tab bar for switching between focus views */
  export let tabs: { id: string; label: string }[] = [];
  export let activeTab = '';

  const dispatch = createEventDispatcher<{ close: void; tabchange: string }>();

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      dispatch('close');
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="focus-overlay" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" on:click={handleBackdropClick}>
    <div class="focus-card">
      <div class="focus-head">
        <div class="focus-copy">
          <span class="focus-kicker">Research Focus</span>
          <h2 class="focus-title">{title}</h2>
          {#if hint}
            <p class="focus-hint">{hint}</p>
          {/if}
        </div>

        <div class="focus-actions">
          <span class="focus-esc">ESC</span>
          <button class="focus-close" type="button" on:click={() => dispatch('close')} aria-label="Close focused view">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
      </div>

      {#if tabs.length > 0}
        <div class="focus-tabs" role="tablist" aria-label="Research focus views">
          {#each tabs as tab}
            <button
              class="focus-tab"
              class:active={activeTab === tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              on:click={() => dispatch('tabchange', tab.id)}
            >{tab.label}</button>
          {/each}
        </div>
      {/if}

      <div class="focus-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .focus-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay, 240);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px;
    background:
      radial-gradient(circle at top, rgba(217, 119, 87, 0.12), transparent 34%),
      rgba(248, 244, 239, 0.95);
  }

  .focus-card {
    width: min(1400px, 100%);
    max-height: calc(100vh - 56px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(82, 67, 51, 0.12);
    border-radius: 24px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(252, 249, 245, 0.94));
    box-shadow:
      0 30px 80px rgba(40, 29, 18, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.75);
  }

  .focus-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 24px 18px;
    border-bottom: 1px solid rgba(82, 67, 51, 0.08);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(250, 245, 239, 0.84));
  }

  .focus-copy {
    min-width: 0;
  }

  .focus-kicker {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(217, 119, 87, 0.1);
    color: #b65a37;
    font: 700 11px/1 'Inter', -apple-system, sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .focus-title {
    margin: 10px 0 4px;
    color: #1f1811;
    font: 700 28px/1.08 'Inter', -apple-system, sans-serif;
    letter-spacing: -0.04em;
  }

  .focus-hint {
    margin: 0;
    max-width: 720px;
    color: #706458;
    font: 500 14px/1.5 'Inter', -apple-system, sans-serif;
  }

  .focus-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .focus-esc {
    padding: 6px 9px;
    border: 1px solid rgba(82, 67, 51, 0.12);
    border-radius: 999px;
    color: #8d7f70;
    font: 700 11px/1 'JetBrains Mono', 'SF Mono', monospace;
    letter-spacing: 0.06em;
  }

  .focus-close {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(82, 67, 51, 0.12);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    color: #5c5148;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
  }

  .focus-close:hover {
    transform: translateY(-1px);
    border-color: rgba(217, 119, 87, 0.26);
    background: rgba(255, 255, 255, 0.92);
  }

  .focus-close svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 1.8;
    fill: none;
    stroke-linecap: round;
  }

  .focus-tabs {
    display: flex;
    gap: 2px;
    padding: 0 24px;
    border-bottom: 1px solid rgba(82, 67, 51, 0.08);
    background: rgba(250, 248, 245, 0.6);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .focus-tabs::-webkit-scrollbar { display: none; }

  .focus-tab {
    appearance: none;
    border: none;
    background: none;
    padding: 8px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: all 120ms ease;
    margin-bottom: -1px;
  }
  .focus-tab:hover {
    color: var(--text-primary, #2D2D2D);
  }
  .focus-tab.active {
    color: var(--accent, #D97757);
    border-bottom-color: var(--accent, #D97757);
  }

  .focus-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 20px 24px 24px;
  }

  @media (max-width: 720px) {
    .focus-overlay {
      padding: 12px;
    }

    .focus-card {
      max-height: calc(100vh - 24px);
      border-radius: 18px;
    }

    .focus-head {
      padding: 16px 16px 14px;
      gap: 12px;
    }

    .focus-title {
      font-size: 22px;
    }

    .focus-hint {
      font-size: 13px;
    }

    .focus-body {
      padding: 16px;
    }
  }
</style>

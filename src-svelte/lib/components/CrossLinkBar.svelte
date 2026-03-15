<script lang="ts">
  import { router, type AppView } from '../stores/router.ts';

  export let links: { label: string; view: AppView }[] = [];

  function navigate(view: AppView) {
    router.navigate(view);
  }
</script>

<nav class="clb" aria-label="Cross-page navigation">
  {#each links as link}
    <button
      class="clb-chip"
      class:active={$router === link.view}
      on:click={() => navigate(link.view)}
    >
      {link.label}
    </button>
  {/each}
</nav>

<style>
  .clb {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 24px;
    background: rgba(250, 249, 247, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border, #E5E0DA);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .clb::-webkit-scrollbar { display: none; }

  .clb-chip {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-body, 'Inter', sans-serif);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 100px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms;
    letter-spacing: 0.01em;
  }

  .clb-chip:hover {
    color: var(--text-primary, #2D2D2D);
    background: rgba(0, 0, 0, 0.04);
  }

  .clb-chip.active {
    background: var(--accent, #D97757);
    color: #fff;
    border-color: var(--accent, #D97757);
  }

  @media (max-width: 600px) {
    .clb {
      padding: 6px 12px;
      gap: 4px;
    }
    .clb-chip {
      font-size: 0.68rem;
      padding: 3px 10px;
    }
  }
</style>

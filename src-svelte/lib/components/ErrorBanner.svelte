<script lang="ts">
  /** Inline error banner for failed API loads. */
  export let message: string = 'Failed to load data';
  export let onRetry: (() => void) | null = null;
</script>

<div class="error-banner">
  <span class="icon">!</span>
  <span class="text">{message}</span>
  {#if onRetry}
    <button class="retry" on:click={onRetry}>Retry</button>
  {/if}
</div>

<style>
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 60, 60, 0.08);
    border: 1px solid rgba(255, 60, 60, 0.2);
    border-radius: 6px;
    font-size: 12px;
    color: var(--red, #ff3c3c);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 60, 60, 0.15);
    font-weight: 700;
    font-size: 11px;
    flex-shrink: 0;
  }

  .text {
    flex: 1;
  }

  .retry {
    padding: 3px 8px;
    border: 1px solid rgba(255, 60, 60, 0.3);
    border-radius: 4px;
    background: transparent;
    color: var(--red, #ff3c3c);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .retry:hover {
    background: rgba(255, 60, 60, 0.1);
  }
</style>

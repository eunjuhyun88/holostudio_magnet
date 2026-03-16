<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { toastStore, type Toast, type ToastType } from '../stores/toastStore.ts';

  const TYPE_COLORS: Record<ToastType, string> = {
    info: '#89b4fa',
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
  };

  const TYPE_ICONS: Record<ToastType, string> = {
    info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    success: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    error: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z',
  };

  function dismiss(id: number) {
    toastStore.remove(id);
  }
</script>

{#if $toastStore.length > 0}
  <div class="toast-container" role="alert" aria-live="polite">
    {#each $toastStore as toast (toast.id)}
      <div
        class="toast"
        style="--accent: {TYPE_COLORS[toast.type]}"
        in:fly={{ x: 120, duration: 250 }}
        out:fade={{ duration: 150 }}
        animate:flip={{ duration: 200 }}
      >
        <div class="toast-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d={TYPE_ICONS[toast.type]} fill="var(--accent)" />
          </svg>
        </div>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" on:click={() => dismiss(toast.id)} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor" />
          </svg>
        </button>
        <div class="toast-progress" style="animation-duration: {toast.duration}ms" />
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: 380px;
    width: 100%;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(30, 30, 46, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid var(--accent);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    color: #cdd6f4;
    font-family: var(--font-body, 'Inter', sans-serif);
    font-size: 0.82rem;
    position: relative;
    overflow: hidden;
  }

  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
    word-break: keep-all;
  }

  .toast-close {
    flex-shrink: 0;
    appearance: none;
    border: none;
    background: none;
    color: #6c7086;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 150ms, background 150ms;
  }
  .toast-close:hover {
    color: #cdd6f4;
    background: rgba(255, 255, 255, 0.08);
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--accent);
    opacity: 0.6;
    animation: toast-shrink linear forwards;
    width: 100%;
    transform-origin: left;
  }

  @keyframes toast-shrink {
    from { transform: scaleX(1); }
    to { transform: scaleX(0); }
  }

  @media (max-width: 480px) {
    .toast-container {
      bottom: 12px;
      right: 12px;
      left: 12px;
      max-width: none;
    }
  }
</style>

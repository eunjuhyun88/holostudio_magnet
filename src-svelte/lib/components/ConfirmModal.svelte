<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  export let open = false;
  export let title = 'Confirm';
  export let message = '';
  export let confirmLabel = 'Confirm';
  export let cancelLabel = 'Cancel';
  export let variant: 'default' | 'danger' = 'default';

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter') handleConfirm();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleCancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="cm-backdrop" on:click={handleBackdropClick} transition:fade={{ duration: 150 }}>
    <div class="cm-card" transition:fly={{ y: 16, duration: 200 }}>
      <h3 class="cm-title">{title}</h3>
      {#if message}
        <p class="cm-message">{message}</p>
      {/if}
      <div class="cm-actions">
        <button class="cm-btn cancel" on:click={handleCancel}>
          {cancelLabel}
        </button>
        <button class="cm-btn confirm" class:danger={variant === 'danger'} on:click={handleConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cm-card {
    background: rgba(30, 30, 46, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 28px 28px 22px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    color: #cdd6f4;
    font-family: var(--font-body, 'Inter', sans-serif);
  }

  .cm-title {
    margin: 0 0 10px;
    font-size: 1rem;
    font-weight: 700;
    color: #cdd6f4;
    line-height: 1.3;
  }

  .cm-message {
    margin: 0 0 20px;
    font-size: 0.85rem;
    color: #a6adc8;
    line-height: 1.5;
    word-break: keep-all;
  }

  .cm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .cm-btn {
    appearance: none;
    border: none;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 9px 20px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 150ms, box-shadow 150ms;
  }

  .cm-btn.cancel {
    background: rgba(255, 255, 255, 0.06);
    color: #a6adc8;
  }
  .cm-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #cdd6f4;
  }

  .cm-btn.confirm {
    background: var(--accent, #D97757);
    color: #fff;
  }
  .cm-btn.confirm:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 0 16px rgba(217, 119, 87, 0.3);
  }

  .cm-btn.confirm.danger {
    background: #f38ba8;
  }
  .cm-btn.confirm.danger:hover {
    background: #e06c88;
    box-shadow: 0 0 16px rgba(243, 139, 168, 0.3);
  }
</style>

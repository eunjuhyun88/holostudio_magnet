<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { agentStore, agentMessages, agentSheetOpen, agentLoading } from "../../stores/agentStore.ts";
  import PixelIcon from "../PixelIcon.svelte";

  let sheetEl: HTMLDivElement;

  // Keyboard handler — Esc closes sheet
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && $agentSheetOpen) {
      agentStore.closeSheet();
    }
  }

  // Auto-scroll to bottom when new messages arrive
  $: if ($agentMessages.length && sheetEl) {
    requestAnimationFrame(() => {
      if (sheetEl) sheetEl.scrollTop = sheetEl.scrollHeight;
    });
  }

  function handleClose() {
    agentStore.closeSheet();
  }

  function handleClear() {
    agentStore.clearMessages();
  }

  function handleBackdropClick() {
    agentStore.closeSheet();
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if $agentSheetOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <!-- Backdrop (dims page content) -->
  <div class="sheet-backdrop" on:click={handleBackdropClick} transition:fade={{ duration: 150 }}></div>

  <!-- Sheet -->
  <div
    class="agent-sheet"
    bind:this={sheetEl}
    transition:fly={{ y: 200, duration: 280, easing: t => 1 - Math.pow(1 - t, 3) }}
    role="dialog"
    aria-label="Agent responses"
  >
    <!-- Sheet header -->
    <div class="sheet-header">
      <div class="sheet-handle"></div>
      <div class="sheet-actions">
        {#if $agentMessages.length > 0}
          <button class="sheet-action" on:click={handleClear} title="Clear messages">
            Clear
          </button>
        {/if}
        <button class="sheet-action sheet-close" on:click={handleClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M4 12L12 4M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div class="sheet-messages">
      {#if $agentMessages.length === 0}
        <div class="sheet-empty">
          <span class="sheet-empty-icon">
            <PixelIcon type="sparkle" size={24} />
          </span>
          <p>HOOT Agent가 도와드릴게요.</p>
          <p class="sheet-empty-hint">모델 검색, 연구 시작, 네트워크 상태 등을 물어보세요.</p>
        </div>
      {:else}
        {#each $agentMessages as msg (msg.id)}
          <div class="msg" class:msg-user={msg.role === 'user'} class:msg-agent={msg.role === 'agent'}>
            {#if msg.role === 'agent'}
              <span class="msg-avatar">
                <PixelIcon type="sparkle" size={14} />
              </span>
            {/if}
            <div class="msg-bubble">
              <p class="msg-content">{msg.content}</p>
              {#if msg.actions && msg.actions.length > 0}
                <div class="msg-actions">
                  {#each msg.actions as action}
                    <button class="msg-action-btn" on:click={action.handler}>
                      {action.label}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}

      {#if $agentLoading}
        <div class="msg msg-agent">
          <span class="msg-avatar">
            <PixelIcon type="sparkle" size={14} />
          </span>
          <div class="msg-bubble msg-loading">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ═══ BACKDROP ═══ */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.12);
    z-index: calc(var(--z-splash, 9999) - 2);
    pointer-events: auto;
  }

  /* ═══ SHEET ═══ */
  .agent-sheet {
    position: fixed;
    bottom: 80px;  /* sits above the dock */
    left: 50%;
    transform: translateX(-50%);
    width: min(600px, 90vw);
    max-height: 70vh;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: calc(var(--z-splash, 9999) - 1);
    background: var(--glass-bg, rgba(255, 255, 255, 0.97));
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
  }

  /* ═══ HEADER ═══ */
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px 4px;
    position: sticky;
    top: 0;
    background: inherit;
    z-index: 1;
  }
  .sheet-handle {
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--border, #E5E0DA);
    flex-shrink: 0;
  }
  .sheet-actions {
    position: absolute;
    right: 12px;
    top: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .sheet-action {
    appearance: none;
    border: none;
    background: transparent;
    font-family: var(--font-mono, monospace);
    font-size: 0.5rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 100ms;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .sheet-action:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-secondary, #6b6560);
  }
  .sheet-close {
    padding: 4px;
  }

  /* ═══ MESSAGES ═══ */
  .sheet-messages {
    flex: 1;
    padding: 8px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 120px;
  }

  /* ═══ EMPTY STATE ═══ */
  .sheet-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    gap: 8px;
  }
  .sheet-empty-icon {
    color: var(--accent, #D97757);
    opacity: 0.6;
    margin-bottom: 4px;
  }
  .sheet-empty p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-secondary, #6b6560);
    font-weight: 500;
  }
  .sheet-empty-hint {
    font-size: 0.72rem !important;
    color: var(--text-muted, #9a9590) !important;
    font-weight: 400 !important;
  }

  /* ═══ MESSAGE BUBBLE ═══ */
  .msg {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    animation: msgIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes msgIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .msg-user {
    justify-content: flex-end;
  }
  .msg-agent {
    justify-content: flex-start;
  }
  .msg-avatar {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: var(--accent-subtle, rgba(217, 119, 87, 0.12));
    color: var(--accent, #D97757);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;
  }
  .msg-bubble {
    max-width: 80%;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .msg-user .msg-bubble {
    background: var(--accent, #D97757);
    color: white;
    border-bottom-right-radius: 4px;
  }
  .msg-agent .msg-bubble {
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-primary, #2D2D2D);
    border-bottom-left-radius: 4px;
  }
  .msg-content {
    margin: 0;
  }

  /* ═══ ACTIONS IN BUBBLE ═══ */
  .msg-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .msg-action-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, white);
    font-family: var(--font-body, 'Inter', sans-serif);
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--accent, #D97757);
    padding: 4px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 100ms;
  }
  .msg-action-btn:hover {
    background: var(--accent-subtle, rgba(217, 119, 87, 0.12));
    border-color: var(--accent, #D97757);
  }

  /* ═══ LOADING DOTS ═══ */
  .msg-loading {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 14px;
  }
  .typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #9a9590);
    animation: typingBounce 1.2s ease-in-out infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingBounce {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-4px); }
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 600px) {
    .agent-sheet {
      width: calc(100vw - 14px);
      bottom: 70px;
      max-height: 60vh;
    }
    .sheet-messages {
      padding: 8px 12px 12px;
    }
    .msg-bubble {
      max-width: 88%;
      font-size: 0.74rem;
    }
  }
</style>

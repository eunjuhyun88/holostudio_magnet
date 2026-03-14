<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ContractCall } from '../data/protocolData.ts';

  export let modalCall: ContractCall | null;
  export let modalOpen: boolean;
  export let modalStep: 'review' | 'pending' | 'confirmed';
  export let walletConnected: boolean;
  export let walletAddress: string;

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: void;
    connectWallet: void;
  }>();
</script>

{#if modalOpen && modalCall}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-interactive-supports-focus -->
  <div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
    <div class="modal-card" class:confirmed={modalStep === 'confirmed'}>
      <!-- Close -->
      <button class="modal-close" on:click={() => dispatch('close')}>×</button>

      {#if modalStep === 'review'}
        <!-- STEP 1: REVIEW -->
        <div class="modal-step-indicator">
          <span class="step active">Review</span>
          <span class="step-arrow">→</span>
          <span class="step">Pending</span>
          <span class="step-arrow">→</span>
          <span class="step">Confirmed</span>
        </div>

        <h3 class="modal-title">{modalCall.title}</h3>

        {#if !walletConnected}
          <div class="modal-wallet-prompt">
            <span>No wallet connected</span>
            <button class="wallet-connect-inline" on:click={() => dispatch('connectWallet')}>Connect Wallet</button>
          </div>
        {:else}
          <div class="modal-wallet-connected">
            <span class="wallet-dot"></span>
            <span>Connected: {walletAddress}</span>
          </div>
        {/if}

        <div class="modal-contract-row">
          <span class="modal-label">Contract</span>
          <span class="modal-mono clickable">{modalCall.contract}</span>
        </div>

        <div class="modal-fn-row">
          <span class="modal-fn">{modalCall.fn}(</span>
          {#each modalCall.params as p}
            <div class="modal-param">
              <span class="param-name">{p.name}</span>
              <span class="param-type">{p.type}</span>
              <span class="param-value">{p.value}</span>
            </div>
          {/each}
          <span class="modal-fn">)</span>
        </div>

        <div class="modal-details">
          <div class="modal-detail"><span>Fee</span><span class="mono">{modalCall.fee}</span></div>
          <div class="modal-detail"><span>Est. Gas</span><span class="mono">{modalCall.gas}</span></div>
        </div>

        <p class="modal-note">{modalCall.note}</p>

        <button
          class="action-btn primary modal-confirm"
          disabled={!walletConnected}
          on:click={() => dispatch('confirm')}
        >
          {walletConnected ? 'Confirm Transaction' : 'Connect Wallet First'}
        </button>

      {:else if modalStep === 'pending'}
        <!-- STEP 2: PENDING -->
        <div class="modal-step-indicator">
          <span class="step done">Review</span>
          <span class="step-arrow">→</span>
          <span class="step active">Pending</span>
          <span class="step-arrow">→</span>
          <span class="step">Confirmed</span>
        </div>

        <div class="modal-pending">
          <div class="spinner"></div>
          <h3>Transaction Pending</h3>
          <p class="modal-mono">Waiting for block confirmation...</p>
          <div class="pending-hash">
            tx: 0x{Math.random().toString(16).slice(2, 10)}...{Math.random().toString(16).slice(2, 6)}
          </div>
        </div>

      {:else if modalStep === 'confirmed'}
        <!-- STEP 3: CONFIRMED -->
        <div class="modal-step-indicator">
          <span class="step done">Review</span>
          <span class="step-arrow">→</span>
          <span class="step done">Pending</span>
          <span class="step-arrow">→</span>
          <span class="step active confirmed-step">Confirmed</span>
        </div>

        <div class="modal-confirmed">
          <div class="confirm-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3>Transaction Confirmed</h3>
          <div class="confirmed-details">
            <span class="modal-mono">Block #18,442,891</span>
            <span class="modal-mono">Gas used: {modalCall.gas}</span>
          </div>
          <button class="action-btn secondary" on:click={() => dispatch('close')}>Done</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
    animation: fadeIn 200ms ease;
  }

  .modal-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    animation: scaleIn 300ms var(--ease-out-expo);
    box-shadow: var(--shadow-lg);
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: none;
    background: var(--page-bg);
    border-radius: 50%;
    font-size: 1.1rem;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
  }
  .modal-close:hover {
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .modal-step-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .step { padding: 4px 10px; border-radius: var(--radius-pill); transition: all 200ms; }
  .step.active { background: var(--accent-subtle); color: var(--accent); }
  .step.done { color: var(--green); }
  .step.confirmed-step { background: rgba(39,134,74,0.1); color: var(--green); }
  .step-arrow { color: var(--border); }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--text-primary);
  }

  .modal-wallet-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(192,57,43,0.06);
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .wallet-connect-inline {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    transition: all 150ms;
  }
  .wallet-connect-inline:hover {
    background: var(--accent);
    color: #fff;
  }

  .modal-wallet-connected {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(39,134,74,0.06);
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--green);
    font-weight: 600;
  }

  .wallet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    display: inline-block;
    animation: breathe 2s infinite;
  }

  .modal-contract-row, .modal-fn-row, .modal-details {
    margin-bottom: 12px;
  }

  .modal-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  .modal-mono {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .modal-mono.clickable {
    cursor: pointer;
    transition: color 150ms;
  }
  .modal-mono.clickable:hover { color: var(--accent); }

  .modal-fn-row {
    background: var(--page-bg);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .modal-fn { color: var(--accent); font-weight: 700; }

  .modal-param {
    display: flex;
    gap: 8px;
    padding: 4px 0 4px 16px;
    align-items: baseline;
  }

  .param-name { color: var(--text-primary); font-weight: 600; }
  .param-type { color: var(--text-muted); font-size: 0.65rem; }
  .param-value { color: var(--text-secondary); margin-left: auto; }

  .modal-details {
    display: flex;
    gap: 24px;
  }

  .modal-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
  }
  .modal-detail span:first-child {
    color: var(--text-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .modal-note {
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 12px 0 20px;
    padding: 10px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--accent);
  }

  .modal-confirm { margin-top: 0; }

  .mono { font-family: var(--font-mono); }

  /* Pending state */
  .modal-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-pending h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin: 0;
  }

  .pending-hash {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 6px 12px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
  }

  /* Confirmed state */
  .modal-confirmed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }

  .confirm-check {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(39,134,74,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 400ms var(--ease-spring);
  }

  .confirm-check svg { width: 24px; height: 24px; }

  .modal-confirmed h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin: 0;
    color: var(--green);
  }

  .confirmed-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  /* Action buttons (shared pattern) */
  .action-btn {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.9rem;
    padding: 14px 24px;
    border-radius: var(--radius-md, 10px);
    width: 100%;
    border: none;
    cursor: pointer;
    transition: all 200ms;
    position: relative;
    overflow: hidden;
  }

  .action-btn.primary {
    background: var(--accent, #D97757);
    color: #fff;
  }
  .action-btn.primary:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 16px rgba(217,119,87,0.3);
    transform: translateY(-1px);
  }

  .action-btn.secondary {
    background: var(--page-bg, #FAF9F7);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .action-btn.secondary:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
  }

  .action-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
</style>

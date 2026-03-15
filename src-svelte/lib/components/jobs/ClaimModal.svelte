<script lang="ts">
  import { onDestroy } from 'svelte';
  import { wallet } from '../../stores/walletStore.ts';

  interface EnrichedJob {
    id: string;
    state: string;
    nodeIds: string[];
    workerIds: string[];
    nodeCount: number;
    workerCount: number;
    estBudget: number;
    progress: number;
    doneWorkers: number;
    rewardEst: number;
  }

  export let job: EnrichedJob;
  export let myNodeId: string | null = null;

  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  let step: 'review' | 'pending' | 'confirmed' = 'review';
  let timeout: ReturnType<typeof setTimeout> | null = null;

  function confirm() {
    step = 'pending';
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      step = 'confirmed';
    }, 1500);
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    dispatch('close');
  }

  onDestroy(() => {
    if (timeout) clearTimeout(timeout);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-interactive-supports-focus -->
<div class="claim-overlay" on:click|self={close} role="dialog" aria-label="Claim Research Job">
  <div class="claim-modal" class:confirmed={step === 'confirmed'}>
    <button class="claim-modal-close" on:click={close}>&times;</button>

    {#if step === 'review'}
      <div class="claim-step-indicator">
        <span class="cm-step active">Review</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step">Pending</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step">Confirmed</span>
      </div>

      <h3 class="claim-modal-title">Claim Research Job</h3>

      {#if !walletConnected}
        <div class="claim-wallet-prompt">
          <span>No wallet connected</span>
          <button class="claim-wallet-connect" on:click={() => { wallet.connect('Phantom'); }}>Connect Wallet</button>
        </div>
      {:else}
        <div class="claim-wallet-connected">
          <span class="cw-dot"></span>
          <span>Connected: {walletAddress}</span>
        </div>
      {/if}

      <div class="claim-contract-row">
        <span class="claim-label">Contract</span>
        <span class="claim-mono">0x4F0a...7E3d  HootJobs.sol</span>
      </div>

      <div class="claim-fn-row">
        <span class="claim-fn">claimBatch(</span>
        <div class="claim-param">
          <span class="cp-name">jobId</span>
          <span class="cp-type">bytes32</span>
          <span class="cp-value">{job.id}</span>
        </div>
        <div class="claim-param">
          <span class="cp-name">nodeId</span>
          <span class="cp-type">bytes32</span>
          <span class="cp-value">{myNodeId ?? 'N/A'}</span>
        </div>
        <span class="claim-fn">)</span>
      </div>

      <div class="claim-details">
        <div class="claim-detail"><span>Fee</span><span class="claim-mono">0 HOOT</span></div>
        <div class="claim-detail"><span>Est. Gas</span><span class="claim-mono">~52,000</span></div>
      </div>

      <p class="claim-note">
        Claim a batch from job {job.id.slice(0, 10)}. Your GPU will begin executing once confirmed. claimBatch is free per the HOOT FeeDesign.
      </p>

      <button
        class="claim-confirm-btn"
        disabled={!walletConnected}
        on:click={confirm}
      >
        {walletConnected ? 'Confirm' : 'Connect Wallet First'}
      </button>

    {:else if step === 'pending'}
      <div class="claim-step-indicator">
        <span class="cm-step done">Review</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step active">Pending</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step">Confirmed</span>
      </div>

      <div class="claim-pending">
        <div class="claim-spinner"></div>
        <h3>Confirming on HOOT L1...</h3>
        <div class="claim-tx-hash">
          tx: 0x{Math.random().toString(16).slice(2, 10)}...{Math.random().toString(16).slice(2, 6)}
        </div>
      </div>

    {:else if step === 'confirmed'}
      <div class="claim-step-indicator">
        <span class="cm-step done">Review</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step done">Pending</span>
        <span class="cm-arrow">&rarr;</span>
        <span class="cm-step active cm-confirmed">Confirmed</span>
      </div>

      <div class="claim-confirmed">
        <div class="claim-check-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--green, #27864a)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3>Job Claimed!</h3>
        <p class="claim-confirmed-text">Your GPU will begin executing.</p>
        <div class="claim-confirmed-topic">{job.id.slice(0, 12)}</div>
        <button class="claim-done-btn" on:click={close}>Done</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .claim-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
    animation: fadeIn 200ms ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .claim-modal {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 28px;
    max-width: 480px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    animation: scaleIn 300ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.12));
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .claim-modal-close {
    position: absolute;
    top: 16px; right: 16px;
    width: 28px; height: 28px;
    border: none;
    background: var(--page-bg, #FAF9F7);
    border-radius: 50%;
    font-size: 1.1rem;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
  }
  .claim-modal-close:hover {
    background: var(--accent-subtle, rgba(217, 119, 87, 0.12));
    color: var(--accent, #D97757);
  }

  .claim-step-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
  }
  .cm-step {
    padding: 4px 10px;
    border-radius: var(--radius-pill, 100px);
    transition: all 200ms;
  }
  .cm-step.active {
    background: rgba(217, 119, 87, 0.1);
    color: var(--accent, #D97757);
  }
  .cm-step.done {
    color: var(--green, #27864a);
  }
  .cm-step.cm-confirmed {
    background: rgba(39, 134, 74, 0.1);
    color: var(--green, #27864a);
  }
  .cm-arrow {
    color: var(--border, #E5E0DA);
  }

  .claim-modal-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--text-primary, #2D2D2D);
  }

  .claim-wallet-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(192, 57, 43, 0.06);
    border-radius: var(--radius-sm, 6px);
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: var(--text-secondary, #6b6560);
  }
  .claim-wallet-connect {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--accent, #D97757);
    background: transparent;
    color: var(--accent, #D97757);
    cursor: pointer;
    transition: all 150ms;
  }
  .claim-wallet-connect:hover {
    background: var(--accent, #D97757);
    color: #fff;
  }

  .claim-wallet-connected {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(39, 134, 74, 0.06);
    border-radius: var(--radius-sm, 6px);
    margin-bottom: 16px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    color: var(--green, #27864a);
    font-weight: 600;
  }
  .cw-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--green, #27864a);
    flex-shrink: 0;
  }

  .claim-contract-row {
    margin-bottom: 12px;
  }
  .claim-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }
  .claim-mono {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    font-variant-numeric: tabular-nums;
  }

  .claim-fn-row {
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    padding: 12px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    margin-bottom: 12px;
  }
  .claim-fn {
    color: var(--accent, #D97757);
    font-weight: 700;
  }
  .claim-param {
    display: flex;
    gap: 8px;
    padding: 4px 0 4px 16px;
    align-items: baseline;
  }
  .cp-name {
    color: var(--text-primary, #2D2D2D);
    font-weight: 600;
  }
  .cp-type {
    color: var(--text-muted, #9a9590);
    font-size: 0.65rem;
  }
  .cp-value {
    color: var(--text-secondary, #6b6560);
    margin-left: auto;
  }

  .claim-details {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;
  }
  .claim-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
  }
  .claim-detail span:first-child {
    color: var(--text-muted, #9a9590);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .claim-note {
    font-size: 0.78rem;
    color: var(--text-secondary, #6b6560);
    line-height: 1.5;
    margin: 12px 0 20px;
    padding: 10px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    border-left: 3px solid var(--accent, #D97757);
  }

  .claim-confirm-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    width: 100%;
    transition: all 150ms ease;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .claim-confirm-btn:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 2px 12px rgba(217, 119, 87, 0.3);
  }
  .claim-confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .claim-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }
  .claim-spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--border, #E5E0DA);
    border-top-color: var(--accent, #D97757);
    border-radius: 50%;
    animation: claim-spin 0.8s linear infinite;
  }
  @keyframes claim-spin {
    to { transform: rotate(360deg); }
  }
  .claim-pending h3 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem;
    margin: 0;
    color: var(--text-primary, #2D2D2D);
  }
  .claim-tx-hash {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.7rem;
    color: var(--text-muted, #9a9590);
    padding: 6px 12px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
  }

  .claim-confirmed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }
  .claim-check-icon {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: rgba(39, 134, 74, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 300ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  .claim-check-icon svg {
    width: 28px; height: 28px;
  }
  .claim-confirmed h3 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.2rem;
    margin: 0;
    color: var(--green, #27864a);
  }
  .claim-confirmed-text {
    font-size: 0.82rem;
    color: var(--text-secondary, #6b6560);
    margin: 0;
  }
  .claim-confirmed-topic {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    color: var(--text-primary, #2D2D2D);
    font-weight: 600;
    padding: 6px 14px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .claim-done-btn {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    color: var(--text-primary, #2D2D2D);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 24px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: all 150ms ease;
  }
  .claim-done-btn:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
  }

  @media (max-width: 600px) {
    .claim-overlay {
      padding: 16px;
    }
    .claim-modal {
      max-width: 100%;
      padding: 20px;
      border-radius: var(--radius-md, 10px);
    }
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ContractCall } from '../data/protocolData.ts';
  import { toastStore } from '../stores/toastStore.ts';

  export let modalCall: ContractCall | null;
  export let modalOpen: boolean;
  export let modalStep: 'review' | 'pending' | 'confirmed' | 'error';
  export let walletConnected: boolean;
  export let walletAddress: string;

  let errorMessage = '';

  /** Payment method selection — HOOT (default) or USDC (+25%) */
  let paymentMethod: 'hoot' | 'usdc' = 'hoot';

  /** Active fee display — recalculated when payment method changes */
  $: activeFee = (() => {
    if (!modalCall?.paymentEnabled) return modalCall?.fee ?? '';
    return paymentMethod === 'hoot'
      ? `${modalCall.hootAmount ?? modalCall.fee} HOOT`
      : `${modalCall.usdcAmount ?? modalCall.fee} USDC`;
  })();

  /** Surcharge note for USDC */
  $: surchargeNote = paymentMethod === 'usdc' ? '+25% → Treasury' : '';

  /** Reset payment method when modal opens with new call */
  $: if (modalCall) { paymentMethod = 'hoot'; }

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: { paymentMethod: 'hoot' | 'usdc' };
    connectWallet: void;
  }>();

  /** Called externally or can be triggered to simulate error */
  export function triggerError(msg: string) {
    errorMessage = msg;
    modalStep = 'error';
    toastStore.error('트랜잭션이 실패했습니다');
  }

  function retryTransaction() {
    errorMessage = '';
    modalStep = 'review';
  }

  function handleConfirm() {
    dispatch('confirm', { paymentMethod });
  }
</script>

{#if modalOpen && modalCall}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-interactive-supports-focus -->
  <div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
    <div class="modal-card" class:confirmed={modalStep === 'confirmed'} class:error={modalStep === 'error'}>
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

        <!-- ═══ Payment Method Selector (x402) ═══ -->
        {#if modalCall.paymentEnabled}
          <div class="payment-selector">
            <span class="modal-label">결제 수단</span>
            <div class="payment-options">
              <button
                class="payment-opt"
                class:selected={paymentMethod === 'hoot'}
                on:click={() => { paymentMethod = 'hoot'; }}
              >
                <span class="po-radio">{paymentMethod === 'hoot' ? '●' : '○'}</span>
                <div class="po-body">
                  <span class="po-name">HOOT</span>
                  <span class="po-amount">{modalCall.hootAmount ?? modalCall.fee}</span>
                </div>
                <span class="po-badge po-default">기본</span>
              </button>
              <button
                class="payment-opt"
                class:selected={paymentMethod === 'usdc'}
                on:click={() => { paymentMethod = 'usdc'; }}
              >
                <span class="po-radio">{paymentMethod === 'usdc' ? '●' : '○'}</span>
                <div class="po-body">
                  <span class="po-name">USDC</span>
                  <span class="po-amount">{modalCall.usdcAmount ?? modalCall.fee}</span>
                </div>
                <span class="po-badge po-surcharge">+25%</span>
              </button>
            </div>
            {#if surchargeNote}
              <p class="payment-note">USDC 결제 시 25% 수수료가 Treasury로 이동합니다</p>
            {/if}
          </div>
        {/if}

        <div class="modal-details">
          <div class="modal-detail">
            <span>Fee</span>
            <span class="mono">{activeFee}</span>
          </div>
          <div class="modal-detail"><span>Est. Gas</span><span class="mono">{modalCall.gas}</span></div>
        </div>

        <p class="modal-note">{modalCall.note}</p>

        <button
          class="action-btn primary modal-confirm"
          disabled={!walletConnected}
          on:click={handleConfirm}
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
            {#if modalCall.paymentEnabled}
              <span class="modal-mono">Paid: {activeFee}</span>
            {/if}
          </div>
          <button class="action-btn secondary" on:click={() => dispatch('close')}>Done</button>
        </div>

      {:else if modalStep === 'error'}
        <!-- STEP: ERROR -->
        <div class="modal-step-indicator">
          <span class="step done">Review</span>
          <span class="step-arrow">→</span>
          <span class="step done">Pending</span>
          <span class="step-arrow">→</span>
          <span class="step active error-step">Failed</span>
        </div>

        <div class="modal-error">
          <div class="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f38ba8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <h3>트랜잭션 실패</h3>
          {#if errorMessage}
            <p class="error-message">{errorMessage}</p>
          {:else}
            <p class="error-message">트랜잭션이 거부되었거나 네트워크 오류가 발생했습니다.</p>
          {/if}
          <div class="error-actions">
            <button class="action-btn primary" on:click={retryTransaction}>다시 시도</button>
            <button class="action-btn secondary" on:click={() => dispatch('close')}>닫기</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ═══ OVERLAY — glass-morphic ═══ */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 300);
    padding: 24px;
    animation: overlayIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ═══ CARD — glass-morphic with accent glow ═══ */
  .modal-card {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(217,119,87,0.15);
    border-radius: 20px;
    padding: 28px;
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    animation: cardIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow:
      0 4px 24px rgba(0,0,0,0.08),
      0 0 0 1px rgba(217,119,87,0.06),
      0 8px 40px rgba(217,119,87,0.06);
  }
  @keyframes cardIn {
    from { opacity: 0; transform: scale(0.92) translateY(12px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* Confirmed glow */
  .modal-card.confirmed {
    border-color: rgba(39,134,74,0.2);
    box-shadow:
      0 4px 24px rgba(0,0,0,0.06),
      0 0 0 1px rgba(39,134,74,0.1),
      0 0 40px rgba(39,134,74,0.08);
    animation: cardIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1), celebrationGlow 2s ease-in-out;
  }
  @keyframes celebrationGlow {
    0% { box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(39,134,74,0.1), 0 0 40px rgba(39,134,74,0.08); }
    30% { box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 0 0 2px rgba(39,134,74,0.25), 0 0 60px rgba(39,134,74,0.15); }
    100% { box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(39,134,74,0.1), 0 0 40px rgba(39,134,74,0.08); }
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(0,0,0,0.04);
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
    background: rgba(217,119,87,0.1);
    color: var(--accent, #D97757);
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

  .step { padding: 4px 10px; border-radius: 100px; transition: all 200ms; }
  .step.active { background: rgba(217,119,87,0.1); color: var(--accent, #D97757); }
  .step.done { color: var(--green, #27864a); }
  .step.confirmed-step { background: rgba(39,134,74,0.1); color: var(--green, #27864a); }
  .step-arrow { color: var(--border, #E5E0DA); }

  .modal-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--text-primary, #2D2D2D);
  }

  .modal-wallet-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(192,57,43,0.06);
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .wallet-connect-inline {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--accent, #D97757);
    background: transparent;
    color: var(--accent, #D97757);
    cursor: pointer;
    transition: all 150ms;
  }
  .wallet-connect-inline:hover {
    background: var(--accent, #D97757);
    color: #fff;
  }

  .modal-wallet-connected {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(39,134,74,0.06);
    border-radius: 10px;
    margin-bottom: 16px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    color: var(--green, #27864a);
    font-weight: 600;
  }

  .wallet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green, #27864a);
    display: inline-block;
    animation: breathe 2s infinite;
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
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
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .modal-mono.clickable {
    cursor: pointer;
    transition: color 150ms;
  }
  .modal-mono.clickable:hover { color: var(--accent, #D97757); }

  .modal-fn-row {
    background: rgba(0,0,0,0.02);
    border-radius: 10px;
    padding: 12px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
  }

  .modal-fn { color: var(--accent, #D97757); font-weight: 700; }

  .modal-param {
    display: flex;
    gap: 8px;
    padding: 4px 0 4px 16px;
    align-items: baseline;
  }

  .param-name { color: var(--text-primary); font-weight: 600; }
  .param-type { color: var(--text-muted); font-size: 0.65rem; }
  .param-value { color: var(--text-secondary); margin-left: auto; }

  /* ═══ PAYMENT METHOD SELECTOR ═══ */
  .payment-selector {
    margin-bottom: 14px;
  }

  .payment-options {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .payment-opt {
    flex: 1;
    appearance: none;
    border: 1.5px solid var(--border, #E5E0DA);
    border-radius: 12px;
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(8px);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    text-align: left;
  }
  .payment-opt:hover {
    border-color: rgba(217,119,87,0.3);
    background: rgba(255,255,255,0.9);
  }
  .payment-opt.selected {
    border-color: var(--accent, #D97757);
    background: rgba(217,119,87,0.04);
    box-shadow: 0 0 0 1px rgba(217,119,87,0.15), 0 2px 12px rgba(217,119,87,0.08);
  }

  .po-radio {
    font-size: 0.9rem;
    color: var(--text-muted);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }
  .payment-opt.selected .po-radio { color: var(--accent, #D97757); }

  .po-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .po-name {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .po-amount {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
  }

  .po-badge {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.48rem;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 6px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }
  .po-default {
    background: rgba(39,134,74,0.08);
    color: var(--green, #27864a);
  }
  .po-surcharge {
    background: rgba(212,160,23,0.1);
    color: #b8860b;
  }

  .payment-note {
    font-size: 0.62rem;
    color: var(--text-muted);
    margin: 6px 0 0;
    padding-left: 2px;
    font-style: italic;
  }

  /* ═══ DETAILS ═══ */
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
    background: rgba(0,0,0,0.02);
    border-radius: 10px;
    border-left: 3px solid var(--accent, #D97757);
  }

  .modal-confirm { margin-top: 0; }

  .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

  /* ═══ PENDING — spring easing spinner ═══ */
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
    border: 3px solid rgba(217,119,87,0.15);
    border-top-color: var(--accent, #D97757);
    border-radius: 50%;
    animation: springPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  }

  @keyframes springPulse {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.05); }
    100% { transform: rotate(360deg) scale(1); }
  }

  .modal-pending h3 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem;
    margin: 0;
  }

  .pending-hash {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 6px 12px;
    background: rgba(0,0,0,0.02);
    border-radius: 8px;
  }

  /* ═══ CONFIRMED — celebration glow ═══ */
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
    animation: checkPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes checkPop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .confirm-check svg { width: 24px; height: 24px; }

  .modal-confirmed h3 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem;
    margin: 0;
    color: var(--green, #27864a);
  }

  .confirmed-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  /* ═══ ACTION BUTTONS ═══ */
  .action-btn {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.9rem;
    padding: 14px 24px;
    border-radius: 100px;
    width: 100%;
    border: none;
    cursor: pointer;
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
  }

  .action-btn.primary {
    background: var(--accent, #D97757);
    color: #fff;
  }
  .action-btn.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent, #D97757) 85%, black);
    box-shadow: 0 4px 20px rgba(217,119,87,0.3);
    transform: translateY(-1px);
  }

  .action-btn.secondary {
    background: rgba(0,0,0,0.03);
    color: var(--text-primary);
    border: 1px solid var(--border, #E5E0DA);
  }
  .action-btn.secondary:hover:not(:disabled) {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
  }

  .action-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

  /* ═══ ERROR ═══ */
  .modal-card.error {
    border-color: rgba(243, 139, 168, 0.3);
    box-shadow:
      0 4px 24px rgba(0,0,0,0.06),
      0 0 0 1px rgba(243, 139, 168, 0.15),
      0 0 30px rgba(243, 139, 168, 0.06);
  }

  .step.error-step { background: rgba(243, 139, 168, 0.1); color: #f38ba8; }

  .modal-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }

  .error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(243, 139, 168, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: checkPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .error-icon svg { width: 24px; height: 24px; }

  .modal-error h3 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem;
    margin: 0;
    color: #f38ba8;
  }

  .error-message {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
    padding: 8px 14px;
    background: rgba(0,0,0,0.02);
    border-radius: 10px;
    border-left: 3px solid #f38ba8;
    text-align: left;
    width: 100%;
  }

  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 500px) {
    .modal-card { padding: 22px 18px; border-radius: 16px; }
    .payment-options { flex-direction: column; }
  }
</style>

<script lang="ts">
  /**
   * PlaygroundTab — Model inference playground with x402 payment.
   *
   * Spec: PlatformUX §7-A Playground x402
   *
   * Events:
   *   openModal: ContractCall — parent handles ContractCallModal
   */
  import { createEventDispatcher, onDestroy } from "svelte";
  import { DEMO_MODEL } from "../data/modelDetailData.ts";
  import { wallet } from "../stores/walletStore.ts";
  import type { ContractCall } from '../../../packages/contracts/src/index.ts';

  const dispatch = createEventDispatcher<{
    openModal: ContractCall;
  }>();

  export let modelId: string = DEMO_MODEL.id;

  const COST_PER_CALL = 0.001;

  let pgInput = '{\n  "symbol": "ETH",\n  "timeframe": "24h"\n}';
  let pgResult = "";
  let pgLoading = false;
  let pgCallCost = 0;
  let destroyed = false;
  let playgroundTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Called by parent after ContractCallModal confirmed */
  export function executeInference() {
    pgLoading = true;
    pgResult = "";
    pgCallCost = 0;
    if (playgroundTimeout) clearTimeout(playgroundTimeout);
    playgroundTimeout = setTimeout(() => {
      if (destroyed) return;
      pgLoading = false;
      pgCallCost = COST_PER_CALL;
      pgResult = JSON.stringify({
        prediction: 0.73,
        confidence: 0.89,
        direction: "up",
        model: modelId,
        latency_ms: 42,
      }, null, 2);
    }, 1200);
  }

  function runPlayground() {
    dispatch('openModal', {
      title: '모델 추론 실행',
      contract: '0x7B2e...A1f8  HootInference.sol',
      fn: 'executeInference',
      params: [
        { name: 'modelId', type: 'string', value: modelId },
        { name: 'input', type: 'bytes', value: pgInput.slice(0, 60) + '...' },
      ],
      fee: `${COST_PER_CALL} HOOT`,
      gas: '~45,000',
      note: 'x402 결제 — 호출당 0.001 HOOT이 차감됩니다.',
      accentColor: 'var(--accent)',
      paymentEnabled: true,
      hootAmount: String(COST_PER_CALL),
      usdcAmount: String(Math.round(COST_PER_CALL * 1.25 * 10000) / 10000),
    });
  }

  onDestroy(() => {
    destroyed = true;
    if (playgroundTimeout) clearTimeout(playgroundTimeout);
  });
</script>

<div class="pg-layout">
  <div class="pg-col">
    <h3 class="pg-label">Input</h3>
    <textarea class="pg-editor" bind:value={pgInput} rows="8"></textarea>
    {#if !$wallet.connected}
      <div class="pg-wallet-warn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>
        지갑을 연결해야 추론을 실행할 수 있습니다
      </div>
    {/if}
    <div class="pg-cost">예상 비용: {COST_PER_CALL} HOOT per call</div>
    <button class="pg-run" on:click={runPlayground} disabled={pgLoading || !$wallet.connected}>
      {#if pgLoading}
        <span class="spin-sm"></span> Running...
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
        </svg>
        Run Inference
      {/if}
    </button>
  </div>
  <div class="pg-col">
    <h3 class="pg-label">Output</h3>
    <pre class="pg-result" class:empty={!pgResult}>{pgResult || 'Results will appear here...'}</pre>
    {#if pgCallCost > 0}
      <div class="pg-billing">잔액: {$wallet.balance ?? '—'} HOOT · 이번 호출: -{pgCallCost} HOOT</div>
    {/if}
  </div>
</div>

<style>
  .pg-layout {
    display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4, 16px);
  }
  .pg-label {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 var(--space-2, 8px);
  }
  .pg-editor {
    width: 100%; padding: 12px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.82rem;
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    resize: vertical; outline: none;
  }
  .pg-editor:focus { border-color: var(--accent, #D97757); }
  .pg-run {
    appearance: none; border: none;
    background: var(--accent, #D97757); color: #fff;
    font-weight: 600; font-size: 0.82rem;
    padding: 10px 20px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer; margin-top: var(--space-3, 12px);
    display: flex; align-items: center; gap: 6px;
    transition: background 150ms;
    position: relative; overflow: hidden;
  }
  .pg-run::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 48%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 52%, transparent 60%);
    transform: translateX(-200%);
  }
  .pg-run:hover:not(:disabled)::after {
    animation: btn-shimmer 700ms ease-out;
  }
  @keyframes btn-shimmer {
    from { transform: translateX(-200%); }
    to { transform: translateX(200%); }
  }
  .pg-run:hover:not(:disabled) { background: var(--accent-hover, #C4644A); box-shadow: 0 0 16px rgba(217, 119, 87, 0.25); }
  .pg-run:disabled { opacity: 0.5; cursor: not-allowed; }
  .spin-sm {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pg-result {
    padding: 12px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
    background: #fafaf9;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.78rem;
    color: var(--text-primary, #2D2D2D);
    min-height: 180px;
    margin: 0; white-space: pre-wrap; overflow: auto;
  }
  .pg-result.empty { color: var(--text-muted, #9a9590); }
  .pg-wallet-warn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; margin-top: 8px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(249, 226, 175, 0.15);
    border: 1px solid rgba(249, 226, 175, 0.3);
    font-size: 0.72rem; color: #f9e2af; font-weight: 500;
  }
  .pg-cost {
    font-size: 0.68rem; color: var(--text-muted, #9a9590);
    margin-top: 6px; font-family: var(--font-mono, monospace);
  }
  .pg-billing {
    font-size: 0.68rem; color: var(--text-muted, #9a9590);
    margin-top: 6px; font-family: var(--font-mono, monospace);
    padding: 6px 10px; border-radius: var(--radius-sm, 6px);
    background: rgba(166, 227, 161, 0.08);
    border: 1px solid rgba(166, 227, 161, 0.15);
  }

  @media (max-width: 600px) {
    .pg-layout { grid-template-columns: 1fr; }
  }
</style>

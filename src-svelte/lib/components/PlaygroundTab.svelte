<script lang="ts">
  import { onDestroy } from "svelte";
  import { DEMO_MODEL } from "../data/modelDetailData.ts";

  let pgInput = '{\n  "symbol": "ETH",\n  "timeframe": "24h"\n}';
  let pgResult = "";
  let pgLoading = false;
  let destroyed = false;
  let playgroundTimeout: ReturnType<typeof setTimeout> | null = null;

  function runPlayground() {
    pgLoading = true;
    pgResult = "";
    if (playgroundTimeout) clearTimeout(playgroundTimeout);
    playgroundTimeout = setTimeout(() => {
      if (destroyed) return;
      pgLoading = false;
      pgResult = JSON.stringify({
        prediction: 0.73,
        confidence: 0.89,
        direction: "up",
        model: DEMO_MODEL.id,
        latency_ms: 42,
      }, null, 2);
    }, 1200);
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
    <button class="pg-run" on:click={runPlayground} disabled={pgLoading}>
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

  @media (max-width: 600px) {
    .pg-layout { grid-template-columns: 1fr; }
  }
</style>

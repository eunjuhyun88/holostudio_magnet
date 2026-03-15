<script lang="ts">
  import { wallet } from '../../stores/walletStore.ts';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

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

  interface JobMeta {
    minTier: number;
    tierLabel: string;
    deadlineH: number;
    poolBGpu: number;
    poolBTreasury: number;
    jobType: 'training' | 'inference';
    topic: string;
  }

  export let job: EnrichedJob;
  export let meta: JobMeta;
  export let index: number = 0;

  $: walletConnected = $wallet.connected;

  const dispatch = createEventDispatcher<{ claim: EnrichedJob }>();

  // UX-J2: Expand/collapse state
  let expanded = false;

  let showWalletHint = false;

  function handleClaim() {
    if (!walletConnected) {
      showWalletHint = true;
      return;
    }
    dispatch('claim', job);
  }
</script>

<div class="rj-card" style:--delay="{index * 80}ms">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="rj-header rj-header-toggle" role="button" tabindex="0" aria-expanded={expanded} on:click={() => expanded = !expanded} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expanded = !expanded; } }}>
    <span class="rj-id">{job.id.slice(0, 12)}</span>
    <span class="rj-type-tag" class:rj-type-train={meta.jobType === 'training'} class:rj-type-infer={meta.jobType === 'inference'}>{meta.jobType}</span>
    <span class="rj-state-pill rj-open">OPEN</span>
    <span class="rj-expand-icon" class:expanded>▸</span>
  </div>
  <div class="rj-topic-row">{meta.topic}</div>
  {#if expanded}
    <div class="rj-detail-body" transition:slide={{ duration: 220 }}>
      <div class="rj-meta-grid">
        <div class="rj-meta-item">
          <span class="rj-meta-label">Min Tier</span>
          <span class="rj-meta-value mono">{meta.tierLabel}</span>
        </div>
        <div class="rj-meta-item">
          <span class="rj-meta-label">GPUs needed</span>
          <span class="rj-meta-value mono">{job.nodeCount}</span>
        </div>
        <div class="rj-meta-item">
          <span class="rj-meta-label">Budget</span>
          <span class="rj-meta-value mono">{job.estBudget} HOOT</span>
        </div>
        <div class="rj-meta-item">
          <span class="rj-meta-label">Deadline</span>
          <span class="rj-meta-value mono">{meta.deadlineH}h left</span>
        </div>
      </div>
      <div class="rj-pool-row">
        <span class="rj-pool-label">Est. reward:</span>
        <span class="rj-pool-value">~{job.rewardEst} HOOT</span>
        <span class="rj-pool-split">(GPU {meta.poolBGpu} / Treasury {meta.poolBTreasury})</span>
      </div>
      <div class="rj-footer">
        <div class="rj-tags">
          <span class="rj-dataset">{job.workerCount} workers · {job.nodeCount} nodes</span>
        </div>
        <button class="rj-claim-btn" on:click|stopPropagation={handleClaim}>
          Claim
        </button>
      </div>
      {#if showWalletHint && !walletConnected}
        <div class="rj-wallet-hint">Connect wallet first (see NavBar)</div>
      {/if}
    </div>
  {:else}
    <div class="rj-collapsed-summary">
      <span class="mono">{job.estBudget} HOOT</span>
      <span class="rj-meta-sep">&middot;</span>
      <span class="mono">{job.nodeCount} nodes</span>
      <span class="rj-meta-sep">&middot;</span>
      <span class="mono">{meta.deadlineH}h</span>
    </div>
  {/if}
</div>

<style>
  .rj-card {
    padding: 12px 14px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border, #E5E0DA);
    margin-bottom: 8px;
    transition: all 180ms ease;
    animation: rj-fade 320ms ease both;
    animation-delay: var(--delay, 0ms);
  }
  .rj-card:hover {
    border-color: color-mix(in srgb, var(--accent, #D97757) 40%, var(--border, #E5E0DA));
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.06);
  }
  @keyframes rj-fade {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .rj-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .rj-id {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.64rem;
    color: var(--text-muted, #9a9590);
    letter-spacing: 0.02em;
  }

  .rj-state-pill {
    font-size: 0.56rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: var(--radius-pill, 100px);
    line-height: 1.4;
  }
  .rj-open {
    background: rgba(39, 134, 74, 0.1);
    color: var(--green, #27864a);
  }

  .mono {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }

  .rj-type-tag {
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: var(--radius-pill, 100px);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .rj-type-train { background: rgba(217, 119, 87, 0.1); color: var(--accent, #D97757); }
  .rj-type-infer { background: rgba(80, 170, 255, 0.1); color: #3498db; }

  .rj-topic-row {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rj-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    margin-bottom: 8px;
  }
  .rj-meta-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .rj-meta-label {
    font-size: 0.54rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .rj-meta-value {
    font-size: 0.7rem;
    color: var(--text-secondary, #6b6560);
  }

  .rj-pool-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    margin-bottom: 8px;
    padding: 4px 8px;
    background: rgba(39, 134, 74, 0.04);
    border-radius: var(--radius-sm, 6px);
  }
  .rj-pool-label { color: var(--text-muted, #9a9590); }
  .rj-pool-value { color: var(--green, #27864a); font-weight: 700; }
  .rj-pool-split { color: var(--text-muted, #9a9590); font-size: 0.52rem; }

  .rj-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .rj-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .rj-dataset {
    font-size: 0.6rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
  }

  .rj-claim-btn {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 5px 14px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: 0.03em;
  }
  .rj-claim-btn:hover {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.3);
  }
  .rj-claim-btn:active {
    transform: scale(0.97);
  }

  .rj-wallet-hint {
    font-size: 0.66rem;
    color: var(--red, #c0392b);
    margin-top: 6px;
    padding: 4px 8px;
    background: rgba(192, 57, 43, 0.06);
    border-radius: var(--radius-sm, 6px);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* UX-J2: Expand/collapse toggle */
  .rj-header-toggle {
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
  }
  .rj-header-toggle:focus-visible {
    outline: 2px solid var(--accent, #D97757);
    outline-offset: 2px;
    border-radius: var(--radius-sm, 6px);
  }
  .rj-expand-icon {
    font-size: 0.6rem;
    color: var(--text-muted, #9a9590);
    transition: transform 220ms ease;
    margin-left: 4px;
    flex-shrink: 0;
  }
  .rj-expand-icon.expanded {
    transform: rotate(90deg);
  }
  .rj-detail-body {
    overflow: hidden;
  }
  .rj-collapsed-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.64rem;
    color: var(--text-muted, #9a9590);
    padding: 2px 0;
  }
  .rj-meta-sep {
    color: var(--text-muted, #9a9590);
    font-size: 0.6rem;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .rj-card { animation: none; transition: none; }
    .rj-expand-icon { transition: none; }
    .rj-claim-btn { transition: none; }
  }
</style>

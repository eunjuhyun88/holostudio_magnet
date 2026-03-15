<script lang="ts">
  import { onDestroy } from 'svelte';
  import { wallet } from '../stores/walletStore.ts';

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

  // Protocol-aligned enrichment
  type JobType = 'training' | 'inference';
  let jobTypeFilter: JobType | 'all' = 'all';

  // UX-J1: Cache deriveJobMeta by job.id (hash is deterministic, only rewardEst changes)
  const metaCache = new Map<string, ReturnType<typeof computeJobMeta>>();

  function computeJobMeta(job: EnrichedJob) {
    const h = Math.abs(hashStr(job.id));
    const minTier = h % 3 === 0 ? 1 : h % 3 === 1 ? 2 : 3;
    const tierLabels = ['', 'Lite (500H)', 'Standard (2,000H)', 'Enterprise (10,000H)'];
    const deadlineH = 6 + (h % 42);
    const poolBGpu = +(job.rewardEst * 0.95).toFixed(2);
    const poolBTreasury = +(job.rewardEst * 0.05).toFixed(2);
    const jType: JobType = h % 4 === 0 ? 'inference' : 'training';
    const topics = ['Crypto prediction', 'DeFi risk analysis', 'NLP sentiment', 'Fraud detection', 'Protein folding', 'Supply chain opt.'];
    const topic = topics[h % topics.length];
    return { minTier, tierLabel: tierLabels[minTier], deadlineH, poolBGpu, poolBTreasury, jobType: jType, topic };
  }

  function deriveJobMeta(job: EnrichedJob) {
    const cached = metaCache.get(job.id);
    if (cached && cached.poolBGpu === +(job.rewardEst * 0.95).toFixed(2)) return cached;
    const meta = computeJobMeta(job);
    metaCache.set(job.id, meta);
    return meta;
  }

  function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  $: filteredQueued = jobTypeFilter === 'all' ? queuedJobs : queuedJobs.filter(j => deriveJobMeta(j).jobType === jobTypeFilter);
  $: filteredRunning = jobTypeFilter === 'all' ? runningJobs : runningJobs.filter(j => deriveJobMeta(j).jobType === jobTypeFilter);

  // UX-J3: Compute type counts for filter badges (single pass)
  $: typeCounts = (() => {
    let training = 0, inference = 0;
    const allJobs = [...queuedJobs, ...runningJobs, ...doneJobs];
    for (const j of allJobs) {
      if (deriveJobMeta(j).jobType === 'training') training++;
      else inference++;
    }
    return { training, inference };
  })();
  $: trainingCount = typeCounts.training;
  $: inferenceCount = typeCounts.inference;

  export let queuedJobs: EnrichedJob[] = [];
  export let runningJobs: EnrichedJob[] = [];
  export let doneJobs: EnrichedJob[] = [];
  export let totalJobCount = 0;
  export let autoresearchActive = false;
  export let autoresearchTopic = "";
  export let myNodeId: string | null = null;

  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // ── Claim modal state ──
  let claimModalOpen = false;
  let claimModalStep: 'review' | 'pending' | 'confirmed' = 'review';
  let claimingJob: EnrichedJob | null = null;
  let claimTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleClaimClick(job: EnrichedJob) {
    if (!walletConnected) {
      claimingJob = job;
      claimModalOpen = false;
      return;
    }
    claimingJob = job;
    claimModalStep = 'review';
    claimModalOpen = true;
  }

  function confirmClaim() {
    claimModalStep = 'pending';
    if (claimTimeout) clearTimeout(claimTimeout);
    claimTimeout = setTimeout(() => {
      claimModalStep = 'confirmed';
    }, 1500);
  }

  function closeClaimModal() {
    claimModalOpen = false;
    claimingJob = null;
    claimModalStep = 'review';
  }

  onDestroy(() => {
    if (claimTimeout) clearTimeout(claimTimeout);
  });
</script>

<!-- Autoresearch indicator -->
{#if autoresearchActive}
  <div class="psection rj-autoresearch-banner">
    <div class="rj-ar-dot"></div>
    <div class="rj-ar-info">
      <span class="rj-ar-label">Autoresearch Active</span>
      <span class="rj-ar-topic">{autoresearchTopic}</span>
    </div>
  </div>
{/if}

<!-- Job Type Filter (UX-J3: count badges) -->
<div class="psection rj-filter-bar" role="tablist" aria-label="Job type filter">
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'all'} on:click={() => jobTypeFilter = 'all'} role="tab" aria-selected={jobTypeFilter === 'all'}>All <span class="rj-filter-count">{totalJobCount}</span></button>
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'training'} on:click={() => jobTypeFilter = 'training'} role="tab" aria-selected={jobTypeFilter === 'training'}>Training <span class="rj-filter-count">{trainingCount}</span></button>
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'inference'} on:click={() => jobTypeFilter = 'inference'} role="tab" aria-selected={jobTypeFilter === 'inference'}>Inference <span class="rj-filter-count">{inferenceCount}</span></button>
</div>

<!-- Queued — available for claim -->
{#if filteredQueued.length > 0}
  <div class="psection">
    <h4 class="slabel">Open Jobs <span class="slabel-count">{filteredQueued.length}</span></h4>
    {#each filteredQueued as job, i}
      {@const meta = deriveJobMeta(job)}
      <div class="rj-card" style:--delay="{i * 80}ms">
        <div class="rj-header">
          <span class="rj-id">{job.id.slice(0, 12)}</span>
          <span class="rj-type-tag" class:rj-type-train={meta.jobType === 'training'} class:rj-type-infer={meta.jobType === 'inference'}>{meta.jobType}</span>
          <span class="rj-state-pill rj-open">OPEN</span>
        </div>
        <div class="rj-topic-row">{meta.topic}</div>
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
          <button class="rj-claim-btn" on:click={() => handleClaimClick(job)}>
            Claim
          </button>
        </div>
        {#if !walletConnected && claimingJob?.id === job.id && !claimModalOpen}
          <div class="rj-wallet-hint">Connect wallet first (see NavBar)</div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- Running — training / evaluating -->
<div class="psection">
  <h4 class="slabel">Executing <span class="slabel-count">{filteredRunning.length}</span></h4>
  {#if filteredRunning.length > 0}
    {#each filteredRunning as job}
      {@const meta = deriveJobMeta(job)}
      <div class="rj-compact-card">
        <div class="rj-compact-header">
          <span class="rj-state-pill" class:rj-executing={job.state === 'training'} class:rj-submitted={job.state === 'evaluating'}>
            {job.state.toUpperCase()}
          </span>
          <span class="rj-compact-topic">{meta.topic}</span>
          <span class="rj-type-tag rj-type-sm" class:rj-type-train={meta.jobType === 'training'} class:rj-type-infer={meta.jobType === 'inference'}>{meta.jobType}</span>
        </div>
        <div class="rj-compact-meta">
          <span class="mono">{job.nodeCount} nodes</span>
          <span class="rj-meta-sep">&middot;</span>
          <span class="mono">{meta.deadlineH}h left</span>
          <span class="rj-meta-sep">&middot;</span>
          <span class="mono rj-payout">~{job.rewardEst} HOOT</span>
        </div>
        {#if job.progress > 0}
          <div class="rj-progress-bar" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Job progress {job.progress}%">
            <div class="rj-progress-fill" style:width="{job.progress}%"></div>
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="empty">No executing jobs</div>
  {/if}
</div>

<!-- Done -->
{#if doneJobs.length > 0}
  <div class="psection">
    <h4 class="slabel">Completed <span class="slabel-count">{doneJobs.length}</span></h4>
    {#each doneJobs as job}
      <div class="rj-compact-card rj-verified-card">
        <div class="rj-compact-header">
          <span class="rj-verified-check">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="var(--green, #27864a)" stroke-width="1.5"/>
              <polyline points="5 8 7.2 10.2 11 6" stroke="var(--green, #27864a)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="rj-compact-topic">{job.id.slice(0, 10)}</span>
          <span class="rj-state-pill rj-verified">DONE</span>
        </div>
        <div class="rj-compact-meta">
          <span class="mono rj-payout">{job.estBudget} HOOT settled</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- Empty state when no jobs at all -->
{#if totalJobCount === 0 && !autoresearchActive}
  <div class="rj-empty-state">
    <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
      <circle cx="12" cy="12" r="10" stroke="var(--border, #E5E0DA)" stroke-width="1.5"/>
      <path d="M8 12h8M12 8v8" stroke="var(--text-muted, #9a9590)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <p>No active jobs on the mesh</p>
    <p class="rj-empty-sub">Jobs appear when someone starts autoresearch or requests inference.</p>
  </div>
{/if}

<!-- Claim Job Modal -->
{#if claimModalOpen && claimingJob}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-interactive-supports-focus -->
  <div class="claim-overlay" on:click|self={closeClaimModal} role="dialog" aria-label="Claim Research Job">
    <div class="claim-modal" class:confirmed={claimModalStep === 'confirmed'}>
      <button class="claim-modal-close" on:click={closeClaimModal}>&times;</button>

      {#if claimModalStep === 'review'}
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
            <span class="cp-value">{claimingJob.id}</span>
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
          Claim a batch from job {claimingJob.id.slice(0, 10)}. Your GPU will begin executing once confirmed. claimBatch is free per the HOOT FeeDesign.
        </p>

        <button
          class="claim-confirm-btn"
          disabled={!walletConnected}
          on:click={confirmClaim}
        >
          {walletConnected ? 'Confirm' : 'Connect Wallet First'}
        </button>

      {:else if claimModalStep === 'pending'}
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

      {:else if claimModalStep === 'confirmed'}
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
          <div class="claim-confirmed-topic">{claimingJob.id.slice(0, 12)}</div>
          <button class="claim-done-btn" on:click={closeClaimModal}>Done</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .psection { padding: 14px 16px; border-bottom: 1px solid var(--border-subtle, #EDEAE5); }
  .psection:last-child { border-bottom: none; }
  .slabel {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    margin: 0 0 10px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .slabel-count {
    color: var(--text-muted, #9a9590);
    font-weight: 500;
  }
  .mono {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }
  .empty { padding: 20px; text-align: center; color: var(--text-muted, #9a9590); font-size: 0.78rem; }

  /* ═══════ JOBS ═══════ */

  /* Research Job Card (full — for OPEN jobs) */
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

  /* State pills */
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
  .rj-executing {
    background: rgba(217, 119, 87, 0.1);
    color: var(--accent, #D97757);
  }
  .rj-submitted {
    background: rgba(183, 134, 14, 0.1);
    color: var(--gold, #b7860e);
  }
  .rj-verified {
    background: rgba(39, 134, 74, 0.1);
    color: var(--green, #27864a);
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

  /* Claim button */
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

  /* Compact card (for in-progress + completed) */
  .rj-compact-card {
    padding: 8px 12px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border, #E5E0DA);
    margin-bottom: 6px;
    transition: all 150ms ease;
  }
  .rj-compact-card:hover {
    border-color: var(--text-muted, #9a9590);
  }
  .rj-verified-card {
    border-color: rgba(39, 134, 74, 0.2);
    background: rgba(39, 134, 74, 0.02);
  }
  .rj-compact-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .rj-compact-topic {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rj-compact-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.66rem;
    color: var(--text-muted, #9a9590);
  }
  .rj-verified-check {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .rj-payout {
    color: var(--green, #27864a);
    font-weight: 600;
  }

  /* Autoresearch banner */
  .rj-autoresearch-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(217, 119, 87, 0.04);
    border-bottom: 1px solid rgba(217, 119, 87, 0.15);
  }
  .rj-ar-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent, #D97757);
    box-shadow: 0 0 10px rgba(217, 119, 87, 0.5);
    animation: pulse-live 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse-live {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .rj-ar-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .rj-ar-label {
    font-size: 0.56rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .rj-ar-topic {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rj-meta-sep {
    color: var(--text-muted, #9a9590);
    font-size: 0.6rem;
  }

  /* Filter bar */
  .rj-filter-bar {
    display: flex;
    gap: 4px;
    padding: 8px 12px !important;
  }
  .rj-filter-btn {
    appearance: none;
    border: 1px solid var(--border-subtle, #EDEAE5);
    background: none;
    padding: 4px 10px;
    font-size: 0.64rem;
    font-weight: 600;
    border-radius: var(--radius-pill, 100px);
    cursor: pointer;
    color: var(--text-muted, #9a9590);
    transition: all 150ms;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .rj-filter-btn:hover { border-color: var(--text-muted); }
  .rj-filter-btn.active {
    background: var(--accent, #D97757);
    border-color: var(--accent, #D97757);
    color: #fff;
  }
  /* UX-J3: Filter count badges */
  .rj-filter-count {
    font-size: 0.56rem;
    font-weight: 700;
    padding: 0 4px;
    border-radius: var(--radius-pill, 100px);
    background: rgba(0, 0, 0, 0.06);
    font-variant-numeric: tabular-nums;
  }
  .rj-filter-btn.active .rj-filter-count {
    background: rgba(255, 255, 255, 0.25);
  }

  /* Job type tags */
  .rj-type-tag {
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: var(--radius-pill, 100px);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .rj-type-tag.rj-type-sm { font-size: 0.48rem; padding: 1px 5px; }
  .rj-type-train { background: rgba(217, 119, 87, 0.1); color: var(--accent, #D97757); }
  .rj-type-infer { background: rgba(80, 170, 255, 0.1); color: #3498db; }

  /* Topic row */
  .rj-topic-row {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Pool B distribution */
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

  /* Progress bar for running jobs */
  .rj-progress-bar {
    height: 2px;
    background: var(--border-subtle, #EDEAE5);
    border-radius: 1px;
    overflow: hidden;
    margin-top: 4px;
  }
  .rj-progress-fill {
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 1px;
    transition: width 300ms ease;
  }

  /* Empty state */
  .rj-empty-state {
    padding: 40px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .rj-empty-state p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-muted, #9a9590);
  }
  .rj-empty-sub {
    font-size: 0.66rem !important;
    color: var(--text-muted, #9a9590);
    max-width: 220px;
    line-height: 1.4;
  }

  /* ═══════ CLAIM MODAL ═══════ */

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

  /* Step indicator */
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

  /* Wallet status in modal */
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

  /* Contract info */
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

  /* Pending state */
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

  /* Confirmed state */
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

  /* Modal responsive */
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

<script lang="ts">
  import JobCard from './jobs/JobCard.svelte';
  import ClaimModal from './jobs/ClaimModal.svelte';

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

  type JobType = 'training' | 'inference';

  export let queuedJobs: EnrichedJob[] = [];
  export let runningJobs: EnrichedJob[] = [];
  export let doneJobs: EnrichedJob[] = [];
  export let totalJobCount = 0;
  export let autoresearchActive = false;
  export let autoresearchTopic = "";
  export let myNodeId: string | null = null;

  let jobTypeFilter: JobType | 'all' = 'all';
  let claimModalOpen = false;
  let claimingJob: EnrichedJob | null = null;

  // ── Meta computation (cached) ──
  const metaCache = new Map<string, ReturnType<typeof computeJobMeta>>();

  function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

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

  // ── Derived state ──
  $: filteredQueued = jobTypeFilter === 'all' ? queuedJobs : queuedJobs.filter(j => deriveJobMeta(j).jobType === jobTypeFilter);
  $: filteredRunning = jobTypeFilter === 'all' ? runningJobs : runningJobs.filter(j => deriveJobMeta(j).jobType === jobTypeFilter);

  $: typeCounts = (() => {
    let training = 0, inference = 0;
    for (const j of [...queuedJobs, ...runningJobs, ...doneJobs]) {
      if (deriveJobMeta(j).jobType === 'training') training++;
      else inference++;
    }
    return { training, inference };
  })();

  function handleClaim(e: CustomEvent<EnrichedJob>) {
    claimingJob = e.detail;
    claimModalOpen = true;
  }

  function closeModal() {
    claimModalOpen = false;
    claimingJob = null;
  }
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

<!-- Job Type Filter -->
<div class="psection rj-filter-bar" role="tablist" aria-label="Job type filter">
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'all'} on:click={() => jobTypeFilter = 'all'} role="tab" aria-selected={jobTypeFilter === 'all'}>All <span class="rj-filter-count">{totalJobCount}</span></button>
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'training'} on:click={() => jobTypeFilter = 'training'} role="tab" aria-selected={jobTypeFilter === 'training'}>Training <span class="rj-filter-count">{typeCounts.training}</span></button>
  <button class="rj-filter-btn" class:active={jobTypeFilter === 'inference'} on:click={() => jobTypeFilter = 'inference'} role="tab" aria-selected={jobTypeFilter === 'inference'}>Inference <span class="rj-filter-count">{typeCounts.inference}</span></button>
</div>

<!-- Queued — available for claim -->
{#if filteredQueued.length > 0}
  <div class="psection">
    <h4 class="slabel">Open Jobs <span class="slabel-count">{filteredQueued.length}</span></h4>
    {#each filteredQueued as job, i (job.id)}
      <JobCard {job} meta={deriveJobMeta(job)} index={i} on:claim={handleClaim} />
    {/each}
  </div>
{/if}

<!-- Running -->
<div class="psection">
  <h4 class="slabel">Executing <span class="slabel-count">{filteredRunning.length}</span></h4>
  {#if filteredRunning.length > 0}
    {#each filteredRunning as job (job.id)}
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
    {#each doneJobs as job (job.id)}
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

<!-- Empty state -->
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

<!-- Claim Modal -->
{#if claimModalOpen && claimingJob}
  <ClaimModal job={claimingJob} {myNodeId} on:close={closeModal} />
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

  /* Compact cards (running + done) */
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
  .rj-meta-sep {
    color: var(--text-muted, #9a9590);
    font-size: 0.6rem;
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

  /* Type tags */
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

  /* Progress bar */
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
</style>

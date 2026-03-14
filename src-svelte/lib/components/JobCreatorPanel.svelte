<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fmtK } from '../utils/format.ts';
  import type { ContractCall } from '../data/protocolData.ts';

  const dispatch = createEventDispatcher<{ openModal: ContractCall }>();

  let jobBudget = '';
  let jobExpId = 'exp-' + Math.floor(Math.random() * 9000 + 1000);
  let jobWorkers = '4';
  let jobMetric = 'bpb';

  $: jobBudgetNum = Number(jobBudget) || 0;
  $: jobGpuCost = (jobBudgetNum * 0.95).toFixed(1);
  $: jobTreasuryCost = (jobBudgetNum * 0.05).toFixed(1);

  const inputIds = {
    jobBudget: 'job-budget-input',
    jobExpId: 'job-exp-id-input',
    jobWorkers: 'job-workers-select',
    jobMetric: 'job-metric-select',
  };

  function openJobModal() {
    dispatch('openModal', {
      title: 'Create Research Job',
      contract: '0x5E8c...2B7f  ResearchJobManager.sol',
      fn: 'createJob',
      params: [
        { name: 'experimentId', type: 'bytes32', value: jobExpId },
        { name: 'budget', type: 'uint256', value: `${jobBudget} × 10¹⁸` },
        { name: 'maxWorkers', type: 'uint8', value: jobWorkers },
        { name: 'metric', type: 'string', value: jobMetric },
      ],
      fee: `${jobBudget} HOOT`,
      gas: '~245,000',
      note: `Escrows ${fmtK(jobBudgetNum)} HOOT. GPU payout: ${jobGpuCost} HOOT (95%). Treasury: ${jobTreasuryCost} HOOT (5%).`,
      accentColor: 'var(--green)',
    });
  }
</script>

<div class="panel" style="--panel-delay: 2">
  <div class="panel-header">
    <h2>Fund Research</h2>
    <span class="panel-badge job">Jobs</span>
  </div>

  <div class="job-form">
    <div class="form-row">
      <div class="form-field">
        <label class="input-label" for={inputIds.jobBudget}>Budget (HOOT)</label>
        <input id={inputIds.jobBudget} type="text" bind:value={jobBudget} class="mono-input" placeholder="150" />
      </div>
      <div class="form-field">
        <label class="input-label" for={inputIds.jobExpId}>Experiment ID</label>
        <input id={inputIds.jobExpId} type="text" bind:value={jobExpId} class="mono-input" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="input-label" for={inputIds.jobWorkers}>Max Workers</label>
        <select id={inputIds.jobWorkers} bind:value={jobWorkers} class="form-select">
          {#each [1,2,3,4,5,6,7,8] as w}
            <option value={String(w)}>{w}</option>
          {/each}
        </select>
      </div>
      <div class="form-field">
        <label class="input-label" for={inputIds.jobMetric}>Metric</label>
        <select id={inputIds.jobMetric} bind:value={jobMetric} class="form-select">
          <option value="bpb">bpb</option>
          <option value="loss">loss</option>
          <option value="accuracy">accuracy</option>
        </select>
      </div>
    </div>
  </div>

  {#if jobBudgetNum > 0}
    <div class="cost-breakdown">
      <span class="cost-label">Escrow Breakdown:</span>
      <div class="cost-bar">
        <div class="cost-segment gpu" style="width: 95%">
          <span>GPU {jobGpuCost}</span>
        </div>
        <div class="cost-segment treasury" style="width: 5%">
        </div>
      </div>
      <div class="cost-legend">
        <span><span class="dot gpu-dot"></span>GPU 95%</span>
        <span><span class="dot treasury-dot"></span>Treasury 5%</span>
      </div>
    </div>
  {/if}

  <button
    class="action-btn primary"
    disabled={jobBudgetNum <= 0}
    on:click={openJobModal}
  >
    Create Job
  </button>
</div>

<style>
  /* Panel base */
  .panel {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    transition: box-shadow 300ms ease, transform 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--panel-delay, 0) * 120ms + 200ms) both;
  }
  .panel:hover { box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08)); }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  h2 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .panel-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    border-radius: var(--radius-pill, 100px);
    background: var(--accent-subtle);
    color: var(--accent);
  }
  .panel-badge.job { background: rgba(39,134,74,0.1); color: var(--green); }

  /* Job form */
  .job-form { margin-bottom: 16px; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 12px;
  }

  .form-field { display: flex; flex-direction: column; }

  .input-label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .mono-input {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--border);
    padding: 8px 0;
    width: 100%;
    color: var(--text-primary);
    transition: border-color 200ms;
    outline: none;
  }
  .mono-input:focus { border-color: var(--accent); }
  .mono-input::placeholder { color: var(--text-muted); opacity: 0.5; }

  .form-select {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 4px;
    border: none;
    border-bottom: 2px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    outline: none;
    transition: border-color 200ms;
    -webkit-appearance: none;
    appearance: none;
  }
  .form-select:focus { border-color: var(--accent); }

  /* Cost breakdown */
  .cost-breakdown {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
  }

  .cost-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 6px;
    display: block;
  }

  .cost-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .cost-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0;
  }
  .cost-segment.gpu { background: var(--green); }
  .cost-segment.treasury { background: var(--gold); }

  .cost-legend {
    display: flex;
    gap: 12px;
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  .cost-legend span { display: flex; align-items: center; gap: 4px; }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .gpu-dot { background: var(--green); }
  .treasury-dot { background: var(--gold); }

  /* Action button */
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
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
  .action-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .mono-input { font-size: 1.1rem; }
    .form-row { grid-template-columns: 1fr; }
  }
</style>

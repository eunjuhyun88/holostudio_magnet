<script lang="ts">
  import { router } from "../stores/router.ts";
  import PixelIcon from "./PixelIcon.svelte";
  import type { DashboardJob } from "../data/dashboardFixture.ts";
  import type { ModelSummaryItem } from "../services/types.ts";

  export let jobs: DashboardJob[] = [];
  export let models: ModelSummaryItem[] = [];
  export let nodes = 0;
  export let activeWorkers = 0;
  export let gpuCount = 0;
  export let tvl = "$0";
  export let trustScore = 0;
  export let burned = "0";

  $: runningJobs = jobs.filter(j => j.status === "running");
  $: queuedJobs = jobs.filter(j => j.status === "queued");
  $: completedJobs = jobs.filter(j => j.status === "complete");
  $: topJobs = [...runningJobs, ...queuedJobs, ...completedJobs].slice(0, 4);

  function statusColor(status: string) {
    if (status === "running") return "var(--green, #27864a)";
    if (status === "queued") return "var(--gold, #d4a017)";
    return "var(--text-muted, #9a9590)";
  }

  function statusLabel(status: string) {
    if (status === "running") return "Running";
    if (status === "queued") return "Queued";
    return "Done";
  }
</script>

<div class="dg">
  <!-- ═══ Section: Active Research ═══ -->
  <div class="dg-section">
    <div class="dg-section-header">
      <span class="dg-section-dot" style:background="var(--accent, #D97757)"></span>
      <span class="dg-section-title">Active Research</span>
      <button class="dg-section-link" on:click={() => router.navigate("research")}>View All →</button>
    </div>
    <div class="dg-cards">
      {#each topJobs as job (job.id)}
        <button class="dg-card" on:click={() => router.navigate("research", { topic: job.topic, jobId: job.id })}>
          <div class="dg-card-top">
            <span class="dg-card-status" style:color={statusColor(job.status)}>
              {#if job.status === "running"}<span class="dg-pulse"></span>{/if}
              {statusLabel(job.status)}
            </span>
            {#if job.progress > 0}
              <span class="dg-card-pct">{job.progress}%</span>
            {/if}
          </div>
          <span class="dg-card-topic">{job.topic}</span>
          <div class="dg-card-bottom">
            {#if job.metric > 0}
              <span class="dg-card-metric">{job.metric.toFixed(3)} {job.metricLabel}</span>
            {/if}
            <span class="dg-card-findings">{job.findings} findings</span>
          </div>
          {#if job.status === "running" && job.progress > 0}
            <div class="dg-card-bar"><div class="dg-card-bar-fill" style:width="{job.progress}%"></div></div>
          {/if}
        </button>
      {/each}
      {#if topJobs.length === 0}
        <div class="dg-card dg-card-empty">
          <span class="dg-card-topic" style:color="var(--text-muted)">No active research</span>
          <span class="dg-card-findings">Start a new job above</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- ═══ Bottom row: Models + Network + Protocol mini cards ═══ -->
  <div class="dg-stats-row">
    <!-- Models -->
    <button class="dg-stat-card" on:click={() => router.navigate("models")}>
      <span class="dg-stat-icon"><PixelIcon type="grid" size={20} /></span>
      <div class="dg-stat-body">
        <span class="dg-stat-title">Top Models</span>
        <div class="dg-stat-items">
          {#each models.slice(0, 3) as m}
            <div class="dg-stat-item">
              <span class="dg-stat-name">{m.name}</span>
              <span class="dg-stat-val" style:color="var(--accent)">{m.metric}</span>
            </div>
          {/each}
        </div>
      </div>
    </button>

    <!-- Network -->
    <button class="dg-stat-card" on:click={() => router.navigate("network")}>
      <span class="dg-stat-icon"><PixelIcon type="globe" size={20} /></span>
      <div class="dg-stat-body">
        <span class="dg-stat-title">Mesh Network</span>
        <div class="dg-stat-nums">
          <div class="dg-stat-num">
            <span class="dg-stat-big" style:color="var(--green)">{nodes}</span>
            <span class="dg-stat-label">Nodes</span>
          </div>
          <div class="dg-stat-num">
            <span class="dg-stat-big">{activeWorkers}</span>
            <span class="dg-stat-label">Active</span>
          </div>
          <div class="dg-stat-num">
            <span class="dg-stat-big" style:color="var(--gold)">{gpuCount}×</span>
            <span class="dg-stat-label">GPU</span>
          </div>
        </div>
      </div>
    </button>

    <!-- Protocol -->
    <button class="dg-stat-card" on:click={() => router.navigate("protocol")}>
      <span class="dg-stat-icon"><PixelIcon type="protocol" size={20} /></span>
      <div class="dg-stat-body">
        <span class="dg-stat-title">Protocol</span>
        <div class="dg-stat-nums">
          <div class="dg-stat-num">
            <span class="dg-stat-big" style:color="var(--accent)">{tvl}</span>
            <span class="dg-stat-label">TVL</span>
          </div>
          <div class="dg-stat-num">
            <span class="dg-stat-big" style:color="var(--green)">{trustScore}</span>
            <span class="dg-stat-label">Trust</span>
          </div>
          <div class="dg-stat-num">
            <span class="dg-stat-big" style:color="var(--red)">{burned}</span>
            <span class="dg-stat-label">Burned</span>
          </div>
        </div>
      </div>
    </button>
  </div>
</div>

<style>
  .dg {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 0 16px 80px;
  }

  /* ── Section header ── */
  .dg-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .dg-section-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .dg-section-title {
    font-family: var(--font-mono);
    font-size: 0.56rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .dg-section-link {
    appearance: none; border: none; background: transparent;
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 600;
    color: var(--accent, #D97757);
    cursor: pointer; margin-left: auto;
    padding: 2px 6px; border-radius: 4px;
    transition: background 100ms;
  }
  .dg-section-link:hover { background: rgba(217,119,87,0.08); }

  /* ── Research job cards ── */
  .dg-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--card-gap, 16px);
  }
  .dg-card {
    appearance: none; border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff);
    border-radius: 12px;
    padding: 12px 14px;
    cursor: pointer;
    text-align: left;
    display: flex; flex-direction: column; gap: 4px;
    transition: all 150ms;
    position: relative;
    overflow: hidden;
  }
  .dg-card:hover {
    border-color: var(--accent, #D97757);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    transform: translateY(-2px);
  }
  .dg-card-empty {
    cursor: default; opacity: 0.6;
    border-style: dashed;
  }
  .dg-card-empty:hover {
    border-color: var(--border); box-shadow: none; transform: none;
  }

  .dg-card-top {
    display: flex; align-items: center; justify-content: space-between;
  }
  .dg-card-status {
    font-family: var(--font-mono);
    font-size: 0.44rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 4px;
  }
  .dg-pulse {
    width: 5px; height: 5px; border-radius: 50%;
    background: currentColor;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .dg-card-pct {
    font-family: var(--font-mono);
    font-size: 0.56rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }

  .dg-card-topic {
    font-family: var(--font-mono);
    font-size: 0.62rem; font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .dg-card-bottom {
    display: flex; align-items: center; gap: 6px;
    margin-top: 2px;
  }
  .dg-card-metric {
    font-family: var(--font-mono);
    font-size: 0.52rem; font-weight: 700;
    color: var(--accent, #D97757);
  }
  .dg-card-findings {
    font-family: var(--font-mono);
    font-size: 0.46rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
  }

  .dg-card-bar {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; background: rgba(0,0,0,0.04);
  }
  .dg-card-bar-fill {
    height: 100%; border-radius: 0 1px 0 0;
    background: var(--green, #27864a);
    transition: width 600ms ease;
  }

  /* ── Bottom stat cards row ── */
  .dg-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--card-gap, 16px);
  }
  .dg-stat-card {
    appearance: none; border: 1px solid var(--border-subtle, #EDEAE5);
    background: var(--surface, #fff);
    border-radius: 12px;
    padding: 12px 14px;
    cursor: pointer; text-align: left;
    display: flex; gap: 8px; align-items: flex-start;
    transition: all 150ms;
  }
  .dg-stat-card:hover {
    border-color: rgba(0,0,0,0.12);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    transform: translateY(-2px);
  }
  .dg-stat-icon {
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted, #9a9590); flex-shrink: 0;
  }
  .dg-stat-body { flex: 1; min-width: 0; }
  .dg-stat-title {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 700;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-bottom: 6px; display: block;
  }

  /* Model items list */
  .dg-stat-items { display: flex; flex-direction: column; gap: 3px; }
  .dg-stat-item {
    display: flex; align-items: center; justify-content: space-between; gap: 4px;
  }
  .dg-stat-name {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 500;
    color: var(--text-secondary, #6b6560);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dg-stat-val {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 700;
    flex-shrink: 0;
  }

  /* Number grid */
  .dg-stat-nums {
    display: flex; gap: 12px;
  }
  .dg-stat-num {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
  }
  .dg-stat-big {
    font-family: var(--font-mono);
    font-size: 0.82rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    line-height: 1;
  }
  .dg-stat-label {
    font-family: var(--font-mono);
    font-size: 0.38rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
  }

  /* ── Responsive ── */
  @media (max-width: 700px) {
    .dg-stats-row { grid-template-columns: 1fr; }
    .dg-cards { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 420px) {
    .dg-cards { grid-template-columns: 1fr; }
    .dg { padding: 0 8px 16px; gap: 12px; }
  }
</style>

<script lang="ts">
  import { router } from "../stores/router.ts";
  import type { DashboardJob } from "../data/dashboardFixture.ts";

  export let jobs: DashboardJob[] = [];

  function statusIcon(status: DashboardJob['status']): string {
    switch (status) {
      case 'running': return '●';
      case 'complete': return '✓';
      case 'queued': return '◐';
    }
  }

  function statusColor(status: DashboardJob['status']): string {
    switch (status) {
      case 'running': return 'var(--accent, #D97757)';
      case 'complete': return 'var(--green, #27864a)';
      case 'queued': return 'var(--text-muted, #9a9590)';
    }
  }

  function handleJobClick(job: DashboardJob) {
    router.navigate('research', { topic: job.topic });
  }
</script>

<div class="rj-panel">
  <div class="rj-header">
    <span class="rj-label">Active Research</span>
    <span class="rj-count">{jobs.length}</span>
  </div>

  <div class="rj-list">
    {#each jobs as job (job.id)}
      <button class="rj-row" on:click={() => handleJobClick(job)}>
        <span class="rj-status" style:color={statusColor(job.status)}>
          {statusIcon(job.status)}
        </span>

        <span class="rj-topic">{job.topic}</span>

        <div class="rj-progress-wrap">
          <div class="rj-progress-bar">
            <div class="rj-progress-fill"
                 class:complete={job.status === 'complete'}
                 style:width="{job.progress}%"></div>
          </div>
          <span class="rj-pct">{job.progress}%</span>
        </div>

        <span class="rj-metric">
          <span class="rj-metric-val">{job.metric}</span>
          <span class="rj-metric-lbl">{job.metricLabel}</span>
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .rj-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .rj-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px 10px;
  }

  .rj-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted, #9a9590);
  }

  .rj-count {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.5rem;
    font-weight: 700;
    color: var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.08);
    border: 1px solid rgba(217, 119, 87, 0.15);
    padding: 1px 6px;
    border-radius: var(--radius-pill, 100px);
  }

  .rj-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.03);
  }

  .rj-row {
    appearance: none;
    border: none;
    display: grid;
    grid-template-columns: 16px 1fr 100px 56px;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--surface, #fff);
    cursor: pointer;
    transition: background 200ms;
    text-align: left;
  }

  .rj-row:hover {
    background: var(--page-bg, #FAF9F7);
  }

  .rj-status {
    font-size: 0.72rem;
    text-align: center;
  }

  .rj-topic {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rj-progress-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rj-progress-bar {
    flex: 1;
    height: 3px;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .rj-progress-fill {
    height: 100%;
    background: var(--accent, #D97757);
    border-radius: 2px;
    transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .rj-progress-fill.complete {
    background: var(--green, #27864a);
  }

  .rj-pct {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    min-width: 24px;
    text-align: right;
  }

  .rj-metric {
    display: flex;
    align-items: baseline;
    gap: 2px;
    justify-content: flex-end;
  }

  .rj-metric-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }

  .rj-metric-lbl {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.42rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .rj-row {
      grid-template-columns: 16px 1fr 80px 50px;
      gap: 6px;
      padding: 9px 12px;
    }
  }

  @media (max-width: 480px) {
    .rj-row {
      grid-template-columns: 16px 1fr 50px;
    }
    .rj-metric {
      display: none;
    }
    .rj-topic {
      font-size: 0.68rem;
    }
  }
</style>

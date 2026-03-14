<script lang="ts">
  import type { DashboardJob } from "../../data/dashboardFixture.ts";
  import { router } from "../../stores/router.ts";

  export let jobs: DashboardJob[] = [];

  function statusIcon(s: string) { return s === "complete" ? "✓" : s === "running" ? "●" : "◐"; }
  function statusColor(s: string) { return s === "complete" ? "var(--green)" : s === "running" ? "var(--accent)" : "var(--gold)"; }
</script>

<div class="jl">
  {#each jobs as job (job.id)}
    <button class="jl-row" on:click={() => router.navigate("research", { topic: job.topic })}>
      <span class="jl-dot" style:color={statusColor(job.status)}>{statusIcon(job.status)}</span>
      <div class="jl-info">
        <span class="jl-name">{job.topic}</span>
        {#if job.status === "running"}
          <div class="jl-progress">
            <div class="jl-progress-fill" style:width="{job.progress}%"></div>
          </div>
        {/if}
      </div>
      <span class="jl-badge" class:run={job.status === "running"} class:done={job.status === "complete"}>
        {job.status === "complete" ? "done" : job.status === "running" ? `${job.progress}%` : "queued"}
      </span>
    </button>
  {/each}
  {#if jobs.length === 0}
    <div class="jl-empty">No research jobs</div>
  {/if}
</div>

<style>
  .jl { display: flex; flex-direction: column; gap: 2px; }
  .jl-row {
    appearance: none; border: none;
    background: rgba(0,0,0,0.02);
    display: flex; align-items: center; gap: 6px;
    padding: 6px 8px; border-radius: 6px;
    cursor: pointer; transition: background 120ms;
    text-align: left; width: 100%;
  }
  .jl-row:hover { background: rgba(0,0,0,0.05); }
  .jl-dot { font-size: 0.5rem; flex-shrink: 0; }
  .jl-info {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 3px;
  }
  .jl-name {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 600;
    color: var(--text-primary, #2C2824);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .jl-progress {
    height: 3px; border-radius: 2px;
    background: rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .jl-progress-fill {
    height: 100%; border-radius: 2px;
    background: var(--accent, #D97757);
    transition: width 400ms ease;
    box-shadow: 0 0 4px rgba(217,119,87,0.3);
  }
  .jl-badge {
    font-family: var(--font-mono); font-size: 0.48rem; font-weight: 600;
    padding: 2px 6px; border-radius: 6px;
    background: rgba(0,0,0,0.04); color: var(--text-muted, #9a9590);
    flex-shrink: 0;
  }
  .jl-badge.run { background: rgba(217,119,87,0.12); color: var(--accent); }
  .jl-badge.done { background: rgba(39,134,74,0.12); color: var(--green); }
  .jl-empty { font-size: 0.55rem; color: var(--text-muted, #9a9590); text-align: center; padding: 12px; }
</style>

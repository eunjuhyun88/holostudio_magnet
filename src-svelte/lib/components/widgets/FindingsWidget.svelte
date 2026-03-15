<script lang="ts">
  import type { DashboardJob } from "../../data/dashboardFixture.ts";
  import { router } from "../../stores/router.ts";

  export let jobs: DashboardJob[] = [];

  $: withFindings = jobs.filter(j => j.findings > 0);
</script>

<div class="fw">
  {#each withFindings as job}
    <button class="fw-row" on:click={() => router.navigate("studio", { topic: job.topic, jobId: job.id })}>
      <span class="fw-name">{job.topic}</span>
      <span class="fw-val">{job.findings}</span>
    </button>
  {/each}
  {#if withFindings.length === 0}
    <div class="fw-empty">No findings yet</div>
  {/if}
</div>

<style>
  .fw { display: flex; flex-direction: column; gap: 2px; }
  .fw-row {
    appearance: none; border: none;
    background: rgba(0,0,0,0.02);
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 6px; border-radius: 4px;
    cursor: pointer; transition: background 120ms;
    text-align: left; width: 100%;
  }
  .fw-row:hover { background: rgba(0,0,0,0.04); }
  .fw-name {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
  }
  .fw-val {
    font-family: var(--font-mono); font-size: 0.65rem; font-weight: 700;
    color: var(--green, #27864a);
  }
  .fw-empty { font-size: 0.55rem; color: var(--text-muted, #9a9590); text-align: center; padding: 12px; }
</style>

<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import {
    buildJobNodeCountMap,
    buildJobOutcomeStateMap,
    buildJobStageMetrics,
    buildJobSwarmGroups,
    workerTone,
  } from "../../src/core/meshSim.ts";
  import type { Job, Node, TapeEntry, Worker } from "../../src/fixed/types.ts";
  import StatePill from "./StatePill.svelte";

  export let workers: Worker[] = [];
  export let jobs: Job[] = [];
  export let renderNodes: Node[] = [];
  export let tape: TapeEntry[] = [];
  export let selectedWorkerId: string | null = null;
  export let compact = false;
  export let tablet = false;

  const dispatch = createEventDispatcher<{ select: string }>();

  $: jobNodeCountMap = buildJobNodeCountMap(renderNodes);
  $: swarmGroups = buildJobSwarmGroups(jobs, jobNodeCountMap).slice(0, 4);
  $: availableDonors = renderNodes.filter((node) => !node.jobId).length;
  $: jobOutcomeById = buildJobOutcomeStateMap(jobs, workers, tape);

  function selectWorker(workerId: string) {
    dispatch("select", workerId);
  }
</script>

<div class="stack">
  <div
    class="workerGrid"
    style:grid-template-columns={compact ? "1fr" : tablet ? "repeat(2, minmax(0, 1fr))" : `repeat(${Math.min(workers.length, 3)}, minmax(0, 1fr))`}
  >
    {#each workers as worker (worker.id)}
      {@const progress = Math.round((worker.progress ?? 0) * 100)}
      {@const tone = workerTone[worker.state]}
      <button
        type="button"
        class:selected={worker.id === selectedWorkerId}
        class="card"
        style:--accent={tone}
        on:click={() => selectWorker(worker.id)}
      >
        <!-- Accent glow for active states -->
        {#if worker.state === "training" || worker.state === "evaluating"}
          <div class="card-glow"></div>
        {/if}

        <div class="card-top">
          <div class="card-identity">
            <span class="card-id">{worker.id}</span>
            <span class="card-region">{worker.region}</span>
          </div>
          <StatePill label={worker.state} color={tone} />
        </div>

        <div class="card-info">
          <span class="info-gpu">{worker.gpuLabel}</span>
          <span class="info-sep"></span>
          <span class="info-detail">{worker.experimentId}</span>
        </div>

        <div class="progress-track">
          <div class="progress-fill" style:width="{progress}%"></div>
          {#if worker.state === "training" || worker.state === "evaluating"}
            <div class="progress-glow" style:width="{progress}%"></div>
          {/if}
        </div>

        <div class="card-metrics">
          <div class="metric">
            <span class="metric-label">Progress</span>
            <span class="metric-value">{progress}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Delta</span>
            <span class="metric-value" class:positive={typeof worker.metricDelta === "number" && worker.metricDelta > 0} class:negative={typeof worker.metricDelta === "number" && worker.metricDelta < 0}>
              {#if typeof worker.metricDelta === "number"}
                {worker.metricDelta > 0 ? "+" : ""}{worker.metricDelta.toFixed(4)}
              {:else}
                --
              {/if}
            </span>
          </div>
        </div>
      </button>
    {/each}
  </div>

  <div class="partitions">
    <div class="partitions-header">
      <span class="partitions-title">Swarm Partitions</span>
      <span class="partitions-free">{availableDonors.toLocaleString()} free</span>
    </div>
    <div class="partition-list">
      {#each swarmGroups as group (group.id)}
        <div class="partition">
          <div class="partition-top">
            <span class="partition-id">{group.id}</span>
            <StatePill label={group.state} color={group.tone} />
          </div>
          <div class="partition-stats">
            <span>{group.donors.toLocaleString()} donors</span>
            <span class="stat-sep"></span>
            <span>{group.workers} GPU</span>
            <span class="stat-sep"></span>
            <span>{group.shards} shards</span>
          </div>
          <div class="stage-meter">
            {#each buildJobStageMetrics(group.state, jobOutcomeById.get(group.id) ?? null) as step (`${group.id}-${step.label}`)}
              <div
                class="seg"
                class:done={step.done}
                class:active={step.active}
                style:--seg-color={step.tone}
              ></div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .workerGrid {
    display: grid;
    gap: 10px;
  }

  .card {
    appearance: none;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: inherit;
    cursor: pointer;
    overflow: hidden;
    transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
  }

  .card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .card.selected {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    background: color-mix(in srgb, var(--accent) 4%, transparent);
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .card-glow {
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.6;
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .card-identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-id {
    font-weight: 600;
    font-size: 0.84rem;
    color: #ffffff;
  }

  .card-region {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.02em;
  }

  .card-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .info-gpu {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .info-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
  }

  .progress-track {
    height: 3px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    border-radius: 100px;
    background: var(--accent);
    transition: width 300ms ease;
  }

  .progress-glow {
    position: absolute;
    top: -2px;
    left: 0;
    height: 7px;
    border-radius: 100px;
    background: var(--accent);
    opacity: 0.2;
    filter: blur(4px);
    transition: width 300ms ease;
  }

  .card-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .metric {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .metric-label {
    font-size: 0.64rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.25);
  }

  .metric-value {
    font-size: 0.78rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.7);
  }

  .metric-value.positive { color: #2ad47d; }
  .metric-value.negative { color: #ff5d73; }

  /* ─── Partitions ─── */
  .partitions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .partitions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .partitions-title {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
  }

  .partitions-free {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.2);
  }

  .partition-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .partition {
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 200ms ease;
  }

  .partition:hover {
    background: rgba(255, 255, 255, 0.035);
  }

  .partition-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .partition-id {
    font-weight: 600;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .partition-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.25);
    margin-bottom: 8px;
  }

  .stat-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
  }

  .stage-meter {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3px;
  }

  .seg {
    height: 3px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.05);
    transition: background 300ms ease, box-shadow 300ms ease;
  }

  .seg.done {
    background: var(--seg-color);
    opacity: 0.5;
  }

  .seg.active {
    background: var(--seg-color);
    opacity: 1;
    box-shadow: 0 0 10px color-mix(in srgb, var(--seg-color) 40%, transparent);
  }
</style>

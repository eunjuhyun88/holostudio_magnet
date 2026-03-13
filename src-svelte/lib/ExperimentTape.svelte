<script lang="ts">
  import type { TapeEntry } from "../../src/fixed/types.ts";
  import StatePill from "./StatePill.svelte";

  export let tape: TapeEntry[] = [];
  export let compact = false;

  const toneByResult = {
    keep: "#2ad47d",
    discard: "#ff5d73",
    crash: "#d84cff",
  } as const;
</script>

<div class="tape">
  {#each tape as entry, i (`${entry.ts}-${entry.workerId}`)}
    <div class:compact class="row" style:--entry-tone={toneByResult[entry.result]} style:--delay="{i * 40}ms">
      <div class="row-indicator">
        <div class="indicator-dot"></div>
        {#if i < tape.length - 1}
          <div class="indicator-line"></div>
        {/if}
      </div>
      <div class="row-content">
        <div class="row-top">
          <div class="row-ids">
            <span class="experiment-id">{entry.experimentId}</span>
            <span class="worker-id">{entry.workerId}</span>
          </div>
          <div class="row-right">
            {#if typeof entry.metricDelta === "number"}
              <span class="metric-delta" class:positive={entry.metricDelta > 0} class:negative={entry.metricDelta < 0}>
                {entry.metricDelta > 0 ? "+" : ""}{entry.metricDelta.toFixed(4)}
              </span>
            {/if}
            <StatePill label={entry.result} color={toneByResult[entry.result]} />
          </div>
        </div>
        <div class="row-ts">{entry.ts}</div>
      </div>
    </div>
  {/each}
</div>

<style>
  .tape {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .row {
    display: flex;
    gap: 12px;
    padding: 0;
    animation: fade-in 300ms ease both;
    animation-delay: var(--delay, 0ms);
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateX(-4px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .row.compact {
    gap: 8px;
  }

  .row-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 14px;
    flex-shrink: 0;
    padding-top: 14px;
  }

  .indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--entry-tone);
    box-shadow: 0 0 8px color-mix(in srgb, var(--entry-tone) 40%, transparent);
    flex-shrink: 0;
  }

  .indicator-line {
    width: 1.5px;
    flex: 1;
    margin: 4px 0;
    background: rgba(255, 255, 255, 0.04);
  }

  .row-content {
    flex: 1;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.03);
    margin-bottom: 4px;
    transition: background 200ms ease;
  }

  .row-content:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .row.compact .row-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .row-ids {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .experiment-id {
    font-weight: 600;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .worker-id {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .row-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .metric-delta {
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.4);
  }

  .metric-delta.positive { color: #2ad47d; }
  .metric-delta.negative { color: #ff5d73; }

  .row-ts {
    font-size: 0.66rem;
    color: rgba(255, 255, 255, 0.18);
    font-variant-numeric: tabular-nums;
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ModeButton from "./ModeButton.svelte";

  export let nodeCount = 0;
  export let recentNodeJoinDelta = 0;
  export let totalGpu = 0;
  export let activeWorkers = 0;
  export let activeFlowCount = 0;
  export let runtimeLabel = "";
  export let myNodeState: string | null = null;
  export let telemetryMode: "fixture" | "live" = "fixture";
  export let telemetryUrl: string | null = null;

  const dispatch = createEventDispatcher<{
    modeChange: "fixture" | "live";
    viewGlobe: void;
  }>();
</script>

<div class="stats-banner">
  <div class="banner-inner">
    <div class="banner-left">
      <div class="banner-live"></div>
      <div class="banner-identity">
        <span class="banner-eyebrow">GPU INFRASTRUCTURE</span>
        <h2 class="banner-heading">Compute Mesh</h2>
      </div>
    </div>
    <div class="banner-stats">
      <span class="bstat"><strong>{nodeCount.toLocaleString()}</strong> nodes{#if recentNodeJoinDelta > 0}<span class="delta">+{recentNodeJoinDelta}</span>{/if}</span>
      <span class="bstat-sep"></span>
      <span class="bstat"><strong>{totalGpu}</strong> GPU</span>
      <span class="bstat-sep"></span>
      <span class="bstat"><strong>{activeWorkers}</strong> workers</span>
      <span class="bstat-sep"></span>
      <span class="bstat"><strong>{activeFlowCount}</strong> flows</span>
      <span class="bstat-sep"></span>
      <span class="bstat"><strong>{Math.round(nodeCount * 1240).toLocaleString()}</strong> bonded</span>
      <span class="bstat-sep"></span>
      <span class="bstat green-stat"><strong>98.2%</strong> spot-check</span>
      <span class="bstat-sep"></span>
      <span class="bstat muted">{runtimeLabel}</span>
      {#if myNodeState}
        <span class="bstat-sep"></span>
        <span class="bstat gpu-status">
          <span class="gpu-dot" class:training={myNodeState === 'training'} class:available={myNodeState === 'available'}></span>
          YOUR GPU: <strong>{myNodeState.toUpperCase()}</strong>
        </span>
      {/if}
    </div>
    <div class="banner-right">
      <ModeButton label="Fixture" active={telemetryMode === "fixture"} on:click={() => dispatch('modeChange', 'fixture')} />
      <ModeButton label="Live" active={telemetryMode === "live"} disabled={!telemetryUrl} on:click={() => telemetryUrl && dispatch('modeChange', 'live')} />
      <button class="globe-link" on:click={() => dispatch('viewGlobe')} title="3D Globe View">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .stats-banner {
    border-bottom: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    flex-shrink: 0;
  }
  .banner-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 10px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .banner-left { flex-shrink: 0; display: flex; align-items: center; gap: 10px; }
  .banner-live {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 12px rgba(39, 134, 74, 0.5);
    animation: pulse-live 2s ease-in-out infinite;
  }
  @keyframes pulse-live {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .banner-identity {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .banner-eyebrow {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    line-height: 1;
  }
  .banner-heading {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .banner-stats {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    flex-wrap: wrap;
  }
  .bstat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.74rem;
    color: var(--text-secondary, #6b6560);
    white-space: nowrap;
  }
  .bstat strong {
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .bstat-sep { width: 1px; height: 14px; background: var(--border-subtle, #EDEAE5); }
  .bstat .delta { color: var(--green, #27864a); font-weight: 600; margin-left: 2px; font-size: 0.68rem; }
  .bstat.muted { color: var(--text-muted, #9a9590); font-size: 0.68rem; }
  .bstat.green-stat strong { color: var(--green, #27864a); }
  .banner-right { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
  .globe-link {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    width: 30px; height: 30px;
    border-radius: var(--radius-sm, 6px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    transition: all 150ms ease;
    margin-left: 4px;
  }
  .globe-link:hover {
    border-color: var(--accent, #D97757);
    color: var(--accent, #D97757);
  }

  .gpu-status {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem !important;
    letter-spacing: 0.04em;
  }
  .gpu-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #9a9590);
    margin-right: 2px;
    vertical-align: middle;
  }
  .gpu-dot.training {
    background: var(--accent, #D97757);
    box-shadow: 0 0 8px rgba(217, 119, 87, 0.5);
    animation: pulse-live 2s ease-in-out infinite;
  }
  .gpu-dot.available {
    background: var(--green, #27864a);
    box-shadow: 0 0 8px rgba(39, 134, 74, 0.4);
  }

  @media (max-width: 860px) {
    .banner-inner { flex-wrap: wrap; gap: 8px; padding: 8px 16px; }
    .banner-stats { gap: 8px; }
  }
  @media (max-width: 600px) {
    .banner-stats { display: none; }
  }
</style>

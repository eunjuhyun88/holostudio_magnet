<script lang="ts">
  import type { ProtocolPhaseMetric } from "../../src/core/meshSim.ts";

  export let phases: ProtocolPhaseMetric[] = [];

  const layerLabels = ["PROOF", "MODEL", "AGENT"];
</script>

<div class="pipeline">
  <div class="pipeline-header">
    <span class="pipeline-kicker">Protocol Pipeline</span>
    <div class="layer-indicators">
      {#each layerLabels as layer, i}
        <span class="layer-tag" class:active={i <= 1}>
          L{i + 1}
          <span class="layer-name">{layer}</span>
        </span>
      {/each}
    </div>
  </div>

  <div class="phase-stack">
    {#each phases as phase, i (phase.label)}
      <div class="phase-row" class:has-value={phase.value > 0}>
        <div class="phase-indicator">
          <div class="phase-dot" style:--dot-color={phase.tone} class:active={phase.value > 0}>
            {#if phase.value > 0}
              <div class="dot-ring"></div>
            {/if}
          </div>
          {#if i < phases.length - 1}
            <div class="phase-line" class:active={phase.value > 0}></div>
          {/if}
        </div>
        <div class="phase-content">
          <div class="phase-top">
            <span class="phase-name">{phase.label}</span>
            <span class="phase-value" style:color={phase.value > 0 ? phase.tone : 'rgba(255,255,255,0.2)'}>
              {phase.value}
            </span>
          </div>
          <div class="phase-detail">{phase.detail}</div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .pipeline {
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(10, 12, 18, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    min-width: 0;
    pointer-events: auto;
  }

  .pipeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 8px;
  }

  .pipeline-kicker {
    font-size: 0.56rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.25);
  }

  .layer-indicators {
    display: flex;
    gap: 4px;
  }

  .layer-tag {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 0.5rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .layer-tag.active {
    color: rgba(142, 182, 255, 0.6);
    border-color: rgba(142, 182, 255, 0.12);
    background: rgba(142, 182, 255, 0.05);
  }

  .layer-name {
    font-weight: 500;
  }

  .phase-stack {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .phase-row {
    display: flex;
    gap: 8px;
    min-height: 36px;
  }

  .phase-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex-shrink: 0;
    padding-top: 4px;
  }

  .phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    position: relative;
    transition: background 300ms ease, border-color 300ms ease, box-shadow 300ms ease;
  }

  .phase-dot.active {
    background: var(--dot-color);
    border-color: var(--dot-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .dot-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1px solid var(--dot-color);
    opacity: 0.25;
    animation: ring-pulse 2s ease-in-out infinite;
  }

  @keyframes ring-pulse {
    0%, 100% { transform: scale(1); opacity: 0.25; }
    50% { transform: scale(1.3); opacity: 0; }
  }

  .phase-line {
    width: 1.5px;
    flex: 1;
    margin: 3px 0;
    background: rgba(255, 255, 255, 0.06);
    transition: background 300ms ease;
  }

  .phase-line.active {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.04));
  }

  .phase-content {
    flex: 1;
    padding-bottom: 8px;
  }

  .phase-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }

  .phase-name {
    font-size: 0.68rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.01em;
  }

  .phase-value {
    font-size: 0.74rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    transition: color 300ms ease;
  }

  .phase-detail {
    font-size: 0.58rem;
    color: rgba(255, 255, 255, 0.2);
    line-height: 1.3;
  }
</style>

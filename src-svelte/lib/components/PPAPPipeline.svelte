<script lang="ts">
  import { onMount } from 'svelte';
  import { PPAP_STAGES } from '../data/protocolData.ts';

  const ppapStages = PPAP_STAGES;

  let ppapActiveStage = 0;
  let ppapInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    ppapInterval = setInterval(() => {
      ppapActiveStage = (ppapActiveStage + 1) % 4;
    }, 2200);

    return () => {
      if (ppapInterval) clearInterval(ppapInterval);
    };
  });
</script>

<div class="panel ppap-panel" style="--panel-delay: 1.5">
  <div class="panel-header">
    <h2>PPAP Pipeline</h2>
    <span class="panel-badge">Provenance</span>
  </div>

  <div class="ppap-pipeline">
    {#each ppapStages as stage, i}
      <div class="ppap-stage" class:active={ppapActiveStage >= i} class:current={ppapActiveStage === i}>
        <div class="ppap-dot" style="--stage-color: {stage.color}">
          <span class="ppap-icon">{stage.icon}</span>
        </div>
        <div class="ppap-info">
          <span class="ppap-label">{stage.label}</span>
          <span class="ppap-sub">{stage.sub}</span>
        </div>
        {#if i < ppapStages.length - 1}
          <div class="ppap-connector" class:filled={ppapActiveStage > i}></div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="ppap-stats">
    <div class="ppap-stat">
      <span class="ppap-stat-val">2,891</span>
      <span class="ppap-stat-label">Batches</span>
    </div>
    <div class="ppap-stat">
      <span class="ppap-stat-val">99.7%</span>
      <span class="ppap-stat-label">Valid Rate</span>
    </div>
    <div class="ppap-stat">
      <span class="ppap-stat-val">3</span>
      <span class="ppap-stat-label">Challenged</span>
    </div>
  </div>
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

  /* PPAP Pipeline */
  .ppap-pipeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 20px;
    position: relative;
  }

  .ppap-stage {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    position: relative;
    opacity: 0.4;
    transition: opacity 400ms ease;
  }

  .ppap-stage.active { opacity: 1; }

  .ppap-stage.current .ppap-dot {
    animation: ppapPulse 1.5s ease-in-out infinite;
  }

  @keyframes ppapPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.3); }
    50% { box-shadow: 0 0 0 8px rgba(217,119,87,0); }
  }

  .ppap-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--stage-color) 10%, var(--surface, #fff));
    border: 2px solid var(--stage-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 300ms ease;
  }

  .ppap-stage.active .ppap-dot {
    background: color-mix(in srgb, var(--stage-color) 15%, var(--surface, #fff));
  }

  .ppap-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .ppap-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .ppap-label {
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .ppap-sub {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .ppap-connector {
    position: absolute;
    left: 17px;
    bottom: -2px;
    width: 2px;
    height: 12px;
    background: var(--border);
    transition: background 300ms ease;
    z-index: 0;
  }

  .ppap-connector.filled {
    background: var(--accent);
  }

  .ppap-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .ppap-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .ppap-stat-val {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .ppap-stat-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
  }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .ppap-stats { grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel { animation: none; }
    .ppap-stage.current .ppap-dot { animation: none; }
    .ppap-stage { transition: none; }
    .ppap-connector { transition: none; }
    .ppap-dot { transition: none; }
  }
</style>

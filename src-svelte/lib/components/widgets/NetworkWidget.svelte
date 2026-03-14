<script lang="ts">
  import type { SystemMetrics } from "../../data/dashboardFixture.ts";
  import { router } from "../../stores/router.ts";

  export let system: SystemMetrics;

  $: cpuPct = system.cpuUsage;
  $: memPct = Math.round((system.memUsedGb / system.memTotalGb) * 100);
  $: vramPct = Math.round((system.vramUsedGb / system.vramTotalGb) * 100);
</script>

<button class="nw" on:click={() => router.navigate("network")}>
  <div class="nw-top">
    <span class="nw-dot"></span>
    <span class="nw-stat"><strong>{system.nodes}</strong> Nodes</span>
    <span class="nw-sep">·</span>
    <span class="nw-stat"><strong>{Math.ceil(system.nodes / 2)}×</strong> GPU</span>
    <span class="nw-arrow">→</span>
  </div>
  <div class="nw-bars">
    <div class="nw-bar-row">
      <span class="nw-bar-label">CPU</span>
      <div class="nw-bar"><div class="nw-bar-fill" style:width="{cpuPct}%" class:high={cpuPct > 80}></div></div>
      <span class="nw-bar-val">{cpuPct}%</span>
    </div>
    <div class="nw-bar-row">
      <span class="nw-bar-label">MEM</span>
      <div class="nw-bar"><div class="nw-bar-fill" style:width="{memPct}%"></div></div>
      <span class="nw-bar-val">{system.memUsedGb}/{system.memTotalGb}G</span>
    </div>
    <div class="nw-bar-row">
      <span class="nw-bar-label">VRAM</span>
      <div class="nw-bar"><div class="nw-bar-fill nw-vram" style:width="{vramPct}%"></div></div>
      <span class="nw-bar-val">{system.vramUsedGb}/{system.vramTotalGb}G</span>
    </div>
  </div>
</button>

<style>
  .nw {
    appearance: none; border: none; background: transparent;
    width: 100%; cursor: pointer; text-align: left;
  }
  .nw-top {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 8px;
  }
  .nw-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39,134,74,0.4);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .nw-stat {
    font-family: var(--font-mono); font-size: 0.56rem; font-weight: 500;
    color: var(--text-muted, #9a9590); white-space: nowrap;
  }
  .nw-stat :global(strong) { font-weight: 700; color: var(--text-primary, #2C2824); }
  .nw-sep { font-size: 0.4rem; color: var(--border, #E5E0DA); }
  .nw-arrow {
    font-size: 0.7rem; font-weight: 700;
    color: var(--green, #27864a);
    margin-left: auto; flex-shrink: 0;
    transition: transform 150ms;
  }
  .nw:hover .nw-arrow { transform: translateX(2px); }

  .nw-bars { display: flex; flex-direction: column; gap: 5px; }
  .nw-bar-row { display: flex; align-items: center; gap: 6px; }
  .nw-bar-label {
    font-family: var(--font-mono); font-size: 0.44rem; font-weight: 700;
    color: var(--text-muted, #9a9590); width: 28px; text-align: right;
    text-transform: uppercase; letter-spacing: 0.02em;
  }
  .nw-bar {
    flex: 1; height: 4px; border-radius: 2px;
    background: rgba(0,0,0,0.05); overflow: hidden;
  }
  .nw-bar-fill {
    height: 100%; border-radius: 2px;
    background: var(--blue, #2980b9);
    transition: width 600ms ease;
  }
  .nw-bar-fill.high {
    background: var(--accent, #D97757);
    box-shadow: 0 0 4px rgba(217,119,87,0.3);
  }
  .nw-bar-fill.nw-vram { background: var(--gold, #d4a017); }
  .nw-bar-val {
    font-family: var(--font-mono); font-size: 0.46rem; font-weight: 600;
    color: var(--text-secondary, #6b6560); min-width: 42px;
    font-variant-numeric: tabular-nums;
  }
</style>

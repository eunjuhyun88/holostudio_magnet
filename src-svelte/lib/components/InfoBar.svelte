<script lang="ts">
  import type { SystemMetrics } from "../data/dashboardFixture.ts";

  export let system: SystemMetrics;
  export let activeWorkers = 4;
  export let idleWorkers = 4;
  export let tvl = "$12.4M";
  export let burned = "847K";
  export let bonds = "2,341";
  export let trustScore = 847;
  export let mauPercent = 62;

  $: cpuPct = system.cpuUsage;
  $: memLabel = `${system.memUsedGb}/${system.memTotalGb}G`;
  $: vramLabel = `${system.vramUsedGb}/${system.vramTotalGb}G`;
</script>

<div class="ib">
  <!-- Network section -->
  <div class="ib-section">
    <span class="ib-dot"></span>
    <span class="ib-live">Live</span>
    <div class="ib-cell">
      <span class="ib-val">{system.nodes}</span>
      <span class="ib-key">Nodes</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val">{Math.ceil(system.nodes / 2)}×</span>
      <span class="ib-key">GPU</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val" class:ib-warn={cpuPct > 80}>{cpuPct}%</span>
      <span class="ib-key">CPU</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val">{memLabel}</span>
      <span class="ib-key">MEM</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val ib-gold">{vramLabel}</span>
      <span class="ib-key">VRAM</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val ib-green">{activeWorkers}</span>
      <span class="ib-key">Active</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val">{idleWorkers}</span>
      <span class="ib-key">Idle</span>
    </div>
  </div>

  <span class="ib-divider"></span>

  <!-- Protocol section -->
  <div class="ib-section">
    <div class="ib-cell">
      <span class="ib-val ib-accent">{tvl}</span>
      <span class="ib-key">TVL</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val ib-red">{burned}</span>
      <span class="ib-key">Burned</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val">{bonds}</span>
      <span class="ib-key">Bonds</span>
    </div>
    <div class="ib-cell">
      <span class="ib-val ib-green">{trustScore}</span>
      <span class="ib-key">Trust</span>
    </div>
    <div class="ib-cell ib-mau-cell">
      <span class="ib-val">{mauPercent}%</span>
      <span class="ib-key">MAU</span>
      <div class="ib-mau-bar">
        <div class="ib-mau-fill" style:width="{mauPercent}%"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .ib {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 24px;
    background: var(--surface-elevated, #fff);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    min-height: 38px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    z-index: 90;
  }

  .ib-section {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }

  .ib-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39, 134, 74, 0.5);
    animation: ibPulse 2.5s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes ibPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .ib-live {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.64rem;
    font-weight: 700;
    color: var(--green, #27864a);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .ib-cell {
    display: flex;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ib-val {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary, #2C2824);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .ib-val.ib-warn { color: var(--accent, #D97757); }
  .ib-val.ib-accent { color: var(--accent, #D97757); }
  .ib-val.ib-red { color: var(--red, #c0392b); }
  .ib-val.ib-green { color: var(--green, #27864a); }
  .ib-val.ib-gold { color: var(--gold, #d4a017); }

  .ib-key {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.58rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ib-divider {
    width: 1px;
    height: 20px;
    border-radius: 1px;
    background: var(--border, #E5E0DA);
    flex-shrink: 0;
  }

  .ib-mau-cell {
    gap: 4px;
  }

  .ib-mau-bar {
    width: 48px;
    height: 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.06);
    overflow: hidden;
    flex-shrink: 0;
  }

  .ib-mau-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--green, #27864a);
    transition: width 600ms ease;
  }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .ib {
      gap: 8px;
      padding: 4px 12px;
    }
    .ib-section { gap: 10px; }
  }

  @media (max-width: 600px) {
    .ib {
      gap: 8px;
      padding: 6px 12px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .ib::-webkit-scrollbar { display: none; }
    .ib-divider { display: none; }
  }
</style>

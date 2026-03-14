<script lang="ts">
  import type { ResearchMetrics, SystemMetrics } from "../data/dashboardFixture.ts";

  export let research: ResearchMetrics;
  export let system: SystemMetrics;

  interface MetricItem {
    label: string;
    value: string | number;
    color?: string;
  }

  $: items = [
    { label: 'Jobs', value: research.activeJobs, color: 'var(--accent)' },
    { label: 'Agents', value: research.activeAgents },
    { label: 'Configs', value: research.configsTested },
    { label: 'Findings', value: research.findings, color: 'var(--green)' },
    { label: 'Hit Rate', value: research.hitRate + '%' },
    { label: 'Nodes', value: system.nodes },
    { label: 'CPU', value: system.cpuUsage + '%' },
    { label: 'Mem', value: system.memUsedGb + '/' + system.memTotalGb + 'G' },
  ] as MetricItem[];
</script>

<div class="dm-panel">
  <div class="dm-header">
    <span class="dm-dot"></span>
    <span class="dm-title">System Status</span>
  </div>
  <div class="dm-grid">
    {#each items as item}
      <div class="dm-card">
        <span class="dm-value" style:color={item.color || 'var(--text-primary)'}>{item.value}</span>
        <span class="dm-label">{item.label}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .dm-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .dm-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 10px;
  }

  .dm-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39, 134, 74, 0.4);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
  }

  .dm-title {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted, #9a9590);
  }

  .dm-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: var(--radius-md, 10px);
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.03);
  }

  .dm-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 14px 10px;
    background: var(--surface, #fff);
    transition: background 200ms;
  }

  .dm-card:hover {
    background: var(--page-bg, #FAF9F7);
  }

  .dm-value {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary, #2D2D2D);
    white-space: nowrap;
  }

  .dm-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.48rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }

  /* ── Responsive: 2 columns on narrow ── */
  @media (max-width: 1024px) {
    .dm-grid {
      grid-template-columns: repeat(4, 1fr);
    }
    .dm-card {
      padding: 12px 8px;
    }
    .dm-value {
      font-size: 0.95rem;
    }
  }

  @media (max-width: 480px) {
    .dm-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    .dm-card {
      padding: 10px 6px;
    }
    .dm-value {
      font-size: 0.85rem;
    }
  }
</style>

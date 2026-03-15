<script lang="ts">
  /**
   * ActivityCard — Reusable card for Studio IDLE state.
   * Shows a single activity metric (GPU, Models, Earnings, etc.)
   * Only rendered when the activity exists (parent handles show/hide logic).
   */
  import PixelIcon from "../PixelIcon.svelte";

  export let icon: "sparkle" | "grid" | "chart" | "globe" | "protocol" | "research" | "portfolio" = "sparkle";
  export let label: string = '';
  export let value: string | number = '';
  export let subtitle: string = '';
  export let accentColor: string = 'var(--accent, #D97757)';

  // Click handler — dispatched by parent via on:click
</script>

<button class="activity-card" on:click style:--card-accent={accentColor}>
  <span class="ac-icon">
    <PixelIcon type={icon} size={18} />
  </span>
  <div class="ac-content">
    <span class="ac-value">{value}</span>
    <span class="ac-label">{label}</span>
    {#if subtitle}
      <span class="ac-subtitle">{subtitle}</span>
    {/if}
  </div>
</button>

<style>
  .activity-card {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    transition: all 160ms ease;
    text-align: left;
    min-width: 0;
  }
  .activity-card:hover {
    border-color: var(--card-accent);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }
  .activity-card:active {
    transform: translateY(0);
  }

  .ac-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    color: var(--card-accent);
    flex-shrink: 0;
  }

  .ac-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ac-value {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .ac-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ac-subtitle {
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

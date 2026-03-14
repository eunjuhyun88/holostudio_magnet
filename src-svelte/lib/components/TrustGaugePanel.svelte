<script lang="ts">
  import { fmtInt } from '../utils/format.ts';

  export let trustScore: number;
  export let mau: number;
  export let mauTarget: number;

  $: trustTier = trustScore >= 800 ? 3 : trustScore >= 500 ? 2 : 1;
  $: trustTierName = trustTier === 3 ? 'Diamond' : trustTier === 2 ? 'Gold' : 'Silver';
  $: trustTierColor = trustTier === 3 ? 'var(--blue)' : trustTier === 2 ? 'var(--gold)' : 'var(--text-muted)';
  $: trustMultiplier = trustTier === 3 ? '2.5×' : trustTier === 2 ? '1.5×' : '1.0×';
  $: trustBondReq = trustTier === 3 ? '10,000' : trustTier === 2 ? '2,000' : '500';

  $: gaugeRatio = Math.round(mau) / mauTarget;
  $: needleAngle = -90 + (gaugeRatio * 180);
</script>

<!-- Panel G: Trust Score -->
<div class="panel trust-panel" style="--panel-delay: 2">
  <div class="panel-header">
    <h2>Trust Score</h2>
    <span class="panel-badge" style="background: color-mix(in srgb, {trustTierColor} 12%, transparent); color: {trustTierColor}">
      {trustTierName}
    </span>
  </div>

  <div class="trust-score-display">
    <div class="trust-ring">
      <svg viewBox="0 0 120 120" class="trust-ring-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="{trustTierColor}" stroke-width="8"
          stroke-dasharray="{(Math.round(trustScore) / 1000) * 327} 327"
          stroke-linecap="round"
          transform="rotate(-90 60 60)"
          style="transition: stroke-dasharray 1.5s var(--ease-out-expo);"
        />
      </svg>
      <div class="trust-center">
        <span class="trust-num">{Math.round(trustScore)}</span>
        <span class="trust-max">/1000</span>
      </div>
    </div>

    <div class="trust-meta">
      <div class="trust-meta-row">
        <span class="trust-meta-label">Tier Bond</span>
        <span class="trust-meta-val">{trustBondReq} HOOT</span>
      </div>
      <div class="trust-meta-row">
        <span class="trust-meta-label">Reward Multiplier</span>
        <span class="trust-meta-val" style="color: {trustTierColor}">{trustMultiplier}</span>
      </div>
      <div class="trust-meta-row">
        <span class="trust-meta-label">Jobs Completed</span>
        <span class="trust-meta-val">142</span>
      </div>
      <div class="trust-meta-row">
        <span class="trust-meta-label">Challenges Won</span>
        <span class="trust-meta-val">38/39</span>
      </div>
    </div>
  </div>
</div>

<!-- Panel H: Emission vs Burn Gauge -->
<div class="panel gauge-panel" style="--panel-delay: 2.5">
  <div class="panel-header">
    <h2>Emission vs Burn</h2>
  </div>

  <div class="gauge-container">
    <svg viewBox="0 0 200 120" class="gauge-svg">
      <defs>
        <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--green)"/>
          <stop offset="50%" stop-color="var(--gold)"/>
          <stop offset="100%" stop-color="var(--red)"/>
        </linearGradient>
      </defs>

      <!-- Background arc -->
      <path d="M20,105 A80,80 0 0,1 180,105" fill="none" stroke="var(--border)" stroke-width="10" stroke-linecap="round"/>

      <!-- Colored arc -->
      <path d="M20,105 A80,80 0 0,1 180,105" fill="none" stroke="url(#gauge-gradient)" stroke-width="10" stroke-linecap="round" opacity="0.8"/>

      <!-- Needle -->
      <g style="transform-origin: 100px 105px; transform: rotate({needleAngle}deg); transition: transform 1.5s var(--ease-out-expo);">
        <line x1="100" y1="105" x2="100" y2="35" stroke="var(--text-primary)" stroke-width="2" stroke-linecap="round"/>
        <circle cx="100" cy="105" r="5" fill="var(--accent)"/>
      </g>

      <!-- Labels -->
      <text x="20" y="118" text-anchor="middle" fill="var(--green)" font-family="var(--font-mono)" font-size="7" font-weight="600">EMIT</text>
      <text x="180" y="118" text-anchor="middle" fill="var(--red)" font-family="var(--font-mono)" font-size="7" font-weight="600">BURN</text>
    </svg>

    <div class="gauge-labels">
      <div class="gauge-stat">
        <span class="gauge-stat-value">{fmtInt(mau)}</span>
        <span class="gauge-stat-label">Current MAU</span>
      </div>
      <div class="gauge-vs">vs</div>
      <div class="gauge-stat">
        <span class="gauge-stat-value">{fmtInt(mauTarget)}</span>
        <span class="gauge-stat-label">Deflation Target</span>
      </div>
    </div>

    <div class="gauge-progress-bar">
      <div class="gauge-fill" style="width: {gaugeRatio * 100}%"></div>
    </div>
    <span class="gauge-pct">{(gaugeRatio * 100).toFixed(1)}% to deflation crossover</span>
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

  /* Trust Score */
  .trust-score-display {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .trust-ring {
    position: relative;
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .trust-ring-svg {
    width: 100%;
    height: 100%;
  }

  .trust-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .trust-num {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .trust-max {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .trust-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .trust-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }

  .trust-meta-row:last-child {
    border-bottom: none;
  }

  .trust-meta-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .trust-meta-val {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* Gauge */
  .gauge-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .gauge-svg {
    width: 200px;
    height: 120px;
  }

  .gauge-labels {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .gauge-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .gauge-stat-value {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }

  .gauge-stat-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .gauge-vs {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .gauge-progress-bar {
    width: 100%;
    max-width: 200px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .gauge-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--green), var(--accent));
    border-radius: 2px;
    transition: width 1.5s var(--ease-out-expo);
  }

  .gauge-pct {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  @media (max-width: 860px) {
    .trust-score-display {
      flex-direction: column;
      align-items: center;
    }
  }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .gauge-svg { width: 160px; height: 96px; }
    .trust-ring { width: 96px; height: 96px; }
    .trust-num { font-size: 1.3rem; }
  }
</style>

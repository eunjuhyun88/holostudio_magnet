<script lang="ts">
  export let m: {
    topic: string;
    totalExperiments: number;
    branches: number;
    metricValue: number;
    metric: string;
    kept: number;
    discarded: number;
    crashed: number;
    duration: string;
    type: string;
    framework: string;
    rows: number;
    features: number;
    license: string;
  };
</script>

<div class="mc-section">
  <h2 class="mc-heading">Overview</h2>
  <p class="mc-text">Autonomous ML research model trained on <strong>{m.topic}</strong>. Generated through {m.totalExperiments} experiments across {m.branches} parallel branches using the HOOT distributed compute mesh.</p>
</div>

<div class="mc-section">
  <h2 class="mc-heading">Training Summary</h2>
  <div class="mc-stats-grid">
    <div class="mc-stat">
      <span class="mc-stat-val accent">{m.metricValue.toFixed(3)}</span>
      <span class="mc-stat-key">Best {m.metric}</span>
    </div>
    <div class="mc-stat">
      <span class="mc-stat-val">{m.totalExperiments}</span>
      <span class="mc-stat-key">Experiments</span>
    </div>
    <div class="mc-stat">
      <span class="mc-stat-val">{m.kept}</span>
      <span class="mc-stat-key">Kept</span>
    </div>
    <div class="mc-stat">
      <span class="mc-stat-val">{m.discarded}</span>
      <span class="mc-stat-key">Discarded</span>
    </div>
    <div class="mc-stat">
      <span class="mc-stat-val">{m.crashed}</span>
      <span class="mc-stat-key">Crashed</span>
    </div>
    <div class="mc-stat">
      <span class="mc-stat-val">{m.duration}</span>
      <span class="mc-stat-key">Duration</span>
    </div>
  </div>
</div>

<div class="mc-section">
  <h2 class="mc-heading">Model Information</h2>
  <table class="mc-table">
    <tbody>
      <tr><td class="mc-td-label">Topic</td><td>{m.topic}</td></tr>
      <tr><td class="mc-td-label">Architecture</td><td>{m.type}</td></tr>
      <tr><td class="mc-td-label">Framework</td><td>{m.framework}</td></tr>
      <tr><td class="mc-td-label">Dataset Rows</td><td>{m.rows.toLocaleString()}</td></tr>
      <tr><td class="mc-td-label">Features</td><td>{m.features}</td></tr>
      <tr><td class="mc-td-label">Branches</td><td>{m.branches}</td></tr>
      <tr><td class="mc-td-label">Keep Rate</td><td>{((m.kept / m.totalExperiments) * 100).toFixed(1)}%</td></tr>
      <tr><td class="mc-td-label">License</td><td>{m.license}</td></tr>
    </tbody>
  </table>
</div>

<style>
  .mc-section { margin-bottom: var(--space-6, 24px); }
  .mc-heading {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 var(--space-3, 12px);
    padding-bottom: var(--space-2, 8px);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mc-text {
    font-size: 0.88rem; color: var(--text-secondary, #6b6560);
    line-height: 1.6; margin: 0;
  }
  .mc-text strong { color: var(--text-primary, #2D2D2D); }

  .mc-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3, 12px);
  }
  .mc-stat {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-sm, 6px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    display: flex; flex-direction: column; gap: 2px;
    transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
  }
  .mc-stat:hover {
    border-color: rgba(217, 119, 87, 0.3);
    box-shadow: 0 0 12px rgba(217, 119, 87, 0.06);
    transform: translateY(-1px);
  }
  .mc-stat-val {
    font-size: 1.2rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .mc-stat-val.accent { color: var(--accent, #D97757); text-shadow: 0 0 6px rgba(217, 119, 87, 0.3); }
  .mc-stat-key {
    font-size: 0.62rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.06em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .mc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .mc-table td {
    padding: 10px 0;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    color: var(--text-primary, #2D2D2D);
  }
  .mc-td-label {
    color: var(--text-muted, #9a9590);
    font-weight: 500;
    width: 140px;
  }

  @media (max-width: 960px) {
    .mc-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .mc-stats-grid { grid-template-columns: 1fr 1fr; }
  }
</style>

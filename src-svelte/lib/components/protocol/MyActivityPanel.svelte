<script lang="ts">
  /**
   * MyActivityPanel — Unified earnings dashboard for Protocol page.
   * Shows Builder/Compute/Data earnings + total + recent settlements.
   * Member only (wallet connected).
   */
  import { modelPublishStore } from '../../stores/modelPublishStore.ts';
  import { nodeStore } from '../../stores/nodeStore.ts';
  import { ppapStore } from '../../stores/ppapStore.ts';

  // ── Computed data ──
  $: builderEarnings = $modelPublishStore.reduce((sum, m) => sum + m.poolA.creator, 0);
  $: builderModels = $modelPublishStore.length;
  $: computeEarnings = $nodeStore.totalEarnings;
  $: computeJobs = $nodeStore.jobsCompleted;
  $: dataConfirmed = $ppapStore.confirmedBatches;
  $: totalEarnings = builderEarnings + computeEarnings;

  // Demo recent settlements
  const recentSettlements = [
    { desc: 'Model call (crypto-24h-v3)', amount: '+0.3', time: '2h ago', type: 'builder' },
    { desc: 'Job complete (eth-ts)', amount: '+0.8', time: '5h ago', type: 'compute' },
    { desc: 'PPAP confirmed (#2891)', amount: 'eligible', time: '1d ago', type: 'data' },
  ];

  const TYPE_COLORS: Record<string, string> = {
    builder: 'var(--accent, #D97757)',
    compute: 'var(--green, #27864a)',
    data: '#2980b9',
  };
</script>

<div class="my-activity">
  <h3 class="panel-title">내 활동</h3>

  <div class="role-cards">
    <div class="role-card">
      <span class="rc-icon">🧪</span>
      <span class="rc-label">Builder</span>
      <span class="rc-value" style:color="var(--accent, #D97757)">+{builderEarnings.toFixed(1)} H</span>
      <span class="rc-sub">{builderModels} models active</span>
    </div>
    <div class="role-card">
      <span class="rc-icon">⚡</span>
      <span class="rc-label">Compute</span>
      <span class="rc-value" style:color="var(--green, #27864a)">+{computeEarnings.toFixed(1)} H</span>
      <span class="rc-sub">{computeJobs} jobs done</span>
    </div>
    <div class="role-card">
      <span class="rc-icon">📊</span>
      <span class="rc-label">Data</span>
      <span class="rc-value" style:color="#2980b9">{dataConfirmed} PPAP</span>
      <span class="rc-sub">confirmed</span>
    </div>
  </div>

  <!-- Total bar -->
  <div class="total-row">
    <span class="total-label">총 수익 (이번 주)</span>
    <span class="total-value">+{totalEarnings.toFixed(1)} HOOT</span>
  </div>

  {#if totalEarnings > 0}
    <div class="earnings-bar">
      {#if builderEarnings > 0}
        <div class="eb-seg builder" style:width="{(builderEarnings / totalEarnings * 100).toFixed(0)}%">
          <span>Builder</span>
        </div>
      {/if}
      {#if computeEarnings > 0}
        <div class="eb-seg compute" style:width="{(computeEarnings / totalEarnings * 100).toFixed(0)}%">
          <span>Compute</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Recent settlements -->
  <div class="settlements">
    <span class="settle-label">최근 정산</span>
    {#each recentSettlements as s}
      <div class="settle-row">
        <span class="settle-dot" style:background={TYPE_COLORS[s.type] ?? '#9a9590'}></span>
        <span class="settle-desc">{s.desc}</span>
        <span class="settle-amount" class:eligible={s.amount === 'eligible'}>{s.amount}{s.amount !== 'eligible' ? ' H' : ''}</span>
        <span class="settle-time">{s.time}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .my-activity {
    padding: 20px;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 16px;
    background: var(--surface, #fff);
    display: flex; flex-direction: column; gap: 14px;
    animation: fadeInUp 700ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .panel-title {
    font-size: 0.78rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0;
    display: flex; align-items: center; gap: 6px;
  }

  .role-cards {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  }
  .role-card {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 12px 8px; border-radius: 10px;
    background: rgba(0,0,0,0.015);
    border: 1px solid var(--border-subtle, #EDEAE5);
  }
  .rc-icon { font-size: 16px; }
  .rc-label { font-size: 0.62rem; font-weight: 600; color: var(--text-muted, #9a9590); text-transform: uppercase; letter-spacing: 0.04em; }
  .rc-value { font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; }
  .rc-sub { font-size: 0.6rem; color: var(--text-muted, #9a9590); }

  .total-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .total-label { font-size: 0.72rem; color: var(--text-secondary, #6b6560); }
  .total-value { font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: var(--green, #27864a); }

  .earnings-bar {
    display: flex; height: 8px; border-radius: 4px; overflow: hidden;
    background: var(--border-subtle, #EDEAE5);
  }
  .eb-seg { display: flex; align-items: center; justify-content: center; }
  .eb-seg span { font-size: 0; } /* hidden label for accessibility */
  .eb-seg.builder { background: var(--accent, #D97757); }
  .eb-seg.compute { background: var(--green, #27864a); }

  .settlements { display: flex; flex-direction: column; gap: 4px; }
  .settle-label { font-size: 0.66rem; font-weight: 600; color: var(--text-muted, #9a9590); text-transform: uppercase; letter-spacing: 0.04em; }
  .settle-row { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; padding: 4px 0; }
  .settle-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .settle-desc { flex: 1; color: var(--text-primary, #2D2D2D); }
  .settle-amount { font-family: var(--font-mono); font-weight: 600; color: var(--green, #27864a); }
  .settle-amount.eligible { color: #2980b9; font-weight: 500; }
  .settle-time { font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-muted, #9a9590); }

  @media (max-width: 600px) {
    .role-cards { grid-template-columns: 1fr; }
  }
</style>

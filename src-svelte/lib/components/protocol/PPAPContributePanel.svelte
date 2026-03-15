<script lang="ts">
  /**
   * PPAPContributePanel — Shows user's PPAP data contribution status.
   * Member only (wallet connected).
   */
  import { ppapStore } from '../../stores/ppapStore.ts';

  // ── Computed ──
  $: submissions = $ppapStore.submissions;
  $: batches = $ppapStore.batches;
  $: confirmed = $ppapStore.confirmedBatches;
  $: recentBatches = batches.slice(-5).reverse();

  // Pending batch with countdown
  $: pendingBatch = batches.find(b => b.status === 'challenged');
  $: pendingHoursLeft = pendingBatch
    ? Math.max(0, Math.round((pendingBatch.challengeDeadline - Date.now()) / 3600000))
    : 0;

  const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: 'Pending', color: '#d4a017', icon: '⏳' },
    challenged: { label: 'Challenge', color: '#c0392b', icon: '⚠' },
    confirmed: { label: 'Confirmed', color: 'var(--green, #27864a)', icon: '✓' },
    rejected: { label: 'Rejected', color: '#c0392b', icon: '✗' },
  };
</script>

<div class="ppap-contribute">
  <h3 class="panel-title">
    <span class="title-icon">📊</span>
    내 데이터 기여
  </h3>

  <!-- Status overview -->
  <div class="status-overview">
    <div class="so-item">
      <span class="so-val">{submissions}</span>
      <span class="so-label">제출</span>
    </div>
    <div class="so-sep"></div>
    <div class="so-item">
      <span class="so-val">{batches.length}</span>
      <span class="so-label">배치</span>
    </div>
    <div class="so-sep"></div>
    <div class="so-item">
      <span class="so-val" style:color="var(--green, #27864a)">{confirmed}</span>
      <span class="so-label">확인됨</span>
    </div>
  </div>

  <!-- Pending challenge warning -->
  {#if pendingBatch}
    <div class="challenge-alert">
      <span class="ca-icon">⚠</span>
      <div class="ca-body">
        <span class="ca-text">진행 중: 1 배치 (Challenge 창 {pendingHoursLeft}h 남음)</span>
        <span class="ca-sub">Batch #{pendingBatch.id} — 검증 대기 중</span>
      </div>
    </div>
  {/if}

  <!-- Hoot Browser deeplink -->
  <div class="browser-hint">
    <span class="bh-icon">🌐</span>
    <span class="bh-text">기여 현황은 Hoot Browser에서 관리됩니다</span>
  </div>

  <!-- Recent batches -->
  <div class="recent-batches">
    <span class="rb-label">최근 PPAP</span>
    {#each recentBatches as batch}
      {@const st = STATUS_MAP[batch.status] ?? STATUS_MAP.pending}
      <div class="rb-row">
        <span class="rb-icon" style:color={st.color}>{st.icon}</span>
        <span class="rb-id">Batch #{batch.id}</span>
        <span class="rb-status" style:color={st.color}>{st.label}</span>
        {#if batch.reward > 0}
          <span class="rb-reward">+{batch.reward}H</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .ppap-contribute {
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
  .title-icon { font-size: 14px; }

  /* Status overview */
  .status-overview {
    display: flex; align-items: center; gap: 0;
    padding: 10px;
    background: rgba(0,0,0,0.015);
    border-radius: 10px;
  }
  .so-item {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }
  .so-val {
    font-family: var(--font-mono); font-size: 1rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
  }
  .so-label {
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .so-sep {
    width: 1px; height: 24px;
    background: var(--border-subtle, #EDEAE5);
  }

  /* Challenge alert */
  .challenge-alert {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(192, 57, 43, 0.05);
    border: 1px solid rgba(192, 57, 43, 0.15);
  }
  .ca-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .ca-body { display: flex; flex-direction: column; gap: 2px; }
  .ca-text { font-size: 0.68rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .ca-sub { font-size: 0.58rem; color: var(--text-muted, #9a9590); }

  /* Browser hint */
  .browser-hint {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(0,0,0,0.02);
    border: 1px dashed var(--border-subtle, #EDEAE5);
  }
  .bh-icon { font-size: 13px; }
  .bh-text { font-size: 0.62rem; color: var(--text-muted, #9a9590); }

  /* Recent batches */
  .recent-batches { display: flex; flex-direction: column; gap: 4px; }
  .rb-label {
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .rb-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.72rem; padding: 4px 0;
  }
  .rb-icon { font-size: 12px; flex-shrink: 0; }
  .rb-id { font-family: var(--font-mono); color: var(--text-primary, #2D2D2D); flex: 1; }
  .rb-status { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; }
  .rb-reward { font-family: var(--font-mono); font-weight: 600; color: var(--green, #27864a); }
</style>

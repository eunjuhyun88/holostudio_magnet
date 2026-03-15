<script lang="ts">
  /**
   * ChallengePanel — Verifier's challenge monitoring and voting view.
   * Shows assigned arbitrations and voting history.
   */
  import { createEventDispatcher } from 'svelte';
  import { wallet } from '../../stores/walletStore.ts';
  import { nodeStore } from '../../stores/nodeStore.ts';

  const dispatch = createEventDispatcher<{
    openModal: {
      title: string;
      contract: string;
      fn: string;
      params: Array<{ name: string; type: string; value: string }>;
      fee: string;
      gas: string;
      note: string;
      accentColor?: string;
    };
  }>();

  // ── Demo data ──
  $: trustScore = $nodeStore.trustScore;
  $: isNotary = $wallet.connected && trustScore >= 300;

  interface ChallengeItem {
    batchId: number;
    submitter: string;
    hoursLeft: number;
    status: 'pending' | 'voted';
  }

  interface HistoryItem {
    batchId: number;
    outcome: 'valid' | 'invalid';
    reward: number;
    time: string;
  }

  const assignedChallenges: ChallengeItem[] = [
    { batchId: 2889, submitter: '0x4a2...8f3c', hoursLeft: 12, status: 'pending' },
  ];

  const challengeHistory: HistoryItem[] = [
    { batchId: 2887, outcome: 'valid', reward: 50, time: '3d ago' },
    { batchId: 2885, outcome: 'valid', reward: 50, time: '5d ago' },
    { batchId: 2881, outcome: 'invalid', reward: 25, time: '1w ago' },
  ];

  function handleVote(batchId: number) {
    dispatch('openModal', {
      title: 'PPAPDispute.submitVote()',
      contract: '0x7a3d...Dispute',
      fn: 'submitVote',
      params: [
        { name: 'batchId', type: 'uint256', value: String(batchId) },
        { name: 'voteValid', type: 'bool', value: 'true' },
        { name: 'evidence', type: 'bytes32', value: '0x' + Math.random().toString(16).slice(2, 10) + '...' },
      ],
      fee: '---',
      gas: '~42,000',
      note: `Submit verification vote for PPAP Batch #${batchId}`,
      accentColor: '#2980b9',
    });
  }
</script>

<div class="challenge-panel">
  <h3 class="panel-title">
    <span class="title-icon">🛡</span>
    검증 활동
  </h3>

  {#if !isNotary}
    <!-- Not a notary yet -->
    <div class="notary-gate">
      <span class="ng-text">Notary 자격: Trust Score 300+ 필요</span>
      <span class="ng-current">현재: {trustScore}/1000</span>
    </div>
  {:else}
    <!-- Notary status -->
    <div class="notary-status">
      <div class="ns-item">
        <span class="ns-badge active">Active</span>
        <span class="ns-text">Notary (5-of-50 Pool)</span>
      </div>
      <div class="ns-stats">
        <span class="ns-stat">예치금: <strong>1,000 HOOT</strong></span>
        <span class="ns-stat">Trust: <strong>{trustScore}</strong></span>
      </div>
    </div>

    <!-- Assigned arbitrations -->
    {#if assignedChallenges.length > 0}
      <div class="assigned-section">
        <span class="as-label">배정된 중재</span>
        {#each assignedChallenges as ch}
          <div class="challenge-card">
            <div class="cc-header">
              <span class="cc-icon">⚠</span>
              <span class="cc-title">Batch #{ch.batchId} — Challenge 접수</span>
            </div>
            <div class="cc-meta">
              <span>제출자: {ch.submitter}</span>
              <span>시간: {ch.hoursLeft}h left</span>
            </div>
            <button class="vote-btn" on:click={() => handleVote(ch.batchId)}>
              검토 & 투표 →
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Challenge history -->
    <div class="history-section">
      <span class="hs-label">이력</span>
      {#each challengeHistory as h}
        <div class="history-row">
          <span class="hr-icon" class:valid={h.outcome === 'valid'} class:invalid={h.outcome === 'invalid'}>
            {h.outcome === 'valid' ? '✓' : '✗'}
          </span>
          <span class="hr-id">#{h.batchId}</span>
          <span class="hr-outcome">{h.outcome === 'valid' ? 'Valid' : 'Invalid'}</span>
          <span class="hr-reward">+{h.reward}H</span>
          <span class="hr-time">{h.time}</span>
        </div>
      {/each}
    </div>

    <div class="browser-hint">
      <span class="bh-text">상세 작업은 Hoot Browser에서 진행</span>
    </div>
  {/if}
</div>

<style>
  .challenge-panel {
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

  /* Notary gate */
  .notary-gate {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px;
    border-radius: 10px;
    background: rgba(0,0,0,0.02);
    border: 1px dashed var(--border-subtle, #EDEAE5);
    text-align: center;
  }
  .ng-text { font-size: 0.68rem; color: var(--text-secondary, #6b6560); }
  .ng-current { font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-muted, #9a9590); }

  /* Notary status */
  .notary-status {
    display: flex; flex-direction: column; gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(39, 134, 74, 0.04);
    border: 1px solid rgba(39, 134, 74, 0.15);
  }
  .ns-item { display: flex; align-items: center; gap: 6px; }
  .ns-badge {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 700;
    padding: 1px 6px; border-radius: 4px; letter-spacing: 0.06em;
  }
  .ns-badge.active { background: rgba(39, 134, 74, 0.15); color: var(--green, #27864a); }
  .ns-text { font-size: 0.68rem; color: var(--text-primary, #2D2D2D); font-weight: 500; }
  .ns-stats { display: flex; gap: 12px; }
  .ns-stat { font-size: 0.62rem; color: var(--text-muted, #9a9590); }
  .ns-stat strong {
    font-family: var(--font-mono); color: var(--text-primary, #2D2D2D);
  }

  /* Assigned challenges */
  .assigned-section { display: flex; flex-direction: column; gap: 6px; }
  .as-label {
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .challenge-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(192, 57, 43, 0.15);
    background: rgba(192, 57, 43, 0.03);
  }
  .cc-header { display: flex; align-items: center; gap: 6px; }
  .cc-icon { font-size: 13px; }
  .cc-title { font-size: 0.72rem; font-weight: 600; color: var(--text-primary, #2D2D2D); }
  .cc-meta { display: flex; gap: 12px; font-size: 0.6rem; color: var(--text-muted, #9a9590); }
  .vote-btn {
    appearance: none; border: none;
    background: #2980b9; color: #fff;
    padding: 6px 14px; border-radius: 6px;
    font-size: 0.68rem; font-weight: 600;
    cursor: pointer; transition: all 150ms;
    align-self: flex-start;
  }
  .vote-btn:hover { background: #1f6da1; box-shadow: 0 2px 8px rgba(41, 128, 185, 0.2); }

  /* History */
  .history-section { display: flex; flex-direction: column; gap: 4px; }
  .hs-label {
    font-size: 0.66rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .history-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.72rem; padding: 4px 0;
  }
  .hr-icon {
    width: 16px; height: 16px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; flex-shrink: 0;
  }
  .hr-icon.valid { background: rgba(39, 134, 74, 0.1); color: var(--green, #27864a); }
  .hr-icon.invalid { background: rgba(192, 57, 43, 0.1); color: #c0392b; }
  .hr-id { font-family: var(--font-mono); color: var(--text-primary, #2D2D2D); }
  .hr-outcome { font-size: 0.62rem; color: var(--text-secondary, #6b6560); flex: 1; }
  .hr-reward { font-family: var(--font-mono); font-weight: 600; color: var(--green, #27864a); }
  .hr-time { font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-muted, #9a9590); }

  /* Browser hint */
  .browser-hint {
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(0,0,0,0.02);
    border: 1px dashed var(--border-subtle, #EDEAE5);
    text-align: center;
  }
  .bh-text { font-size: 0.58rem; color: var(--text-muted, #9a9590); }
</style>

<script lang="ts">
  /**
   * NotaryPanel — PPAP batch signing, challenge, and arbitration.
   *
   * Spec: PlatformUX §5 Notary
   *
   * Events:
   *   openModal: ContractCall — parent handles ContractCallModal
   */
  import { createEventDispatcher } from 'svelte';
  import type { ContractCall } from '../../data/protocolData.ts';

  const dispatch = createEventDispatcher<{
    openModal: ContractCall;
  }>();

  // ── Demo PPAP batches ──
  interface PpapBatch {
    id: string;
    status: 'PENDING' | 'ACKNOWLEDGED' | 'DISPUTED' | 'CONFIRMED';
    domain: string;
    records: number;
    deadline: string;
    reward: number;
  }

  let batches: PpapBatch[] = [
    { id: 'PPAP-0041', status: 'PENDING', domain: 'eth-price-feed', records: 128, deadline: '11:42:18', reward: 0.9 },
    { id: 'PPAP-0040', status: 'ACKNOWLEDGED', domain: 'spam-labels-v3', records: 256, deadline: '—', reward: 0.9 },
    { id: 'PPAP-0039', status: 'CONFIRMED', domain: 'market-sentiment', records: 64, deadline: '—', reward: 0.9 },
    { id: 'PPAP-0038', status: 'DISPUTED', domain: 'whale-tracker', records: 512, deadline: '—', reward: 0.0 },
  ];

  // ── Challenge state ──
  let showChallengeInput = false;
  let challengeBatchId = '';
  let challengeReason = '';

  // ── Arbitration state ──
  interface Arbitration {
    disputeId: string;
    batchId: string;
    domain: string;
    status: 'PENDING_VOTE' | 'RESOLVED';
  }

  let arbitrations: Arbitration[] = [
    { disputeId: 'ARB-012', batchId: 'PPAP-0038', domain: 'whale-tracker', status: 'PENDING_VOTE' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    PENDING: '#D97757',
    ACKNOWLEDGED: '#27864a',
    CONFIRMED: '#2980b9',
    DISPUTED: '#c0392b',
  };

  // ── Actions ──
  function handleBatchSign(batch: PpapBatch) {
    dispatch('openModal', {
      title: 'Batch Signing',
      contract: '0x9C4d...3B7e  HootPPAP.sol',
      fn: 'acknowledgeBatch',
      params: [
        { name: 'batchId', type: 'string', value: batch.id },
      ],
      fee: `0 HOOT (on completion: +${batch.reward} HOOT)`,
      gas: '~72,000',
      note: `Sign ${batch.records} data records for ${batch.domain} domain.`,
      accentColor: 'var(--green)',
    });
  }

  function openChallenge(batchId: string) {
    challengeBatchId = batchId;
    challengeReason = '';
    showChallengeInput = true;
  }

  function submitChallenge() {
    if (!challengeReason.trim()) return;
    showChallengeInput = false;
    dispatch('openModal', {
      title: 'Submit Challenge',
      contract: '0x9C4d...3B7e  HootPPAP.sol',
      fn: 'disputePPAP',
      params: [
        { name: 'batchId', type: 'string', value: challengeBatchId },
        { name: 'reason', type: 'string', value: challengeReason.trim() },
      ],
      fee: '1,000 HOOT (deposit locked)',
      gas: '~120,000',
      note: 'Deposit + 50 HOOT returned if challenge succeeds.',
      accentColor: '#c0392b',
    });
    challengeReason = '';
    challengeBatchId = '';
  }

  function handleArbitrationVote(arb: Arbitration, vote: 'valid' | 'invalid') {
    dispatch('openModal', {
      title: 'Arbitration Response',
      contract: '0x9C4d...3B7e  HootPPAP.sol',
      fn: 'resolveArbitration',
      params: [
        { name: 'disputeId', type: 'string', value: arb.disputeId },
        { name: 'vote', type: 'bool', value: vote === 'valid' ? 'true (valid)' : 'false (invalid)' },
      ],
      fee: '0 HOOT',
      gas: '~90,000',
      note: `Judge data validity for batch ${arb.batchId} (${arb.domain}).`,
      accentColor: vote === 'valid' ? 'var(--green)' : '#c0392b',
    });
  }
</script>

<div class="notary-panel">
  <!-- ═══ PPAP Stream Table ═══ -->
  <h4 class="np-label">PPAP Batch Stream</h4>
  <div class="batch-table">
    {#each batches as batch (batch.id)}
      <div class="batch-row" class:pending={batch.status === 'PENDING'}>
        <span class="br-id">{batch.id}</span>
        <span class="br-status" style:color={STATUS_COLORS[batch.status]}
              style:background="color-mix(in srgb, {STATUS_COLORS[batch.status]} 8%, transparent)">
          {batch.status}
        </span>
        <div class="br-body">
          <span class="br-domain">{batch.domain}</span>
          <span class="br-records">{batch.records} records</span>
        </div>
        {#if batch.status === 'PENDING'}
          <div class="br-actions">
            <span class="br-deadline">⏱ {batch.deadline}</span>
            <button class="br-sign-btn" on:click={() => handleBatchSign(batch)}>
              Sign Batch
            </button>
          </div>
        {:else if batch.status === 'ACKNOWLEDGED'}
          <button class="br-challenge-btn" on:click={() => openChallenge(batch.id)}>
            Challenge
          </button>
        {:else}
          <span class="br-reward">
            {batch.reward > 0 ? `+${batch.reward} HOOT` : '—'}
          </span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- ═══ Challenge Input Modal ═══ -->
  {#if showChallengeInput}
    <div class="challenge-input">
      <h4 class="np-label">Enter Challenge Reason</h4>
      <p class="ci-batch">Target: {challengeBatchId}</p>
      <textarea class="ci-textarea" bind:value={challengeReason}
        placeholder="Enter data integrity violation reason..."
        rows="3"
      ></textarea>
      <div class="ci-actions">
        <button class="ci-cancel" on:click={() => { showChallengeInput = false; }}>Cancel</button>
        <button class="ci-submit" on:click={submitChallenge} disabled={!challengeReason.trim()}>
          Submit Challenge (1,000 HOOT deposit)
        </button>
      </div>
    </div>
  {/if}

  <!-- ═══ Arbitration Panel ═══ -->
  {#if arbitrations.length > 0}
    <h4 class="np-label" style="margin-top: 16px;">Arbitration Requests</h4>
    <div class="arb-list">
      {#each arbitrations as arb (arb.disputeId)}
        <div class="arb-row">
          <div class="arb-info">
            <span class="arb-id">{arb.disputeId}</span>
            <span class="arb-batch">{arb.batchId} · {arb.domain}</span>
          </div>
          {#if arb.status === 'PENDING_VOTE'}
            <div class="arb-actions">
              <button class="arb-btn arb-valid" on:click={() => handleArbitrationVote(arb, 'valid')}>
                Valid
              </button>
              <button class="arb-btn arb-invalid" on:click={() => handleArbitrationVote(arb, 'invalid')}>
                Invalid
              </button>
            </div>
          {:else}
            <span class="arb-resolved">Resolved</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notary-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .np-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
    margin: 0;
  }

  /* ═══ BATCH TABLE ═══ */
  .batch-table {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .batch-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 10px;
    background: var(--surface, #fff);
    flex-wrap: wrap;
  }
  .batch-row.pending {
    border-color: rgba(217,119,87,0.2);
    background: rgba(217,119,87,0.02);
  }

  .br-id {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    flex-shrink: 0;
  }

  .br-status {
    font-family: var(--font-mono, monospace);
    font-size: 0.52rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .br-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .br-domain {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .br-records {
    font-family: var(--font-mono, monospace);
    font-size: 0.58rem;
    color: var(--text-muted, #9a9590);
  }

  .br-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .br-deadline {
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--accent, #D97757);
  }

  .br-sign-btn {
    appearance: none;
    border: 1.5px solid var(--green, #27864a);
    background: rgba(39,134,74,0.04);
    color: var(--green, #27864a);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
  }
  .br-sign-btn:hover {
    background: var(--green, #27864a);
    color: #fff;
  }

  .br-challenge-btn {
    appearance: none;
    border: 1px solid #c0392b;
    background: transparent;
    color: #c0392b;
    font-size: 0.62rem;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms;
    flex-shrink: 0;
  }
  .br-challenge-btn:hover {
    background: rgba(192,57,43,0.06);
  }

  .br-reward {
    font-family: var(--font-mono, monospace);
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    flex-shrink: 0;
  }

  /* ═══ CHALLENGE INPUT ═══ */
  .challenge-input {
    padding: 14px;
    border: 1px solid rgba(192,57,43,0.2);
    border-radius: 12px;
    background: rgba(192,57,43,0.02);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ci-batch {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    color: var(--text-secondary, #6b6560);
    margin: 0;
  }

  .ci-textarea {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text-primary, #2D2D2D);
    background: var(--surface, #fff);
    resize: vertical;
    outline: none;
  }
  .ci-textarea:focus {
    border-color: #c0392b;
  }

  .ci-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .ci-cancel {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
  }
  .ci-cancel:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .ci-submit {
    appearance: none;
    border: none;
    background: #c0392b;
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
  }
  .ci-submit:hover:not(:disabled) {
    background: #a93226;
  }
  .ci-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ═══ ARBITRATION ═══ */
  .arb-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .arb-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid rgba(217,119,87,0.15);
    border-radius: 10px;
    background: rgba(217,119,87,0.02);
  }

  .arb-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .arb-id {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .arb-batch {
    font-size: 0.62rem;
    color: var(--text-muted, #9a9590);
  }

  .arb-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .arb-btn {
    appearance: none;
    font-size: 0.66rem;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms;
  }
  .arb-valid {
    border: 1px solid var(--green, #27864a);
    background: transparent;
    color: var(--green, #27864a);
  }
  .arb-valid:hover {
    background: var(--green, #27864a);
    color: #fff;
  }
  .arb-invalid {
    border: 1px solid #c0392b;
    background: transparent;
    color: #c0392b;
  }
  .arb-invalid:hover {
    background: #c0392b;
    color: #fff;
  }

  .arb-resolved {
    font-size: 0.66rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    font-style: italic;
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { BOND_TIERS, ACTIVE_BONDS, type ContractCall } from '../data/protocolData.ts';
  import { fmtK } from '../utils/format.ts';

  export let simulatedBalance: number;

  const dispatch = createEventDispatcher<{ openModal: ContractCall }>();

  type TierKey = 0 | 1 | 2;
  let selectedBondTier: TierKey = 1;

  const bondTiers = BOND_TIERS;
  const activeBondsList = ACTIVE_BONDS;

  let bondInputValue = '2000';

  $: currentBondTier = bondTiers[selectedBondTier];
  $: {
    bondInputValue = String(currentBondTier.bondNum);
  }

  let bondSliderValue = 2000;
  $: bondSliderValue = Number(bondInputValue) || 0;

  let bondApproved = false;

  function handleBondSlider(e: Event) {
    const target = e.target as HTMLInputElement;
    bondInputValue = target.value;
  }

  function openBondApproveModal() {
    dispatch('openModal', {
      title: 'Approve HOOT',
      contract: '0x8B2c...1A9f  HootToken.sol',
      fn: 'approve',
      params: [
        { name: 'spender', type: 'address', value: '0x4F0a...7E3d (HootStaking)' },
        { name: 'amount', type: 'uint256', value: `${bondInputValue} × 10¹⁸` },
      ],
      fee: '0 HOOT',
      gas: '~46,000',
      note: `Approve staking contract to spend ${fmtK(Number(bondInputValue))} HOOT on your behalf.`,
      accentColor: 'var(--accent)',
      requiresApproval: true,
    });
  }

  function openBondNodeModal() {
    dispatch('openModal', {
      title: `Bond ${currentBondTier.name} Node`,
      contract: '0x4F0a...7E3d  HootStaking.sol',
      fn: 'registerNode',
      params: [
        { name: 'tier', type: 'uint8', value: `${currentBondTier.tier}` },
        { name: 'amount', type: 'uint256', value: `${bondInputValue} × 10¹⁸` },
        { name: 'nodeId', type: 'bytes32', value: '0x0000...0000 (auto)' },
      ],
      fee: `${bondInputValue} HOOT`,
      gas: '~142,000',
      note: `Locks ${fmtK(Number(bondInputValue))} HOOT as bond. Unlocks ${currentBondTier.gpu}, ${currentBondTier.jobs} jobs. 7-day unbonding.`,
      accentColor: currentBondTier.accent,
    });
  }

  const inputIds = {
    bondAmount: 'bond-amount-input',
  };
</script>

<div class="panel" style="--panel-delay: 0">
  <div class="panel-header">
    <h2>Node Bond</h2>
    <span class="panel-badge">Staking</span>
  </div>

  <div class="tier-tabs">
    {#each bondTiers as tier, i}
      <button
        class="tier-tab"
        class:active={selectedBondTier === i}
        style="--tab-accent: {tier.accent}"
        on:click={() => { selectedBondTier = i as TierKey; bondApproved = false; }}
      >
        {tier.name}
      </button>
    {/each}
  </div>

  <div class="tier-specs">
    <div class="spec"><span class="spec-label">Bond</span><span class="spec-value">{currentBondTier.bond} HOOT</span></div>
    <div class="spec"><span class="spec-label">GPUs</span><span class="spec-value">{currentBondTier.gpu}</span></div>
    <div class="spec"><span class="spec-label">Jobs</span><span class="spec-value">{currentBondTier.jobs}</span></div>
  </div>

  <div class="input-group">
    <label class="input-label" for={inputIds.bondAmount}>Amount to bond</label>
    <div class="input-row">
      <input
        id={inputIds.bondAmount}
        type="text"
        bind:value={bondInputValue}
        class="mono-input"
        placeholder="0"
      />
      <span class="input-suffix">HOOT</span>
    </div>
    <div class="balance-row">
      <span class="balance-label">Balance: <strong>{simulatedBalance.toLocaleString()}</strong> HOOT</span>
    </div>
    <input
      type="range"
      min={currentBondTier.bondNum}
      max={simulatedBalance}
      value={bondSliderValue}
      on:input={handleBondSlider}
      class="amount-slider"
    />
  </div>

  <div class="bond-actions">
    {#if !bondApproved}
      <button class="action-btn secondary" on:click={() => { bondApproved = true; openBondApproveModal(); }}>
        Step 1: Approve HOOT
      </button>
    {:else}
      <button class="action-btn primary" on:click={openBondNodeModal}>
        Bond Node
      </button>
    {/if}
  </div>

  <!-- Your Bonds -->
  <div class="sub-section">
    <h3 class="sub-header">Your Bonds</h3>
    {#each activeBondsList as b}
      <div class="bond-row">
        <div class="bond-info">
          <span class="bond-node">{b.nodeId}</span>
          <span class="bond-tier-badge" style="--badge-color: {b.tier === 'Enterprise' ? 'var(--gold)' : b.tier === 'Standard' ? 'var(--accent)' : 'var(--blue)'}">{b.tier}</span>
        </div>
        <div class="bond-amount-col">
          <span class="bond-amount">{b.amount} HOOT</span>
          {#if b.status === 'unbonding'}
            <span class="bond-unbonding">{b.unbondingDays}d remaining</span>
          {:else}
            <span class="bond-active-status">Active</span>
          {/if}
        </div>
      </div>
    {/each}
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

  /* Tier tabs */
  .tier-tabs {
    display: flex;
    gap: 4px;
    background: var(--page-bg);
    border-radius: var(--radius-md);
    padding: 3px;
    margin-bottom: 16px;
  }

  .tier-tab {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: calc(var(--radius-md) - 2px);
    font-family: var(--font-body);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 200ms;
  }
  .tier-tab.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  .tier-tab:hover:not(.active) { color: var(--text-primary); }

  /* Tier specs */
  .tier-specs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .spec {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
  }
  .spec-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
  }
  .spec-value {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  /* Inputs */
  .input-group { margin-bottom: 16px; }

  .input-label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .input-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .mono-input {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--border);
    padding: 8px 0;
    width: 100%;
    color: var(--text-primary);
    transition: border-color 200ms;
    outline: none;
  }
  .mono-input:focus { border-color: var(--accent); }
  .mono-input::placeholder { color: var(--text-muted); opacity: 0.5; }

  .input-suffix {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .balance-row {
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .balance-row strong {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .amount-slider {
    width: 100%;
    margin-top: 8px;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    outline: none;
  }
  .amount-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--surface);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    transition: transform 150ms;
  }
  .amount-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

  /* Action buttons */
  .bond-actions { margin-top: 16px; }

  .action-btn {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.9rem;
    padding: 14px 24px;
    border-radius: var(--radius-md, 10px);
    width: 100%;
    border: none;
    cursor: pointer;
    transition: all 200ms;
    position: relative;
    overflow: hidden;
  }
  .action-btn.primary {
    background: var(--accent, #D97757);
    color: #fff;
  }
  .action-btn.primary:hover:not(:disabled) {
    background: var(--accent-hover, #C4644A);
    box-shadow: 0 4px 16px rgba(217,119,87,0.3);
    transform: translateY(-1px);
  }
  .action-btn.secondary {
    background: var(--page-bg, #FAF9F7);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .action-btn.secondary:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
  .action-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

  /* Sub sections */
  .sub-section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
  }
  .sub-header {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 12px 0;
  }

  /* Bond rows */
  .bond-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--page-bg);
    margin-bottom: 6px;
    transition: background 150ms;
  }
  .bond-row:hover { background: var(--accent-subtle); }

  .bond-info { display: flex; align-items: center; gap: 8px; }

  .bond-node {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .bond-tier-badge {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--badge-color) 12%, transparent);
    color: var(--badge-color);
  }

  .bond-amount-col { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }

  .bond-amount {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .bond-unbonding {
    font-size: 0.65rem;
    color: var(--gold);
    font-weight: 600;
  }

  .bond-active-status {
    font-size: 0.65rem;
    color: var(--green);
    font-weight: 600;
  }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .mono-input { font-size: 1.1rem; }
    .tier-specs { grid-template-columns: 1fr; }
  }
</style>

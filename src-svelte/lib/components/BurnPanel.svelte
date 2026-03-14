<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { BURN_CONVERSIONS, type ContractCall } from '../data/protocolData.ts';
  import { fmtK } from '../utils/format.ts';

  export let simulatedBalance: number;

  const dispatch = createEventDispatcher<{ openModal: ContractCall }>();

  let burnAmount = '';
  let burnMax = false;

  const conversions = BURN_CONVERSIONS;

  const inputIds = {
    burnAmount: 'burn-amount-input',
  };

  function setBurnMax() {
    burnAmount = String(simulatedBalance);
    burnMax = true;
  }

  $: burnAmountNum = Number(burnAmount) || 0;
  $: burnCreditValue = burnAmountNum * 0.05 * (burnAmountNum >= 10000 ? 1.20 : burnAmountNum >= 2500 ? 1.12 : 1.0);
  $: burnTierName = burnAmountNum >= 10000 ? 'Ultra' : burnAmountNum >= 2500 ? 'Pro' : 'Basic';
  $: burnRate = burnAmountNum >= 10000 ? '6¢' : burnAmountNum >= 2500 ? '5.6¢' : '5¢';
  $: burnBonus = burnAmountNum >= 10000 ? '+20%' : burnAmountNum >= 2500 ? '+12%' : '';

  function openBurnModal() {
    dispatch('openModal', {
      title: `Burn → ${burnTierName} Credit`,
      contract: '0x8B2c...1A9f  HootBurnCredit.sol',
      fn: 'burnToCredit',
      params: [
        { name: 'amount', type: 'uint256', value: `${burnAmount} × 10¹⁸` },
        { name: 'tier', type: 'uint8', value: burnTierName === 'Basic' ? '1' : burnTierName === 'Pro' ? '2' : '3' },
      ],
      fee: `${fmtK(burnAmountNum)} HOOT (burned)`,
      gas: '~98,000',
      note: `Burns ${fmtK(burnAmountNum)} HOOT permanently. Receives $${burnCreditValue.toFixed(2)} in compute credits at ${burnRate}/HOOT.${burnBonus ? ' Includes ' + burnBonus + ' bonus.' : ''}`,
      accentColor: 'var(--red)',
    });
  }
</script>

<div class="panel" style="--panel-delay: 1">
  <div class="panel-header">
    <h2>Burn to Credit</h2>
    <span class="panel-badge burn">Deflationary</span>
  </div>

  <div class="burn-converter">
    <div class="burn-left">
      <label class="input-label" for={inputIds.burnAmount}>HOOT to burn</label>
      <div class="input-row">
        <input
          id={inputIds.burnAmount}
          type="text"
          bind:value={burnAmount}
          class="mono-input large"
          placeholder="0"
        />
        <button class="max-btn" on:click={setBurnMax}>MAX</button>
      </div>
    </div>
    <div class="burn-arrow">→</div>
    <div class="burn-right">
      <span class="input-label">Credit received</span>
      <div class="credit-display">
        <span class="credit-value">${burnCreditValue.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="burn-meta">
    <div class="burn-meta-item">
      <span class="burn-meta-label">Tier</span>
      <span class="burn-meta-value" class:tier-basic={burnTierName === 'Basic'} class:tier-pro={burnTierName === 'Pro'} class:tier-ultra={burnTierName === 'Ultra'}>{burnTierName}</span>
    </div>
    <div class="burn-meta-item">
      <span class="burn-meta-label">Rate</span>
      <span class="burn-meta-value">{burnRate}/HOOT</span>
    </div>
    {#if burnBonus}
      <div class="burn-meta-item">
        <span class="burn-meta-label">Bonus</span>
        <span class="burn-meta-value bonus">{burnBonus}</span>
      </div>
    {/if}
  </div>

  <button
    class="action-btn burn"
    disabled={burnAmountNum <= 0}
    on:click={openBurnModal}
  >
    Burn HOOT
  </button>

  <div class="sub-section">
    <h3 class="sub-header">Conversion History</h3>
    {#each conversions as c}
      <div class="conversion-row">
        <span class="conv-amount">{c.amount} HOOT</span>
        <span class="conv-arrow">→</span>
        <span class="conv-credit">{c.credit}</span>
        <span class="conv-tier-badge">{c.tier}</span>
        <span class="conv-time">{c.time}</span>
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
  .panel-badge.burn { background: rgba(192,57,43,0.1); color: var(--red); }

  /* Burn converter */
  .burn-converter {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 16px;
  }
  .burn-left { flex: 1; }
  .burn-right { flex: 1; }

  .burn-arrow {
    font-size: 1.4rem;
    color: var(--text-muted);
    padding-bottom: 12px;
    flex-shrink: 0;
  }

  .credit-display {
    padding: 8px 0;
    border-bottom: 2px solid var(--green);
  }

  .credit-value {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--green);
  }

  .burn-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }

  .burn-meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .burn-meta-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
  }

  .burn-meta-value {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .burn-meta-value.tier-basic { color: var(--blue); }
  .burn-meta-value.tier-pro { color: var(--accent); }
  .burn-meta-value.tier-ultra { color: var(--gold); }
  .burn-meta-value.bonus { color: var(--green); }

  /* Inputs */
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
  .mono-input.large { font-size: 1.6rem; }
  .mono-input::placeholder { color: var(--text-muted); opacity: 0.5; }

  .max-btn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--page-bg);
    color: var(--accent);
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
  }
  .max-btn:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* Action button */
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
  .action-btn.burn {
    background: var(--red, #c0392b);
    color: #fff;
  }
  .action-btn.burn:hover:not(:disabled) {
    background: #a93226;
    box-shadow: 0 4px 16px rgba(192,57,43,0.3);
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

  /* Conversion history */
  .conversion-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--border-subtle);
  }
  .conversion-row:last-child { border-bottom: none; }

  .conv-amount {
    font-family: var(--font-mono);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .conv-arrow { color: var(--text-muted); font-size: 0.7rem; }
  .conv-credit {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--green);
  }
  .conv-tier-badge {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: var(--accent-subtle);
    color: var(--accent);
  }
  .conv-time {
    margin-left: auto;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .panel { padding: 16px; }
    h2 { font-size: 1.1rem; }
    .mono-input { font-size: 1.1rem; }
    .mono-input.large { font-size: 1.3rem; }
    .burn-converter { flex-direction: column; }
    .burn-arrow { transform: rotate(90deg); text-align: center; }
  }
</style>

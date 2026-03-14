<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from './walletStore.ts';

  let visible = false;

  // ── Wallet (from shared store) ──
  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;
  let walletDropdown = false;
  const wallets = [
    { name: 'Phantom', icon: '👻' },
    { name: 'Solflare', icon: '☀️' },
    { name: 'Backpack', icon: '🎒' },
  ];

  function connectWallet(name: string) {
    wallet.connect(name);
    walletDropdown = false;
  }

  function disconnectWallet() {
    wallet.disconnect();
    walletDropdown = false;
  }

  // ── Animated counter ──
  function animateValue(from: number, to: number, duration: number, cb: (v: number) => void) {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      cb(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Protocol Metrics (animated) ──
  let tvl = 0;
  let burned = 0;
  let treasury = 0;
  let activeBonds = 0;
  let mau = 0;
  const mauTarget = 1443;

  onMount(() => {
    visible = true;
    setTimeout(() => {
      animateValue(0, 12_400_000, 1800, v => tvl = v);
      animateValue(0, 847_000, 1600, v => burned = v);
      animateValue(0, 3_200_000, 1700, v => treasury = v);
      animateValue(0, 2341, 1400, v => activeBonds = v);
      animateValue(0, 892, 1500, v => mau = v);
    }, 300);

    // Trust score animation
    setTimeout(() => {
      animateValue(0, trustScoreTarget, 2000, v => trustScore = v);
    }, 600);

    // PPAP pipeline animation
    ppapInterval = setInterval(() => {
      ppapActiveStage = (ppapActiveStage + 1) % 4;
    }, 2200);

    return () => {
      if (ppapInterval) clearInterval(ppapInterval);
    };
  });

  function fmtDollar(n: number): string {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }

  function fmtK(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return Math.round(n).toLocaleString();
  }

  function fmtInt(n: number): string {
    return Math.round(n).toLocaleString();
  }

  // ── Bond Panel ──
  type TierKey = 0 | 1 | 2;
  let selectedBondTier: TierKey = 1;

  const bondTiers = [
    { name: 'Lite', tier: 1, bondNum: 500, bond: '500', gpu: '1 GPU', jobs: '5 concurrent', accent: 'var(--blue)' },
    { name: 'Standard', tier: 2, bondNum: 2000, bond: '2,000', gpu: '4 GPUs', jobs: '20 concurrent', accent: 'var(--accent)' },
    { name: 'Enterprise', tier: 3, bondNum: 10000, bond: '10,000', gpu: 'Unlimited', jobs: 'Unlimited', accent: 'var(--gold)' },
  ] as const;

  let bondInputValue = '2000';
  const simulatedBalance = 12_450;

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

  // ── Simulated active bonds ──
  const activeBondsList = [
    { nodeId: 'seoul-4090', tier: 'Standard', amount: '2,000', status: 'active', unbondingDays: null as number | null },
    { nodeId: 'berlin-a100', tier: 'Enterprise', amount: '10,000', status: 'unbonding', unbondingDays: 4 },
  ];

  // ── Burn Panel ──
  let burnAmount = '';
  let burnMax = false;

  const inputIds = {
    bondAmount: 'bond-amount-input',
    burnAmount: 'burn-amount-input',
    jobBudget: 'job-budget-input',
    jobExpId: 'job-exp-id-input',
    jobWorkers: 'job-workers-select',
    jobMetric: 'job-metric-select',
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

  // Conversion history (simulated)
  const conversions = [
    { amount: '2,500', credit: '$140.00', tier: 'Pro', time: '2h ago' },
    { amount: '500', credit: '$25.00', tier: 'Basic', time: '1d ago' },
    { amount: '10,000', credit: '$600.00', tier: 'Ultra', time: '3d ago' },
  ];

  // ── Job Creator Panel ──
  let jobBudget = '';
  let jobExpId = 'exp-' + Math.floor(Math.random() * 9000 + 1000);
  let jobWorkers = '4';
  let jobMetric = 'bpb';

  $: jobBudgetNum = Number(jobBudget) || 0;
  $: jobGpuCost = (jobBudgetNum * 0.95).toFixed(1);
  $: jobTreasuryCost = (jobBudgetNum * 0.05).toFixed(1);

  // ── Contract Call Modal ──
  interface ContractCall {
    title: string;
    contract: string;
    fn: string;
    params: { name: string; type: string; value: string }[];
    fee: string;
    gas: string;
    note: string;
    accentColor: string;
    requiresApproval?: boolean;
  }

  let modalOpen = false;
  let modalCall: ContractCall | null = null;
  let modalStep: 'review' | 'pending' | 'confirmed' = 'review';

  function openContractModal(call: ContractCall) {
    modalCall = call;
    modalStep = 'review';
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    modalCall = null;
    modalStep = 'review';
  }

  function confirmTx() {
    modalStep = 'pending';
    setTimeout(() => {
      modalStep = 'confirmed';
    }, 2200);
  }

  // ── Pre-built modal openers ──
  function openBondApproveModal() {
    openContractModal({
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
    openContractModal({
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

  function openBurnModal() {
    openContractModal({
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

  function openJobModal() {
    openContractModal({
      title: 'Create Research Job',
      contract: '0x5E8c...2B7f  ResearchJobManager.sol',
      fn: 'createJob',
      params: [
        { name: 'experimentId', type: 'bytes32', value: jobExpId },
        { name: 'budget', type: 'uint256', value: `${jobBudget} × 10¹⁸` },
        { name: 'maxWorkers', type: 'uint8', value: jobWorkers },
        { name: 'metric', type: 'string', value: jobMetric },
      ],
      fee: `${jobBudget} HOOT`,
      gas: '~245,000',
      note: `Escrows ${fmtK(jobBudgetNum)} HOOT. GPU payout: ${jobGpuCost} HOOT (95%). Treasury: ${jobTreasuryCost} HOOT (5%).`,
      accentColor: 'var(--green)',
    });
  }

  // ── Event Feed ──
  interface ProtocolEvent {
    text: string;
    color: string;
    time: string;
    fn: string;
  }

  const eventFeed: ProtocolEvent[] = [
    { text: 'Node seoul-4090 bonded 2,000 HOOT → Tier 2', color: 'var(--blue)', time: '2m ago', fn: 'registerNode' },
    { text: 'Job job-0042 created → 150 HOOT escrowed', color: 'var(--green)', time: '5m ago', fn: 'createJob' },
    { text: 'VTR registered for exp-441 → 1.0 HOOT burned', color: 'var(--red)', time: '8m ago', fn: 'registerVTR' },
    { text: 'Batch #2891 submitted → 3.0 HOOT fee (2.1 treasury / 0.9 burn)', color: 'var(--gold)', time: '12m ago', fn: 'submitBatch' },
    { text: '1,000 HOOT burned → $50 credit (Pro tier)', color: 'var(--red)', time: '15m ago', fn: 'burnToCredit' },
    { text: 'Pool A settled → 450 HOOT (270 creator / 67.5 notary / 67.5 treasury / 45 burn)', color: 'var(--accent)', time: '18m ago', fn: 'settlePool' },
    { text: 'Challenge resolved → valid, 50 HOOT reward', color: 'var(--green)', time: '22m ago', fn: 'resolveChallenge' },
    { text: 'Node us-a100 unbonded 10,000 HOOT', color: 'var(--blue)', time: '25m ago', fn: 'unbondNode' },
  ];

  function openEventModal(evt: ProtocolEvent) {
    const contractMap: Record<string, string> = {
      registerNode: '0x4F0a...7E3d  HootStaking.sol',
      createJob: '0x5E8c...2B7f  ResearchJobManager.sol',
      registerVTR: '0x7F4b...3D6a  VTRRegistry.sol',
      submitBatch: '0x3A1d...9C2e  PPAPRegistry.sol',
      burnToCredit: '0x8B2c...1A9f  HootBurnCredit.sol',
      settlePool: '0x6C9d...5B3a  PoolDistributor.sol',
      resolveChallenge: '0x9D3f...4A1c  ChallengeArbitration.sol',
      unbondNode: '0x4F0a...7E3d  HootStaking.sol',
    };
    openContractModal({
      title: evt.fn + '()',
      contract: contractMap[evt.fn] ?? '0x0000...0000',
      fn: evt.fn,
      params: [{ name: 'txHash', type: 'bytes32', value: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6) }],
      fee: '—',
      gas: '—',
      note: evt.text,
      accentColor: evt.color,
    });
  }

  // ── PPAP Pipeline ──
  interface PpapStage {
    id: string;
    label: string;
    sub: string;
    icon: string;
    color: string;
  }

  const ppapStages: PpapStage[] = [
    { id: 'submit', label: 'Submit', sub: 'Contributor uploads data', icon: '📤', color: 'var(--blue)' },
    { id: 'batch', label: 'Batch', sub: 'Aggregated into batch', icon: '📦', color: 'var(--accent)' },
    { id: 'challenge', label: 'Challenge', sub: '24h verification window', icon: '⏱', color: 'var(--gold)' },
    { id: 'confirmed', label: 'Confirmed', sub: 'PPAP immutable on-chain', icon: '✓', color: 'var(--green)' },
  ];

  let ppapActiveStage = 0;
  let ppapAnimating = true;
  let ppapInterval: ReturnType<typeof setInterval>;

  // ── Trust Score ──
  let trustScore = 0;
  const trustScoreTarget = 847;

  // trust score animated in onMount below

  $: trustTier = trustScore >= 800 ? 3 : trustScore >= 500 ? 2 : 1;
  $: trustTierName = trustTier === 3 ? 'Diamond' : trustTier === 2 ? 'Gold' : 'Silver';
  $: trustTierColor = trustTier === 3 ? 'var(--blue)' : trustTier === 2 ? 'var(--gold)' : 'var(--text-muted)';
  $: trustMultiplier = trustTier === 3 ? '2.5×' : trustTier === 2 ? '1.5×' : '1.0×';
  $: trustBondReq = trustTier === 3 ? '10,000' : trustTier === 2 ? '2,000' : '500';

  // ── Journey Actors ──
  interface JourneyActor {
    role: string;
    desc: string;
    icon: string;
    color: string;
    actions: string[];
  }

  const journeyActors: JourneyActor[] = [
    {
      role: 'Contributor',
      desc: 'Provides data & annotations',
      icon: '📊',
      color: 'var(--accent)',
      actions: ['Upload datasets', 'Earn Pool A rewards', 'Build PPAP provenance'],
    },
    {
      role: 'Verifier',
      desc: 'Validates data integrity',
      icon: '🔍',
      color: 'var(--blue)',
      actions: ['Challenge batches', 'Earn notary fees', 'Maintain trust score'],
    },
    {
      role: 'Compute',
      desc: 'GPU nodes run experiments',
      icon: '⚡',
      color: 'var(--green)',
      actions: ['Bond HOOT as stake', 'Execute research jobs', 'Earn Pool B rewards'],
    },
    {
      role: 'Builder',
      desc: 'Researchers & model creators',
      icon: '🧪',
      color: 'var(--gold)',
      actions: ['Define ontologies', 'Launch Magnet jobs', 'Publish VTR results'],
    },
    {
      role: 'Buyer',
      desc: 'Consumes model outputs',
      icon: '🔑',
      color: 'var(--red)',
      actions: ['Purchase model access', 'Burn HOOT for credits', 'Deploy agent bundles'],
    },
  ];

  // ── Radial Flow hover state ──
  let hoveredNode: string | null = null;

  const flowNodes = [
    { id: 'poolA', label: 'Pool A', amount: '42%', angle: -45, color: 'var(--accent)', breakdown: 'Creator 60% / Notary 15% / Treasury 15% / Burn 10%' },
    { id: 'poolB', label: 'Pool B', amount: '38%', angle: 45, color: 'var(--green)', breakdown: 'GPU Compute 95% / Treasury 5%' },
    { id: 'burn', label: 'Burn', amount: '12%', angle: 135, color: 'var(--red)', breakdown: 'Permanently removed from supply' },
    { id: 'treasury', label: 'Treasury', amount: '8%', angle: 225, color: 'var(--gold)', breakdown: 'Protocol reserve & insurance' },
  ];

  // ── Gauge ──
  $: gaugeRatio = Math.round(mau) / mauTarget;
  $: needleAngle = -90 + (gaugeRatio * 180);
</script>

<div class="econ" data-theme="light" class:visible>

  <!-- ══════════ 0. PAGE HEADER ══════════ -->
  <div class="page-header">
    <div class="page-header-inner">
      <div class="page-header-text">
        <h1 class="page-title">
          <!-- Pixel chain icon inline -->
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" class="px-icon title-icon" shape-rendering="crispEdges">
            <rect x="3" y="1" width="4" height="2" fill="var(--accent)"/>
            <rect x="1" y="3" width="2" height="4" fill="var(--accent)"/>
            <rect x="7" y="3" width="2" height="2" fill="var(--accent)"/>
            <rect x="3" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="5" y="5" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="7" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="9" y="9" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="11" y="7" width="2" height="2" fill="var(--accent)" opacity="0.5"/>
            <rect x="9" y="5" width="4" height="2" fill="var(--accent)"/>
            <rect x="13" y="7" width="2" height="4" fill="var(--accent)"/>
            <rect x="9" y="11" width="4" height="2" fill="var(--accent)"/>
            <rect x="7" y="11" width="2" height="2" fill="var(--accent)"/>
            <rect x="1" y="5" width="2" height="2" fill="var(--accent)"/>
            <rect x="3" y="5" width="2" height="2" fill="var(--accent)"/>
          </svg>
          HOOT Protocol
        </h1>
        <p class="page-subtitle">On-chain operations, token flows & protocol mechanics</p>
      </div>
      <div class="page-header-meta">
        <span class="header-tag">L1 PROOF</span>
        <span class="header-tag">L2 MODEL</span>
        <span class="header-tag">L3 AGENT</span>
      </div>
    </div>
  </div>

  <!-- ══════════ 1. PROTOCOL METRICS STRIP ══════════ -->
  <div class="metrics-strip">
    <div class="metrics-inner">
      <div class="metric-item" style="--delay: 0">
        <span class="metric-value">{fmtDollar(tvl)}</span>
        <span class="metric-label">TVL</span>
        <span class="metric-delta positive">+4.2%</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 1">
        <span class="metric-value">{fmtK(burned)}</span>
        <span class="metric-label">Burned HOOT</span>
        <span class="metric-delta negative">↑ deflationary</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 2">
        <span class="metric-value">{fmtDollar(treasury)}</span>
        <span class="metric-label">Treasury</span>
        <span class="metric-delta positive">+1.8%</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 3">
        <span class="metric-value">{fmtInt(activeBonds)}</span>
        <span class="metric-label">Active Bonds</span>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item" style="--delay: 4">
        <span class="metric-value">{fmtInt(mau)}<span class="metric-of">/{fmtInt(mauTarget)}</span></span>
        <span class="metric-label">MAU → Deflation</span>
        <div class="mau-arc">
          <svg viewBox="0 0 36 18" class="mau-arc-svg">
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>
            <path d="M2,16 A14,14 0 0,1 34,16" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
              stroke-dasharray="{44 * gaugeRatio} 44"/>
          </svg>
        </div>
      </div>

    </div>
  </div>

  <!-- ══════════ 2. MAIN DASHBOARD GRID ══════════ -->
  <div class="dash-content">
    <div class="dash-grid">

      <!-- ──────── LEFT COLUMN ──────── -->
      <div class="left-col">

        <!-- Panel A: Stake & Bond -->
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

        <!-- Panel B: Burn → Credit -->
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

        <!-- Panel C: Create Research Job -->
        <div class="panel" style="--panel-delay: 2">
          <div class="panel-header">
            <h2>Fund Research</h2>
            <span class="panel-badge job">Jobs</span>
          </div>

          <div class="job-form">
            <div class="form-row">
              <div class="form-field">
                <label class="input-label" for={inputIds.jobBudget}>Budget (HOOT)</label>
                <input id={inputIds.jobBudget} type="text" bind:value={jobBudget} class="mono-input" placeholder="150" />
              </div>
              <div class="form-field">
                <label class="input-label" for={inputIds.jobExpId}>Experiment ID</label>
                <input id={inputIds.jobExpId} type="text" bind:value={jobExpId} class="mono-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="input-label" for={inputIds.jobWorkers}>Max Workers</label>
                <select id={inputIds.jobWorkers} bind:value={jobWorkers} class="form-select">
                  {#each [1,2,3,4,5,6,7,8] as w}
                    <option value={String(w)}>{w}</option>
                  {/each}
                </select>
              </div>
              <div class="form-field">
                <label class="input-label" for={inputIds.jobMetric}>Metric</label>
                <select id={inputIds.jobMetric} bind:value={jobMetric} class="form-select">
                  <option value="bpb">bpb</option>
                  <option value="loss">loss</option>
                  <option value="accuracy">accuracy</option>
                </select>
              </div>
            </div>
          </div>

          {#if jobBudgetNum > 0}
            <div class="cost-breakdown">
              <span class="cost-label">Escrow Breakdown:</span>
              <div class="cost-bar">
                <div class="cost-segment gpu" style="width: 95%">
                  <span>GPU {jobGpuCost}</span>
                </div>
                <div class="cost-segment treasury" style="width: 5%">
                </div>
              </div>
              <div class="cost-legend">
                <span><span class="dot gpu-dot"></span>GPU 95%</span>
                <span><span class="dot treasury-dot"></span>Treasury 5%</span>
              </div>
            </div>
          {/if}

          <button
            class="action-btn primary"
            disabled={jobBudgetNum <= 0}
            on:click={openJobModal}
          >
            Create Job
          </button>
        </div>
      </div>

      <!-- ──────── RIGHT COLUMN ──────── -->
      <div class="right-col">

        <!-- Panel D: Token Flow (Radial) -->
        <div class="panel flow-panel" style="--panel-delay: 0.5">
          <div class="panel-header">
            <h2>Token Flow</h2>
            <span class="panel-badge live">Live</span>
          </div>

          <div class="flow-viz">
            <svg class="flow-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/>
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </radialGradient>

                <!-- Paths for particle animation -->
                <path id="path-poolA" d="M200,200 Q120,120 70,80" fill="none"/>
                <path id="path-poolB" d="M200,200 Q280,120 330,80" fill="none"/>
                <path id="path-burn" d="M200,200 Q280,280 330,320" fill="none"/>
                <path id="path-treasury" d="M200,200 Q120,280 70,320" fill="none"/>
              </defs>

              <!-- Glow behind center -->
              <circle cx="200" cy="200" r="80" fill="url(#center-glow)"/>

              <!-- Orbital lines -->
              <line x1="200" y1="200" x2="70" y2="80" class="flow-line" style="stroke: var(--accent); opacity: 0.15"/>
              <line x1="200" y1="200" x2="330" y2="80" class="flow-line" style="stroke: var(--green); opacity: 0.15"/>
              <line x1="200" y1="200" x2="330" y2="320" class="flow-line" style="stroke: var(--red); opacity: 0.15"/>
              <line x1="200" y1="200" x2="70" y2="320" class="flow-line" style="stroke: var(--gold); opacity: 0.15"/>

              <!-- Animated particles along each path -->
              <!-- Pool A particles -->
              <circle r="4" fill="var(--accent)" opacity="0.9">
                <animateMotion dur="2.5s" repeatCount="indefinite">
                  <mpath href="#path-poolA"/>
                </animateMotion>
              </circle>
              <circle r="3" fill="var(--accent)" opacity="0.6">
                <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.8s">
                  <mpath href="#path-poolA"/>
                </animateMotion>
              </circle>
              <circle r="2" fill="var(--accent)" opacity="0.4">
                <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.6s">
                  <mpath href="#path-poolA"/>
                </animateMotion>
              </circle>

              <!-- Pool B particles -->
              <circle r="4" fill="var(--green)" opacity="0.9">
                <animateMotion dur="3s" repeatCount="indefinite">
                  <mpath href="#path-poolB"/>
                </animateMotion>
              </circle>
              <circle r="3" fill="var(--green)" opacity="0.6">
                <animateMotion dur="3s" repeatCount="indefinite" begin="1s">
                  <mpath href="#path-poolB"/>
                </animateMotion>
              </circle>
              <circle r="2" fill="var(--green)" opacity="0.4">
                <animateMotion dur="3s" repeatCount="indefinite" begin="2s">
                  <mpath href="#path-poolB"/>
                </animateMotion>
              </circle>

              <!-- Burn particles -->
              <circle r="4" fill="var(--red)" opacity="0.9">
                <animateMotion dur="3.5s" repeatCount="indefinite">
                  <mpath href="#path-burn"/>
                </animateMotion>
              </circle>
              <circle r="3" fill="var(--red)" opacity="0.6">
                <animateMotion dur="3.5s" repeatCount="indefinite" begin="1.2s">
                  <mpath href="#path-burn"/>
                </animateMotion>
              </circle>

              <!-- Treasury particles -->
              <circle r="4" fill="var(--gold)" opacity="0.9">
                <animateMotion dur="4s" repeatCount="indefinite">
                  <mpath href="#path-treasury"/>
                </animateMotion>
              </circle>
              <circle r="3" fill="var(--gold)" opacity="0.6">
                <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s">
                  <mpath href="#path-treasury"/>
                </animateMotion>
              </circle>

              <!-- Center hub -->
              <circle cx="200" cy="200" r="36" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
              <text x="200" y="197" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-display)" font-size="14" font-weight="700">HOOT</text>
              <text x="200" y="212" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="8">TOKEN</text>

              <!-- Destination: Pool A (top-left) -->
              <g class="dest-group"
                on:mouseenter={() => hoveredNode = 'poolA'}
                on:mouseleave={() => hoveredNode = null}
                role="img"
              >
                <circle cx="70" cy="80" r="30" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.5" class="dest-circle"/>
                <text x="70" y="77" text-anchor="middle" fill="var(--accent)" font-family="var(--font-body)" font-size="10" font-weight="700">Pool A</text>
                <text x="70" y="90" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">42%</text>
              </g>

              <!-- Destination: Pool B (top-right) -->
              <g class="dest-group"
                on:mouseenter={() => hoveredNode = 'poolB'}
                on:mouseleave={() => hoveredNode = null}
                role="img"
              >
                <circle cx="330" cy="80" r="30" fill="var(--surface)" stroke="var(--green)" stroke-width="1.5" class="dest-circle"/>
                <text x="330" y="77" text-anchor="middle" fill="var(--green)" font-family="var(--font-body)" font-size="10" font-weight="700">Pool B</text>
                <text x="330" y="90" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">38%</text>
              </g>

              <!-- Destination: Burn (bottom-right) -->
              <g class="dest-group"
                on:mouseenter={() => hoveredNode = 'burn'}
                on:mouseleave={() => hoveredNode = null}
                role="img"
              >
                <circle cx="330" cy="320" r="30" fill="var(--surface)" stroke="var(--red)" stroke-width="1.5" class="dest-circle"/>
                <text x="330" y="317" text-anchor="middle" fill="var(--red)" font-family="var(--font-body)" font-size="10" font-weight="700">Burn</text>
                <text x="330" y="330" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">12%</text>
              </g>

              <!-- Destination: Treasury (bottom-left) -->
              <g class="dest-group"
                on:mouseenter={() => hoveredNode = 'treasury'}
                on:mouseleave={() => hoveredNode = null}
                role="img"
              >
                <circle cx="70" cy="320" r="30" fill="var(--surface)" stroke="var(--gold)" stroke-width="1.5" class="dest-circle"/>
                <text x="70" y="317" text-anchor="middle" fill="var(--gold)" font-family="var(--font-body)" font-size="10" font-weight="700">Treasury</text>
                <text x="70" y="330" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">8%</text>
              </g>
            </svg>

            <!-- Hover tooltip -->
            {#if hoveredNode}
              <div class="flow-tooltip" class:show={hoveredNode}>
                {#each flowNodes.filter(n => n.id === hoveredNode) as node}
                  <strong>{node.label}</strong>
                  <span>{node.breakdown}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Panel E: Recent Protocol Events -->
        <div class="panel feed-panel" style="--panel-delay: 1">
          <div class="panel-header">
            <h2>Protocol Events</h2>
            <span class="live-dot-wrapper"><span class="live-dot"></span> Live</span>
          </div>

          <div class="feed-list">
            {#each eventFeed as evt, i}
              <button class="feed-item" style="--feed-delay: {i}" on:click={() => openEventModal(evt)}>
                <span class="feed-dot" style="background: {evt.color}"></span>
                <span class="feed-text">{evt.text}</span>
                <span class="feed-time">{evt.time}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Panel F: PPAP Pipeline -->
        <div class="panel ppap-panel" style="--panel-delay: 1.5">
          <div class="panel-header">
            <h2>PPAP Pipeline</h2>
            <span class="panel-badge">Provenance</span>
          </div>

          <div class="ppap-pipeline">
            {#each ppapStages as stage, i}
              <div class="ppap-stage" class:active={ppapActiveStage >= i} class:current={ppapActiveStage === i}>
                <div class="ppap-dot" style="--stage-color: {stage.color}">
                  <span class="ppap-icon">{stage.icon}</span>
                </div>
                <div class="ppap-info">
                  <span class="ppap-label">{stage.label}</span>
                  <span class="ppap-sub">{stage.sub}</span>
                </div>
                {#if i < ppapStages.length - 1}
                  <div class="ppap-connector" class:filled={ppapActiveStage > i}></div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="ppap-stats">
            <div class="ppap-stat">
              <span class="ppap-stat-val">2,891</span>
              <span class="ppap-stat-label">Batches</span>
            </div>
            <div class="ppap-stat">
              <span class="ppap-stat-val">99.7%</span>
              <span class="ppap-stat-label">Valid Rate</span>
            </div>
            <div class="ppap-stat">
              <span class="ppap-stat-val">3</span>
              <span class="ppap-stat-label">Challenged</span>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  </div>

  <!-- ══════════ YOUR JOURNEY ══════════ -->
  <div class="journey-section">
    <div class="journey-inner">
      <h2 class="journey-title">Your Journey in HOOT</h2>
      <p class="journey-subtitle">Five roles power the autonomous research mesh</p>
      <div class="journey-grid">
        {#each journeyActors as actor, i}
          <div class="journey-card" style="--journey-delay: {i}; --journey-color: {actor.color}">
            <div class="journey-card-icon">{actor.icon}</div>
            <h3 class="journey-card-role">{actor.role}</h3>
            <p class="journey-card-desc">{actor.desc}</p>
            <ul class="journey-card-actions">
              {#each actor.actions as action}
                <li>{action}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ══════════ CONTRACT CALL MODAL ══════════ -->
  {#if modalOpen && modalCall}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <div class="modal-overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
      <div class="modal-card" class:confirmed={modalStep === 'confirmed'}>
        <!-- Close -->
        <button class="modal-close" on:click={closeModal}>×</button>

        {#if modalStep === 'review'}
          <!-- STEP 1: REVIEW -->
          <div class="modal-step-indicator">
            <span class="step active">Review</span>
            <span class="step-arrow">→</span>
            <span class="step">Pending</span>
            <span class="step-arrow">→</span>
            <span class="step">Confirmed</span>
          </div>

          <h3 class="modal-title">{modalCall.title}</h3>

          {#if !walletConnected}
            <div class="modal-wallet-prompt">
              <span>No wallet connected</span>
              <button class="wallet-connect-inline" on:click={() => { wallet.connect('Phantom'); }}>Connect Wallet</button>
            </div>
          {:else}
            <div class="modal-wallet-connected">
              <span class="wallet-dot"></span>
              <span>Connected: {walletAddress}</span>
            </div>
          {/if}

          <div class="modal-contract-row">
            <span class="modal-label">Contract</span>
            <span class="modal-mono clickable">{modalCall.contract}</span>
          </div>

          <div class="modal-fn-row">
            <span class="modal-fn">{modalCall.fn}(</span>
            {#each modalCall.params as p, i}
              <div class="modal-param">
                <span class="param-name">{p.name}</span>
                <span class="param-type">{p.type}</span>
                <span class="param-value">{p.value}</span>
              </div>
            {/each}
            <span class="modal-fn">)</span>
          </div>

          <div class="modal-details">
            <div class="modal-detail"><span>Fee</span><span class="mono">{modalCall.fee}</span></div>
            <div class="modal-detail"><span>Est. Gas</span><span class="mono">{modalCall.gas}</span></div>
          </div>

          <p class="modal-note">{modalCall.note}</p>

          <button
            class="action-btn primary modal-confirm"
            disabled={!walletConnected}
            on:click={confirmTx}
          >
            {walletConnected ? 'Confirm Transaction' : 'Connect Wallet First'}
          </button>

        {:else if modalStep === 'pending'}
          <!-- STEP 2: PENDING -->
          <div class="modal-step-indicator">
            <span class="step done">Review</span>
            <span class="step-arrow">→</span>
            <span class="step active">Pending</span>
            <span class="step-arrow">→</span>
            <span class="step">Confirmed</span>
          </div>

          <div class="modal-pending">
            <div class="spinner"></div>
            <h3>Transaction Pending</h3>
            <p class="modal-mono">Waiting for block confirmation...</p>
            <div class="pending-hash">
              tx: 0x{Math.random().toString(16).slice(2, 10)}...{Math.random().toString(16).slice(2, 6)}
            </div>
          </div>

        {:else if modalStep === 'confirmed'}
          <!-- STEP 3: CONFIRMED -->
          <div class="modal-step-indicator">
            <span class="step done">Review</span>
            <span class="step-arrow">→</span>
            <span class="step done">Pending</span>
            <span class="step-arrow">→</span>
            <span class="step active confirmed-step">Confirmed</span>
          </div>

          <div class="modal-confirmed">
            <div class="confirm-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3>Transaction Confirmed</h3>
            <div class="confirmed-details">
              <span class="modal-mono">Block #18,442,891</span>
              <span class="modal-mono">Gas used: {modalCall.gas}</span>
            </div>
            <button class="action-btn secondary" on:click={closeModal}>Done</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════ BASE ═══════ */
  .econ {
    width: 100%;
    min-height: 100vh;
    background: var(--page-bg, #FAF9F7);
    color: var(--text-primary, #2D2D2D);
    font-family: var(--font-body, 'Inter', sans-serif);
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  .econ.visible { opacity: 1; }

  h2 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .mono { font-family: var(--font-mono); }

  /* ═══════ METRICS STRIP ═══════ */
  .metrics-strip {
    position: sticky;
    top: var(--header-height, 52px);
    z-index: 20;
    background: var(--glass-bg, rgba(255,255,255,0.72));
    backdrop-filter: blur(var(--glass-blur, 24px));
    -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    padding: 0 24px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .metrics-strip::-webkit-scrollbar { height: 0; display: none; }

  .metrics-inner {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 14px 0;
    min-width: max-content;
    max-width: 1400px;
    margin: 0 auto;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 20px;
    gap: 2px;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--delay, 0) * 80ms) both;
  }

  .metric-value {
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .metric-of {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .metric-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    font-weight: 600;
  }

  .metric-delta {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
  }
  .metric-delta.positive { color: var(--green); }
  .metric-delta.negative { color: var(--red); }

  .metric-divider {
    width: 1px;
    height: 32px;
    background: var(--border-subtle);
    flex-shrink: 0;
  }

  .mau-arc {
    width: 36px;
    height: 18px;
    margin-top: 2px;
  }
  .mau-arc-svg { width: 100%; height: 100%; }

  /* wallet-dot reused in modal */
  .wallet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    display: inline-block;
    animation: breathe 2s infinite;
  }

  /* ═══════ DASHBOARD GRID ═══════ */
  .dash-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 24px;
    align-items: start;
  }

  .left-col, .right-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ═══════ PANEL ═══════ */
  .panel {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    transition: box-shadow 300ms ease, transform 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--panel-delay, 0) * 120ms + 200ms) both;
  }

  .panel:hover {
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
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
  .panel-badge.job { background: rgba(39,134,74,0.1); color: var(--green); }
  .panel-badge.live {
    background: rgba(39,134,74,0.1);
    color: var(--green);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .panel-badge.live::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--green);
    animation: breathe 2s infinite;
  }

  /* ═══════ TIER TABS ═══════ */
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

  /* ═══════ INPUTS ═══════ */
  .input-group {
    margin-bottom: 16px;
  }

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

  .mono-input::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }

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

  /* ═══════ ACTION BUTTONS ═══════ */
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

  .action-btn.burn {
    background: var(--red, #c0392b);
    color: #fff;
  }
  .action-btn.burn:hover:not(:disabled) {
    background: #a93226;
    box-shadow: 0 4px 16px rgba(192,57,43,0.3);
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
  }

  .action-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

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

  /* ═══════ SUB SECTIONS ═══════ */
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

  /* ═══════ BOND ROWS ═══════ */
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

  /* ═══════ BURN CONVERTER ═══════ */
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

  /* ═══════ CONVERSION HISTORY ═══════ */
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

  /* ═══════ JOB FORM ═══════ */
  .job-form { margin-bottom: 16px; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 12px;
  }

  .form-field { display: flex; flex-direction: column; }

  .form-select {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 4px;
    border: none;
    border-bottom: 2px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    outline: none;
    transition: border-color 200ms;
    -webkit-appearance: none;
    appearance: none;
  }
  .form-select:focus { border-color: var(--accent); }

  .cost-breakdown {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
  }

  .cost-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 6px;
    display: block;
  }

  .cost-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .cost-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0;
  }
  .cost-segment.gpu { background: var(--green); }
  .cost-segment.treasury { background: var(--gold); }

  .cost-legend {
    display: flex;
    gap: 12px;
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  .cost-legend span { display: flex; align-items: center; gap: 4px; }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .gpu-dot { background: var(--green); }
  .treasury-dot { background: var(--gold); }

  /* ═══════ FLOW VIZ ═══════ */
  .flow-panel { position: relative; }

  .flow-viz {
    position: relative;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .flow-svg {
    width: 100%;
    height: auto;
  }

  .flow-line {
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .dest-group { cursor: pointer; }
  .dest-circle { transition: all 200ms; }
  .dest-group:hover .dest-circle {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px currentColor);
  }

  .flow-tooltip {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
    white-space: nowrap;
    animation: fadeIn 150ms ease;
    pointer-events: none;
    z-index: 5;
  }

  .flow-tooltip strong { color: var(--text-primary); }
  .flow-tooltip span { color: var(--text-secondary); }

  /* ═══════ EVENT FEED ═══════ */
  .feed-panel { max-height: none; }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 380px;
    overflow-y: auto;
  }

  .feed-list::-webkit-scrollbar { width: 4px; }
  .feed-list::-webkit-scrollbar-track { background: transparent; }
  .feed-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .feed-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    background: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 150ms;
    text-align: left;
    animation: fadeInUp 400ms var(--ease-out-expo) calc(var(--feed-delay, 0) * 60ms) both;
    width: 100%;
  }

  .feed-item:hover { background: var(--page-bg); }

  .feed-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }

  .feed-text {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
    flex: 1;
  }

  .feed-time {
    font-size: 0.65rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .live-dot-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--green);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    animation: breathe 2s infinite;
  }

  /* ═══════ GAUGE ═══════ */
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

  /* ═══════ MODAL ═══════ */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
    animation: fadeIn 200ms ease;
  }

  .modal-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    animation: scaleIn 300ms var(--ease-out-expo);
    box-shadow: var(--shadow-lg);
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: none;
    background: var(--page-bg);
    border-radius: 50%;
    font-size: 1.1rem;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
  }
  .modal-close:hover {
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .modal-step-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .step { padding: 4px 10px; border-radius: var(--radius-pill); transition: all 200ms; }
  .step.active { background: var(--accent-subtle); color: var(--accent); }
  .step.done { color: var(--green); }
  .step.confirmed-step { background: rgba(39,134,74,0.1); color: var(--green); }
  .step-arrow { color: var(--border); }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--text-primary);
  }

  .modal-wallet-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(192,57,43,0.06);
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .wallet-connect-inline {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    transition: all 150ms;
  }
  .wallet-connect-inline:hover {
    background: var(--accent);
    color: #fff;
  }

  .modal-wallet-connected {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(39,134,74,0.06);
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--green);
    font-weight: 600;
  }

  .modal-contract-row, .modal-fn-row, .modal-details {
    margin-bottom: 12px;
  }

  .modal-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  .modal-mono {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .modal-mono.clickable {
    cursor: pointer;
    transition: color 150ms;
  }
  .modal-mono.clickable:hover { color: var(--accent); }

  .modal-fn-row {
    background: var(--page-bg);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .modal-fn { color: var(--accent); font-weight: 700; }

  .modal-param {
    display: flex;
    gap: 8px;
    padding: 4px 0 4px 16px;
    align-items: baseline;
  }

  .param-name { color: var(--text-primary); font-weight: 600; }
  .param-type { color: var(--text-muted); font-size: 0.65rem; }
  .param-value { color: var(--text-secondary); margin-left: auto; }

  .modal-details {
    display: flex;
    gap: 24px;
  }

  .modal-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
  }
  .modal-detail span:first-child {
    color: var(--text-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .modal-note {
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 12px 0 20px;
    padding: 10px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--accent);
  }

  .modal-confirm { margin-top: 0; }

  /* Pending state */
  .modal-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-pending h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin: 0;
  }

  .pending-hash {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 6px 12px;
    background: var(--page-bg);
    border-radius: var(--radius-sm);
  }

  /* Confirmed state */
  .modal-confirmed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    text-align: center;
  }

  .confirm-check {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(39,134,74,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 400ms var(--ease-spring);
  }

  .confirm-check svg { width: 24px; height: 24px; }

  .modal-confirmed h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin: 0;
    color: var(--green);
  }

  .confirmed-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  /* ═══════ PAGE HEADER ═══════ */
  .page-header {
    padding: 32px 24px 20px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }

  .page-header-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }

  .page-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-icon {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .page-subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary, #6b6560);
    margin: 4px 0 0;
    font-weight: 500;
  }

  .page-header-meta {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .header-tag {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 10px;
    border-radius: var(--radius-pill, 100px);
    border: 1px solid var(--border, #E5E0DA);
    color: var(--text-muted, #9a9590);
    background: var(--surface, #fff);
  }

  /* ═══════ PPAP PIPELINE ═══════ */
  .ppap-pipeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 20px;
    position: relative;
  }

  .ppap-stage {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    position: relative;
    opacity: 0.4;
    transition: opacity 400ms ease;
  }

  .ppap-stage.active {
    opacity: 1;
  }

  .ppap-stage.current .ppap-dot {
    animation: ppapPulse 1.5s ease-in-out infinite;
  }

  @keyframes ppapPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.3); }
    50% { box-shadow: 0 0 0 8px rgba(217,119,87,0); }
  }

  .ppap-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--stage-color) 10%, var(--surface, #fff));
    border: 2px solid var(--stage-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 300ms ease;
  }

  .ppap-stage.active .ppap-dot {
    background: color-mix(in srgb, var(--stage-color) 15%, var(--surface, #fff));
  }

  .ppap-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .ppap-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .ppap-label {
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .ppap-sub {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .ppap-connector {
    position: absolute;
    left: 17px;
    bottom: -2px;
    width: 2px;
    height: 12px;
    background: var(--border);
    transition: background 300ms ease;
    z-index: 0;
  }

  .ppap-connector.filled {
    background: var(--accent);
  }

  .ppap-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .ppap-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .ppap-stat-val {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .ppap-stat-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
  }

  /* ═══════ TRUST SCORE ═══════ */
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

  /* ═══════ YOUR JOURNEY ═══════ */
  .journey-section {
    padding: 40px 24px 48px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    background: linear-gradient(180deg, var(--page-bg, #FAF9F7) 0%, color-mix(in srgb, var(--accent) 3%, var(--page-bg, #FAF9F7)) 100%);
  }

  .journey-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  .journey-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text-primary);
    text-align: center;
  }

  .journey-subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
    margin: 0 0 28px;
    font-weight: 500;
  }

  .journey-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }

  .journey-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-lg, 16px);
    padding: 20px 16px;
    text-align: center;
    transition: all 300ms ease;
    animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) calc(var(--journey-delay, 0) * 80ms + 400ms) both;
  }

  .journey-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--journey-color);
  }

  .journey-card-icon {
    font-size: 1.8rem;
    margin-bottom: 10px;
    line-height: 1;
  }

  .journey-card-role {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text-primary);
  }

  .journey-card-desc {
    font-size: 0.72rem;
    color: var(--text-secondary);
    margin: 0 0 12px;
    font-weight: 500;
  }

  .journey-card-actions {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .journey-card-actions li {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-muted);
    padding: 4px 8px;
    background: var(--page-bg, #FAF9F7);
    border-radius: var(--radius-sm, 6px);
    line-height: 1.3;
  }

  .journey-card-actions li::before {
    content: '→ ';
    color: var(--journey-color);
  }

  /* ═══════ RESPONSIVE ═══════ */
  @media (max-width: 860px) {
    .dash-grid {
      grid-template-columns: 1fr;
    }

    .metrics-inner {
      gap: 0;
    }

    .metric-item { padding: 0 14px; }

    .page-header-inner {
      flex-direction: column;
      align-items: flex-start;
    }

    .journey-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .trust-score-display {
      flex-direction: column;
      align-items: center;
    }
  }

  @media (max-width: 600px) {
    .dash-content { padding: 12px; }

    .panel { padding: 16px; }

    h2 { font-size: 1.1rem; }

    .mono-input { font-size: 1.1rem; }
    .mono-input.large { font-size: 1.3rem; }

    .burn-converter { flex-direction: column; }
    .burn-arrow { transform: rotate(90deg); text-align: center; }

    .form-row { grid-template-columns: 1fr; }

    .tier-specs { grid-template-columns: 1fr; }

    .metric-item { padding: 0 10px; }
    .metric-value { font-size: 1rem; }

    .gauge-svg { width: 160px; height: 96px; }

    .flow-viz { max-width: 300px; }

    .page-header { padding: 20px 12px 16px; }
    .page-title { font-size: 1.4rem; }
    .page-title .title-icon { width: 22px; height: 22px; }
    .page-header-meta { flex-wrap: wrap; }

    .journey-grid { grid-template-columns: 1fr 1fr; }
    .journey-section { padding: 28px 12px 36px; }
    .journey-title { font-size: 1.2rem; }

    .trust-ring { width: 96px; height: 96px; }
    .trust-num { font-size: 1.3rem; }

    .ppap-stats { grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  }
</style>

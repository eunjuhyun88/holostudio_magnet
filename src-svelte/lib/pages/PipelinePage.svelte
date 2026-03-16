<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { router } from '../stores/router.ts';
  import PixelOwl from '../components/PixelOwl.svelte';
  import PixelIcon from '../components/PixelIcon.svelte';

  // ── Pipeline stages ──
  type PxIcon = 'research' | 'sparkle' | 'chart' | 'grid' | 'ontology' | 'arrow';
  interface PipelineStage {
    label: string;
    pixelIcon: PxIcon;
    detail: string;
    status: 'done' | 'active' | 'pending';
  }

  const STAGE_TEMPLATES: Omit<PipelineStage, 'status'>[] = [
    { label: 'Research',     pixelIcon: 'research',  detail: 'Found 47 relevant papers, extracted 312 features from market data sources' },
    { label: 'Hypothesis',   pixelIcon: 'sparkle',   detail: 'Identified 3 core patterns in MEV extraction across Solana DEX trades' },
    { label: 'Experiment',   pixelIcon: 'chart',     detail: 'Batch complete — precision: 0.891, recall: 0.847 across 24 configurations' },
    { label: 'Evaluate',     pixelIcon: 'grid',      detail: 'Validation accuracy: 0.831 (±0.012) on holdout set, AUC: 0.917' },
    { label: 'Build Model',  pixelIcon: 'ontology',  detail: 'Model training complete! F1=0.862, ensemble of 3 gradient boosted trees' },
    { label: 'Deploy',       pixelIcon: 'arrow',     detail: 'Model deployed! Endpoint: /api/v1/mev-detect, latency: 12ms p99' },
  ];

  // ── Simulation state ──
  let activeStageIdx = 0;
  let progress = 0;
  let sessionId = '#a3f7c2';
  let topic = 'Ethereum MEV detection';
  let statusText = 'running';
  let finding = 'interesting patterns found!';
  let owlMood: 'idle' | 'research' | 'happy' = 'research';

  // Log entries
  interface LogEntry { time: string; message: string; }
  let logs: LogEntry[] = [
    { time: '16:22:59', message: 'Generating hypotheses from research corpus...' },
    { time: '14:23:01', message: 'Scraped 47 papers from arxiv, semantic scholar' },
    { time: '16:22:57', message: 'Identified 3 core patterns in MEV extraction' },
    { time: '14:28:50', message: 'Fine-tuning on MEV detection corpus...' },
  ];

  const LOG_MESSAGES = [
    'Training XGBoost with max_depth=8, n_estimators=500...',
    'Feature importance: gas_price (0.23), tx_value (0.18), block_pos (0.15)',
    'Cross-validation fold 3/5 — accuracy: 0.841',
    'Hyperparameter search: testing learning_rate=0.05...',
    'Evaluating ensemble candidate #12 on holdout set...',
    'New best model: F1=0.862 (prev: 0.847)',
    'Generating SHAP explanations for top features...',
    'Running adversarial validation — no data leakage detected',
    'Compiling model artifact for deployment...',
    'Benchmark: 12ms p99 latency on 1000 inference calls',
  ];

  // Derived stages
  $: stages = STAGE_TEMPLATES.map((t, i): PipelineStage => ({
    ...t,
    status: i < activeStageIdx ? 'done' : i === activeStageIdx ? 'active' : 'pending',
  }));

  // UX-P4: Progress bar color by stage
  const STAGE_COLORS: string[] = [
    '#D97757, #E8956E',   // Research — orange
    '#D97757, #e0a84a',   // Hypothesis — orange-gold
    '#c09a35, #e0c84a',   // Experiment — gold
    '#6dbf6d, #4ade80',   // Evaluate — green
    '#4ade80, #34d399',   // Build — green-teal
    '#34d399, #22d3ee',   // Deploy — teal-cyan
  ];
  $: progressGradient = `linear-gradient(90deg, ${STAGE_COLORS[activeStageIdx] ?? STAGE_COLORS[0]})`;

  // ── Single simulation loop (replaces 3 separate setIntervals) ──
  let simInterval: ReturnType<typeof setInterval>;
  let logIdx = 0;
  let tickCount = 0; // 800ms per tick

  function fmtNow(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function startSim() {
    if (simInterval) return;
    simInterval = setInterval(() => {
      tickCount++;

      // Progress tick — every tick (800ms)
      if (progress < 100) {
        progress += Math.random() * 2 + 0.5;
        if (progress > 100) progress = 100;
      }

      // Stage advancement — every ~5000ms (6 ticks × 800ms ≈ 4800ms)
      if (tickCount % 6 === 0) {
        if (activeStageIdx < STAGE_TEMPLATES.length - 1) {
          activeStageIdx++;
          if (activeStageIdx >= STAGE_TEMPLATES.length - 1) {
            statusText = 'complete';
            owlMood = 'happy';
            finding = 'model deployed successfully!';
          }
        } else {
          activeStageIdx = 0;
          progress = 0;
          statusText = 'running';
          owlMood = 'research';
          finding = 'interesting patterns found!';
        }
      }

      // Log additions — every ~4000ms (5 ticks × 800ms = 4000ms)
      if (tickCount % 5 === 0) {
        logs = [
          { time: fmtNow(), message: LOG_MESSAGES[logIdx % LOG_MESSAGES.length] },
          ...logs.slice(0, 5),
        ];
        logIdx++;
      }
    }, 800);
  }

  function stopSim() {
    if (simInterval) { clearInterval(simInterval); simInterval = undefined as any; }
  }

  function handleVisibility() {
    if (document.hidden) stopSim(); else startSim();
  }

  onMount(() => {
    startSim();
    document.addEventListener('visibilitychange', handleVisibility);
  });

  onDestroy(() => {
    stopSim();
    document.removeEventListener('visibilitychange', handleVisibility);
  });
</script>

<div class="pipeline-page">
  <button class="pipe-back-btn" on:click={() => router.navigate('studio')} aria-label="Back to Studio">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>Back</span>
  </button>
  <div class="terminal">
    <!-- Terminal chrome -->
    <div class="term-chrome">
      <div class="term-dots">
        <span class="td red"></span>
        <span class="td yellow"></span>
        <span class="td green"></span>
      </div>
      <span class="term-title">hoot — research pipeline<span class="cursor-blink">▌</span></span>
    </div>

    <div class="term-content">
      <!-- Header: Owl + Status -->
      <div class="header">
        <div class="header-owl">
          <PixelOwl size={1.4} mood={owlMood} />
        </div>
        <div class="header-info">
          <div class="header-title">
            <span class="protocol-name">HOOT Protocol</span>
            <span class="status-badge" class:complete={statusText === 'complete'}>
              <span class="status-dot"></span>
              {statusText}
            </span>
          </div>
          <div class="header-meta">Topic: <strong>{topic}</strong></div>
          <div class="header-meta">Session: <strong>{sessionId}</strong></div>
          <div class="header-finding">
            <span class="finding-icon"><PixelIcon type="sparkle" size={14} /></span>
            <span class="finding-text">{finding}</span>
          </div>
        </div>
      </div>

      <!-- Pipeline Stages -->
      <div class="stages">
        {#each stages as stage, i}
          <div class="stage-row" class:done={stage.status === 'done'} class:active={stage.status === 'active'} class:pending={stage.status === 'pending'}>
            <div class="stage-indicator">
              <div class="stage-dot"
                class:dot-done={stage.status === 'done'}
                class:dot-active={stage.status === 'active'}
                class:dot-pending={stage.status === 'pending'}
              >
                {#if stage.status === 'done'}
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none" class="check-icon">
                    <path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {/if}
              </div>
              {#if i < stages.length - 1}
                <div class="stage-line"
                  class:line-done={stage.status === 'done'}
                ></div>
              {/if}
            </div>
            <div class="stage-content">
              <div class="stage-label-row">
                <span class="stage-emoji"><PixelIcon type={stage.pixelIcon} size={14} /></span>
                <span class="stage-label">{stage.label}</span>
              </div>
            </div>
            <div class="stage-detail">{stage.detail}</div>
          </div>
        {/each}
      </div>

      <!-- Progress -->
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-title">Model Progress</span>
          <span class="progress-pct">{Math.round(progress)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: {progress}%; background: {progressGradient}"></div>
        </div>
      </div>

      <!-- UX-P3: Log with typewriter slide-in -->
      <div class="log-section">
        {#each logs as log, i (log.time + log.message)}
          <div class="log-line" in:fly={{ x: -12, duration: 250 }}>
            <span class="log-time">{log.time}</span>
            <span class="log-arrow">▸</span>
            <span class="log-msg">{log.message}</span>
          </div>
        {/each}
      </div>

      <div class="prompt">❯</div>
    </div>
  </div>
</div>

<style>
  .pipeline-page {
    min-height: calc(100vh - 52px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    background: #0a0a12;
    position: relative;
  }
  .pipe-back-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    appearance: none;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.5);
    font: 500 0.72rem/1 'Inter', sans-serif;
    padding: 10px 16px;
    min-height: 44px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms;
    z-index: 2;
    -webkit-tap-highlight-color: transparent;
  }
  .pipe-back-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2); }

  .terminal {
    width: 100%;
    max-width: 720px;
    background: #12121c;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(217,119,87,0.03);
    overflow: hidden;
  }

  /* ── Chrome ── */
  .term-chrome {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .term-dots {
    display: flex;
    gap: 7px;
  }
  .td {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .td.red { background: #FF5F57; }
  .td.yellow { background: #FEBC2E; }
  .td.green { background: #28C840; }
  .term-title {
    flex: 1;
    text-align: center;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.03em;
  }
  /* UX-P5: Blinking cursor in title */
  .cursor-blink {
    animation: cursorBlink 1s step-end infinite;
    color: #D97757;
    margin-left: 2px;
  }
  @keyframes cursorBlink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* ── Content ── */
  .term-content {
    padding: 28px 32px 20px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 32px;
  }
  .header-owl {
    flex-shrink: 0;
    filter: drop-shadow(0 0 16px rgba(217,119,87,0.15));
  }
  .header-info {
    flex: 1;
    min-width: 0;
    padding-top: 8px;
  }
  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .protocol-name {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 1.2rem;
    font-weight: 800;
    color: rgba(255,255,255,0.9);
    letter-spacing: -0.01em;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem;
    font-weight: 600;
    color: #4ade80;
    letter-spacing: 0.02em;
  }
  .status-badge.complete { color: #fbbf24; }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74,222,128,0.5);
    animation: dot-breathe 2s ease-in-out infinite;
  }
  .status-badge.complete .status-dot {
    background: #fbbf24;
    box-shadow: 0 0 8px rgba(251,191,36,0.5);
  }

  .header-meta {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: rgba(255,255,255,0.35);
    margin-bottom: 2px;
  }
  .header-meta strong {
    color: rgba(255,255,255,0.6);
    font-weight: 600;
  }
  .header-finding {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: #4ade80;
  }
  .finding-icon { font-size: 0.85rem; }

  /* ── Pipeline Stages ── */
  .stages {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 28px;
  }
  .stage-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-height: 48px;
  }
  .stage-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex-shrink: 0;
    padding-top: 4px;
  }
  .stage-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: all 400ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* UX-P2: Done stage checkmark + green flash */
  .dot-done {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74,222,128,0.4);
    animation: stageFlash 500ms ease-out;
  }
  .check-icon {
    animation: checkPop 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes stageFlash {
    0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
    50% { box-shadow: 0 0 16px 4px rgba(74,222,128,0.4); }
    100% { box-shadow: 0 0 8px rgba(74,222,128,0.4); }
  }
  @keyframes checkPop {
    from { opacity: 0; transform: scale(0); }
    to { opacity: 1; transform: scale(1); }
  }
  .dot-active {
    background: #D97757;
    box-shadow: 0 0 12px rgba(217,119,87,0.5);
    animation: dot-breathe 2s ease-in-out infinite;
  }
  .dot-pending {
    background: rgba(255,255,255,0.12);
    border: 1.5px solid rgba(255,255,255,0.15);
  }
  .stage-line {
    width: 2px;
    flex: 1;
    min-height: 24px;
    margin: 4px 0;
    background: rgba(255,255,255,0.06);
    border-radius: 1px;
    transition: background 400ms ease;
  }
  .line-done {
    background: rgba(74,222,128,0.3);
  }

  .stage-content {
    flex-shrink: 0;
    padding-top: 0;
  }
  .stage-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stage-emoji {
    font-size: 1rem;
    line-height: 1;
  }
  .stage-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.88rem;
    font-weight: 600;
    color: rgba(255,255,255,0.3);
    transition: color 400ms ease;
  }
  .stage-row.done .stage-label {
    color: rgba(255,255,255,0.5);
  }
  .stage-row.active .stage-label {
    color: #D97757;
    font-weight: 700;
  }

  .stage-detail {
    flex: 1;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem;
    color: rgba(255,255,255,0.2);
    text-align: right;
    padding-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stage-row.done .stage-detail { color: rgba(255,255,255,0.3); }
  .stage-row.active .stage-detail { color: rgba(217,119,87,0.6); }

  /* ── Progress ── */
  .progress-section {
    margin-bottom: 20px;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .progress-title {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.04em;
  }
  .progress-pct {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    font-weight: 700;
    color: #D97757;
    font-variant-numeric: tabular-nums;
  }
  .progress-track {
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
  }
  /* UX-P4 + P6: Dynamic gradient + smooth transition */
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #D97757, #E8956E);
    border-radius: 3px;
    transition: width 600ms ease, background 800ms ease;
    box-shadow: 0 0 12px rgba(217,119,87,0.3);
  }

  /* ── Log ── */
  .log-section {
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .log-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.68rem;
    line-height: 1.8;
    color: rgba(255,255,255,0.4);
  }
  .log-time {
    color: rgba(255,255,255,0.2);
    flex-shrink: 0;
    min-width: 56px;
  }
  .log-arrow {
    color: #D97757;
    flex-shrink: 0;
  }
  .log-msg {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.82rem;
    color: #D97757;
    font-weight: 700;
  }

  /* ── Keyframes ── */
  @keyframes dot-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .pipeline-page {
      padding: 60px 10px calc(80px + env(safe-area-inset-bottom, 0px));
      justify-content: flex-start;
    }
    .pipe-back-btn { top: 10px; left: 10px; }
    .term-content { padding: 16px 12px 12px; }
    .header { flex-direction: column; align-items: center; text-align: center; gap: 12px; }
    .header-owl { transform: scale(0.88); }
    .header-title { justify-content: center; flex-wrap: wrap; }
    .header-finding { justify-content: center; }
    .protocol-name { font-size: 0.94rem; }
    .header-meta { font-size: 0.68rem; }
    .header-finding { font-size: 0.68rem; }
    .stage-row { gap: 10px; min-height: 44px; }
    .stage-detail { display: none; }
    .stage-label { font-size: 0.75rem; }
    .log-section { margin-top: 12px; }
    .log-line { font-size: 0.62rem; }
  }

  /* C-1: prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .dot-done, .dot-active, .cursor-blink, .check-icon { animation: none !important; }
    .progress-fill, .stage-dot, .stage-line, .stage-label { transition: none !important; }
  }
</style>

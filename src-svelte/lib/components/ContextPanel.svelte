<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { selectedExperiment, clearSelection } from '../stores/selectionStore.ts';
  import { resolveExperimentCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '../data/modifications.ts';
  import { humanizeModification } from '../stores/jobStore.ts';
  import type { JobPhase, BranchInfo, Experiment } from '../stores/jobStore.ts';
  import PixelOwl from './PixelOwl.svelte';

  export let bestMetric: number = Infinity;
  export let phase: JobPhase = 'idle';
  export let topic: string = '';
  export let progress: number = 0;
  export let sessionId: string = '';
  export let branches: BranchInfo[] = [];
  export let experiments: Experiment[] = [];
  export let totalExperiments: number = 0;

  const dispatch = createEventDispatcher<{
    launch: string;
    submit: { text: string; parentId: number | null };
    fork: { parentId: number; text: string };
    newresearch: void;
    deploy: { target: string };
    retrain: { code: string; parentId: number | null };
  }>();

  let inputText = '';
  let forkText = '';
  let submitText = '';
  let showDeployOptions = false;
  let showCodeEditor = false;
  let codeEditorContent = '';
  let inputEl: HTMLTextAreaElement | HTMLInputElement;

  $: owlMood = (() => {
    if (phase === 'running') return 'research' as const;
    if (phase === 'setup') return 'build' as const;
    if (phase === 'complete') return 'celebrate' as const;
    return 'idle' as const;
  })();

  $: exp = $selectedExperiment;
  $: category = exp ? resolveExperimentCategory(exp.modification) : null;
  $: isNewBest = exp && exp.status === 'keep' && exp.metric === bestMetric && bestMetric < Infinity;

  // Research summary stats
  $: totalDone = experiments.filter(e => e.status !== 'training').length;
  $: totalKeeps = experiments.filter(e => e.status === 'keep').length;
  $: totalCrashes = experiments.filter(e => e.status === 'crash').length;
  $: sortedBranches = [...branches].sort((a, b) => a.bestMetric - b.bestMetric);
  $: globalBest = sortedBranches.length > 0 ? sortedBranches[0] : null;

  const presets = [
    { label: 'Crypto Market Prediction', desc: 'Price movements using on-chain + sentiment' },
    { label: 'DeFi Protocol Risk', desc: 'Classify risk via TVL and audit history' },
    { label: 'Fraud Detection', desc: 'Identify suspicious wallet patterns' },
    { label: 'Time Series Forecasting', desc: 'Multi-variate financial forecasting' },
  ];

  function handleLaunch() {
    if (!inputText.trim()) return;
    dispatch('launch', inputText.trim());
  }

  function handleSubmit() {
    if (!submitText.trim()) return;
    dispatch('submit', { text: submitText.trim(), parentId: null });
    submitText = '';
  }

  function handleFork() {
    if (!forkText.trim() || !exp) return;
    dispatch('fork', { parentId: exp.id, text: forkText.trim() });
    forkText = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (phase === 'idle') handleLaunch();
    }
  }

  function handleSubmitKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  function handleForkKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleFork();
    }
  }

  function usePreset(label: string) {
    inputText = label;
    if (inputEl) inputEl.focus();
  }

  // Generate representative train.py code from experiment modification
  function generateCodeSnippet(modification: string, metric: number): string {
    const cat = resolveExperimentCategory(modification);
    const lines = [
      `# train.py — AI-generated configuration`,
      `# Modification: ${modification}`,
      `# Category: ${CATEGORY_LABELS[cat] ?? cat}`,
      `# Result: val_bpb = ${metric > 0 ? metric.toFixed(4) : 'pending'}`,
      ``,
    ];
    switch (cat) {
      case 'learning_rate':
        lines.push(`learning_rate = ${(0.0001 + Math.random() * 0.005).toFixed(6)}`);
        lines.push(`lr_scheduler = "cosine_warmup"`);
        lines.push(`warmup_steps = ${Math.floor(100 + Math.random() * 400)}`);
        break;
      case 'batch_size':
        lines.push(`batch_size = ${[16, 32, 64, 128][Math.floor(Math.random() * 4)]}`);
        lines.push(`gradient_accumulation = ${[1, 2, 4][Math.floor(Math.random() * 3)]}`);
        break;
      case 'architecture':
        lines.push(`n_layers = ${Math.floor(4 + Math.random() * 12)}`);
        lines.push(`n_heads = ${[4, 8, 12, 16][Math.floor(Math.random() * 4)]}`);
        lines.push(`d_model = ${[256, 384, 512, 768][Math.floor(Math.random() * 4)]}`);
        break;
      case 'optimizer':
        lines.push(`optimizer = "${['adamw', 'lion', 'sophia', 'sgd'][Math.floor(Math.random() * 4)]}"`);
        lines.push(`weight_decay = ${(0.001 + Math.random() * 0.1).toFixed(4)}`);
        break;
      case 'regularization':
        lines.push(`dropout = ${(0.05 + Math.random() * 0.3).toFixed(2)}`);
        lines.push(`label_smoothing = ${(0.01 + Math.random() * 0.15).toFixed(3)}`);
        break;
      default:
        lines.push(`# ${modification}`);
        lines.push(`config = { "type": "${cat}" }`);
    }
    lines.push('');
    lines.push('# ↓ Edit below to guide the next training run');
    return lines.join('\n');
  }

  function openCodeEditor(modification: string, metric: number) {
    codeEditorContent = generateCodeSnippet(modification, metric);
    showCodeEditor = true;
  }

  function handleRetrain(parentId: number | null) {
    dispatch('retrain', { code: codeEditorContent, parentId });
    showCodeEditor = false;
  }
</script>

<div class="ctx-panel">

  <!-- ═══ DETAIL: experiment selected ═══ -->
  {#if exp}
    <div class="ctx-header">
      <button class="back-btn" on:click={clearSelection}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="ctx-title">Experiment #{exp.id}</span>
      {#if isNewBest}<span class="best-tag">★ Best</span>{/if}
    </div>

    <div class="detail-grid">
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value" class:crash={exp.status === 'crash'} class:keep={exp.status === 'keep'}>
          {#if exp.status === 'crash'}
            <span class="status-dot crash"></span>CRASH
          {:else if exp.status === 'keep'}
            <span class="status-dot keep"></span>KEEP
          {:else}
            <span class="status-dot discard"></span>{exp.status}
          {/if}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category</span>
        <span class="detail-value cat-val" style="color: {CATEGORY_COLORS[category ?? 'hyperparameter_tuning']}">
          {CATEGORY_LABELS[category ?? 'hyperparameter_tuning'] ?? '?'}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Metric</span>
        <span class="detail-value metric-val">
          {#if exp.status === 'crash'}
            <span class="crash">—</span>
          {:else}
            {exp.metric.toFixed(4)}
            {#if exp.delta !== 0}
              <span class="delta" class:positive={exp.delta > 0}>{exp.delta > 0 ? '▼' : '▲'}{Math.abs(exp.delta).toFixed(4)}</span>
            {/if}
          {/if}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Modification</span>
        <span class="detail-value mod-val">{humanizeModification(exp.modification)}</span>
      </div>
      <div class="detail-row compact">
        <div class="detail-mini"><span class="detail-label">Node</span><span class="detail-value">{exp.nodeId}</span></div>
        <div class="detail-mini"><span class="detail-label">GPU</span><span class="detail-value">{exp.tier}x</span></div>
        <div class="detail-mini"><span class="detail-label">Time</span><span class="detail-value">{exp.duration}s</span></div>
      </div>
    </div>

    <!-- Code viewer/editor -->
    <div class="code-section">
      <div class="code-header">
        <span class="code-title">train.py</span>
        <span class="code-hint">AI-generated config</span>
        {#if !showCodeEditor}
          <button class="code-toggle" on:click={() => openCodeEditor(exp.modification, exp.metric)}>View Code</button>
        {:else}
          <button class="code-toggle" on:click={() => { showCodeEditor = false; }}>Hide</button>
        {/if}
      </div>
      {#if showCodeEditor}
        <textarea
          class="code-editor"
          bind:value={codeEditorContent}
          spellcheck="false"
          rows="12"
        ></textarea>
        <div class="code-actions">
          <button class="action-btn retrain" on:click={() => handleRetrain(exp.id)}>
            Retrain with Edits
          </button>
        </div>
      {/if}
    </div>

    <div class="fork-section">
      <span class="fork-label">Or describe a modification</span>
      <textarea
        class="fork-input"
        bind:value={forkText}
        placeholder="Describe a modification to try..."
        on:keydown={handleForkKeydown}
        rows="2"
      ></textarea>
      <button class="action-btn primary" on:click={handleFork} disabled={!forkText.trim()}>
        Fork & Submit
      </button>
    </div>

  <!-- ═══ IDLE: guided input ═══ -->
  {:else if phase === 'idle'}
    <div class="owl-greeting">
      <PixelOwl size={0.45} mood="idle" />
      <div class="owl-speech">
        <span class="owl-msg">Ready to research!</span>
        <span class="owl-sub">Describe a topic below.</span>
      </div>
    </div>
    <div class="ctx-header">
      <span class="ctx-icon">⚡</span>
      <span class="ctx-title">Start Research</span>
    </div>

    <div class="guide-section">
      <p class="guide-text">Describe what you want to research. The system will auto-generate a dataset, design branch strategies, and run parallel experiments.</p>

      <div class="input-group">
        <span class="input-label">Research Topic</span>
        <textarea
          class="topic-input"
          bind:value={inputText}
          bind:this={inputEl}
          placeholder="e.g., Predict short-term cryptocurrency price movements using on-chain metrics, market data, and sentiment indicators"
          on:keydown={handleKeydown}
          rows="3"
        ></textarea>
        <span class="input-hint">⌘+Enter to launch</span>
      </div>

      <button class="action-btn primary launch-btn" on:click={handleLaunch} disabled={!inputText.trim()}>
        <svg width="12" height="12" viewBox="0 0 16 16"><polygon points="3,1 14,8 3,15" fill="currentColor"/></svg>
        Launch Autoresearch
      </button>
    </div>

    <div class="presets-section">
      <span class="presets-label">Quick Presets</span>
      <div class="presets-grid">
        {#each presets as p}
          <button class="preset-btn" on:click={() => usePreset(p.label)}>
            <span class="preset-name">{p.label}</span>
            <span class="preset-desc">{p.desc}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="info-bar">
      <div class="info-item"><span class="info-val">6</span><span class="info-lbl">Branches</span></div>
      <div class="info-item"><span class="info-val">50</span><span class="info-lbl">Iters/Branch</span></div>
      <div class="info-item"><span class="info-val">300</span><span class="info-lbl">Total Exp</span></div>
      <div class="info-item"><span class="info-val">~5m</span><span class="info-lbl">ETA</span></div>
    </div>

  <!-- ═══ RUNNING: live status ═══ -->
  {:else if phase === 'running'}
    <div class="ctx-header">
      <span class="owl-mini"><PixelOwl size={0.2} mood="research" /></span>
      <span class="ctx-title">Research Running</span>
      <span class="progress-badge">{progress}%</span>
    </div>

    <div class="run-meta">
      <div class="run-topic">{topic}</div>
      {#if sessionId}<div class="run-session">Session #{sessionId}</div>{/if}
      <div class="run-progress-bar">
        <div class="run-progress-fill" style="width: {progress}%"></div>
      </div>
      <div class="run-counts">
        <span>{totalDone}/{totalExperiments} experiments</span>
        <span class="sep">·</span>
        <span class="keep-count">{totalKeeps} keeps</span>
        <span class="sep">·</span>
        <span class="crash-count">{totalCrashes} crashes</span>
      </div>
    </div>

    <!-- Live branch summary -->
    {#if sortedBranches.length > 0}
      <div class="branch-section">
        <span class="section-label">Branch Status</span>
        <div class="branch-list">
          {#each sortedBranches as br, i}
            <div class="branch-row" class:best={i === 0 && br.bestMetric < Infinity}>
              <span class="br-rank">#{i + 1}</span>
              <span class="br-name">{br.label}</span>
              <span class="br-metric">{br.bestMetric < Infinity ? br.bestMetric.toFixed(4) : '—'}</span>
              <span class="br-stat">{br.keeps}k {br.crashes}c</span>
              {#if br.active}<span class="br-active">●</span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if bestMetric < Infinity}
      <div class="best-banner">
        <span class="best-icon">★</span>
        <span class="best-label">Current Best</span>
        <span class="best-val">{bestMetric.toFixed(4)}</span>
      </div>
    {/if}

    <!-- Submit idea during run -->
    <div class="submit-section">
      <span class="submit-label">Submit experiment idea</span>
      <div class="submit-row">
        <input
          type="text"
          class="submit-input"
          bind:value={submitText}
          placeholder="Try a different approach..."
          on:keydown={handleSubmitKeydown}
        />
        <button class="action-btn small" on:click={handleSubmit} disabled={!submitText.trim()}>Send</button>
      </div>
      <span class="submit-hint">Click any result to inspect & fork</span>
    </div>

  <!-- ═══ COMPLETE: Research Summary ═══ -->
  {:else if phase === 'complete'}
    <div class="owl-celebrate">
      <PixelOwl size={0.4} mood="celebrate" />
    </div>
    <div class="ctx-header complete-header">
      <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span class="ctx-title">Research Complete</span>
    </div>

    <!-- Summary stats -->
    <div class="summary-card">
      <div class="summary-title">Research Summary</div>
      <div class="summary-text">
        {sortedBranches.length} branches · {totalDone} experiments · {totalKeeps} improvements · {totalCrashes} crashes
      </div>
      {#if globalBest && bestMetric < Infinity}
        <div class="global-best">
          <span class="gb-label">Global Best</span>
          <span class="gb-branch">{globalBest.label}</span>
          <span class="gb-arrow">→</span>
          <span class="gb-metric">{bestMetric.toFixed(4)}</span>
        </div>
      {/if}
    </div>

    <!-- Branch Leaderboard -->
    <div class="branch-section">
      <span class="section-label">Branch Leaderboard</span>
      <div class="branch-list">
        {#each sortedBranches as br, i}
          <div class="branch-row leaderboard" class:best={i === 0}>
            <span class="br-rank">#{i + 1}</span>
            <span class="br-name">{br.label}</span>
            <span class="br-metric">{br.bestMetric < Infinity ? br.bestMetric.toFixed(4) : '—'}</span>
            <span class="br-detail">{br.total} iters, {br.keeps} keeps</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Code review section -->
    <div class="code-section">
      <div class="code-header">
        <span class="code-title">Best Config</span>
        <span class="code-hint">train.py</span>
        {#if !showCodeEditor}
          <button class="code-toggle" on:click={() => {
            const bestExp = experiments.find(e => e.status === 'keep' && e.metric === bestMetric);
            if (bestExp) openCodeEditor(bestExp.modification, bestExp.metric);
          }}>Review & Edit</button>
        {:else}
          <button class="code-toggle" on:click={() => { showCodeEditor = false; }}>Hide</button>
        {/if}
      </div>
      {#if showCodeEditor}
        <textarea
          class="code-editor"
          bind:value={codeEditorContent}
          spellcheck="false"
          rows="10"
        ></textarea>
        <div class="code-actions">
          <button class="action-btn retrain" on:click={() => handleRetrain(null)}>
            Retrain with Edits
          </button>
          <span class="code-hint">Modify the config and retrain to improve further</span>
        </div>
      {/if}
    </div>

    <!-- Next actions -->
    <div class="next-actions">
      <span class="section-label">What's next?</span>

      <!-- Deploy (primary) -->
      {#if !showDeployOptions}
        <button class="deploy-btn" on:click={() => { showDeployOptions = true; }}>
          Deploy Best Model
        </button>
      {:else}
        <div class="deploy-options">
          <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'checkpoint' })}>
            <span class="do-icon">&#x1F4E6;</span>
            <div class="do-text">
              <span class="do-name">Export Checkpoint</span>
              <span class="do-desc">Save model locally</span>
            </div>
          </button>
          <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'huggingface' })}>
            <span class="do-icon">&#x1F917;</span>
            <div class="do-text">
              <span class="do-name">Push to HF Hub</span>
              <span class="do-desc">Publish to registry</span>
            </div>
          </button>
          <button class="deploy-opt" on:click={() => dispatch('deploy', { target: 'cloud' })}>
            <span class="do-icon">&#x2601;</span>
            <div class="do-text">
              <span class="do-name">Deploy as API</span>
              <span class="do-desc">Cloud endpoint</span>
            </div>
          </button>
          <button class="deploy-back" on:click={() => { showDeployOptions = false; }}>Back</button>
        </div>
      {/if}

      <div class="action-grid">
        <button class="next-btn" on:click={() => dispatch('newresearch')}>
          <span class="next-icon">+</span>
          <div class="next-text">
            <span class="next-name">New Research</span>
            <span class="next-desc">Start a different topic</span>
          </div>
        </button>
        <button class="next-btn">
          <span class="next-icon">&#x21BB;</span>
          <div class="next-text">
            <span class="next-name">Re-run</span>
            <span class="next-desc">Same topic, new seeds</span>
          </div>
        </button>
      </div>
      <div class="click-hint">Click any result to review & fork</div>
    </div>
  {/if}
</div>

<style>
  .ctx-panel {
    display: flex; flex-direction: column;
    height: 100%;
    background: #fff;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
  }
  .ctx-panel::-webkit-scrollbar { width: 3px; }
  .ctx-panel::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 2px; }

  /* ── Header ── */
  .ctx-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }
  .ctx-title {
    font: 700 13px/1 'Inter', -apple-system, sans-serif;
    color: #222;
  }
  .ctx-icon { font-size: 14px; }
  .back-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border: none; border-radius: 6px;
    background: #f5f5f5; color: #888; cursor: pointer;
    transition: all 150ms;
  }
  .back-btn:hover { background: #eee; color: #444; }
  .best-tag {
    font: 700 9px/1 'Inter', sans-serif;
    color: #d4a017; background: rgba(212,160,23,0.08);
    padding: 2px 6px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .progress-badge {
    margin-left: auto;
    font: 700 11px/1 'SF Mono', 'Fira Code', monospace;
    color: #D97757;
    font-variant-numeric: tabular-nums;
  }
  .complete-header { border-bottom-color: rgba(39,134,74,0.15); }
  .check-icon { color: #27864a; flex-shrink: 0; }

  /* ── Running dot ── */
  .running-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #27864a;
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(39,134,74,0.3); }
    50% { box-shadow: 0 0 0 4px rgba(39,134,74,0); }
  }

  /* ── Detail view ── */
  .detail-grid {
    display: flex; flex-direction: column;
    padding: 10px 14px; gap: 6px;
  }
  .detail-row {
    display: flex; align-items: baseline; gap: 8px;
  }
  .detail-row.compact {
    display: flex; gap: 12px; margin-top: 4px;
    padding-top: 6px; border-top: 1px solid #f5f5f5;
  }
  .detail-mini { display: flex; flex-direction: column; gap: 2px; }
  .detail-label {
    font: 500 10px/1 'Inter', sans-serif;
    color: #999; text-transform: uppercase;
    letter-spacing: 0.04em; min-width: 70px;
    flex-shrink: 0;
  }
  .detail-value {
    font: 600 12px/1.3 'Inter', sans-serif;
    color: #333;
  }
  .detail-value.crash { color: #c0392b; }
  .detail-value.keep { color: #27864a; }
  .cat-val { font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .metric-val { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 14px; font-weight: 800; }
  .mod-val { font-weight: 400; color: #666; font-size: 11px; }
  .status-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }
  .status-dot.crash { background: #c0392b; }
  .status-dot.keep { background: #27864a; }
  .status-dot.discard { background: #ccc; }
  .delta { font: 500 10px/1 'SF Mono', monospace; color: #999; margin-left: 4px; }
  .delta.positive { color: #27864a; }

  /* ── Fork section ── */
  .fork-section {
    margin-top: auto;
    padding: 10px 14px;
    border-top: 1px solid #f0f0f0;
    display: flex; flex-direction: column; gap: 6px;
  }
  .fork-label {
    font: 600 10px/1 'Inter', sans-serif;
    color: #999; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .fork-input {
    font: 400 12px/1.5 'Inter', sans-serif;
    color: #333; background: #fafafa;
    border: 1px solid #eee; border-radius: 6px;
    padding: 8px 10px; resize: none; outline: none;
    transition: border-color 200ms;
  }
  .fork-input:focus { border-color: #D97757; }
  .fork-input::placeholder { color: #ccc; }

  /* ── Guide section (idle) ── */
  .guide-section {
    padding: 12px 14px; display: flex; flex-direction: column; gap: 12px;
  }
  .guide-text {
    font: 400 11.5px/1.5 'Inter', sans-serif;
    color: #888; margin: 0;
  }

  .input-group {
    display: flex; flex-direction: column; gap: 4px;
  }
  .input-label {
    font: 600 10px/1 'Inter', sans-serif;
    color: #666; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .topic-input {
    font: 400 12px/1.5 'Inter', sans-serif;
    color: #333; background: #fafafa;
    border: 1px solid #eee; border-radius: 8px;
    padding: 10px 12px; resize: none; outline: none;
    transition: border-color 200ms;
  }
  .topic-input:focus { border-color: #D97757; }
  .topic-input::placeholder { color: #bbb; font-size: 11px; }
  .input-hint {
    font: 400 10px/1 'Inter', sans-serif;
    color: #ccc; text-align: right;
  }

  /* ── Action buttons ── */
  .action-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font: 600 12px/1 'Inter', sans-serif;
    padding: 8px 16px; border-radius: 8px;
    border: none; cursor: pointer; transition: all 200ms;
  }
  .action-btn.primary {
    background: #1a1a1a; color: #fff;
  }
  .action-btn.primary:hover:not(:disabled) { background: #333; }
  .action-btn.primary:disabled { opacity: 0.3; cursor: not-allowed; }
  .action-btn.small {
    padding: 6px 12px; font-size: 11px; border-radius: 6px;
    background: #f5f5f5; color: #555;
  }
  .action-btn.small:hover:not(:disabled) { background: #eee; }
  .action-btn.small:disabled { opacity: 0.3; cursor: not-allowed; }
  .launch-btn { width: 100%; }

  /* ── Presets ── */
  .presets-section {
    padding: 0 14px 10px; display: flex; flex-direction: column; gap: 6px;
  }
  .presets-label {
    font: 600 9px/1 'Inter', sans-serif;
    color: #bbb; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .presets-grid { display: flex; flex-direction: column; gap: 4px; }
  .preset-btn {
    display: flex; flex-direction: column; gap: 2px;
    padding: 7px 10px; border-radius: 6px;
    border: 1px solid #f0f0f0; background: #fff;
    text-align: left; cursor: pointer; transition: all 150ms;
  }
  .preset-btn:hover { border-color: #D97757; background: rgba(217,119,87,0.02); }
  .preset-name {
    font: 600 11px/1 'Inter', sans-serif; color: #444;
  }
  .preset-desc {
    font: 400 10px/1.2 'Inter', sans-serif; color: #aaa;
  }

  /* ── Info bar ── */
  .info-bar {
    display: flex; gap: 0; padding: 0 14px 8px;
    margin-top: auto;
  }
  .info-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 0;
  }
  .info-val {
    font: 800 13px/1 'Inter', sans-serif; color: #333;
    font-variant-numeric: tabular-nums;
  }
  .info-lbl {
    font: 500 8px/1 'Inter', sans-serif;
    color: #bbb; text-transform: uppercase; letter-spacing: 0.04em;
  }

  /* ── Running meta ── */
  .run-meta {
    padding: 10px 14px; display: flex; flex-direction: column; gap: 6px;
    border-bottom: 1px solid #f5f5f5;
  }
  .run-topic {
    font: 600 12px/1.3 'Inter', sans-serif; color: #333;
  }
  .run-session {
    font: 400 10px/1 'SF Mono', monospace; color: #bbb;
  }
  .run-progress-bar {
    width: 100%; height: 4px; border-radius: 2px;
    background: #f0f0f0; overflow: hidden;
  }
  .run-progress-fill {
    height: 100%; border-radius: 2px;
    background: #D97757; transition: width 300ms ease;
  }
  .run-counts {
    display: flex; gap: 4px; align-items: center;
    font: 500 10px/1 'Inter', sans-serif; color: #999;
  }
  .sep { color: #ddd; }
  .keep-count { color: #27864a; }
  .crash-count { color: #c0392b; }

  /* ── Branch section ── */
  .branch-section {
    padding: 8px 14px; display: flex; flex-direction: column; gap: 4px;
  }
  .section-label {
    font: 600 9px/1 'Inter', sans-serif;
    color: #bbb; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .branch-list { display: flex; flex-direction: column; gap: 2px; }
  .branch-row {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 6px; border-radius: 5px;
    font: 500 11px/1.3 'Inter', sans-serif;
    transition: background 150ms;
  }
  .branch-row.best {
    background: rgba(39,134,74,0.04);
  }
  .branch-row.leaderboard { padding: 5px 6px; }
  .br-rank {
    font: 700 10px/1 'SF Mono', monospace;
    color: #bbb; min-width: 18px;
  }
  .br-name {
    color: #444; font-weight: 600;
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em;
  }
  .br-metric {
    font: 700 11px/1 'SF Mono', monospace;
    color: #27864a;
    font-variant-numeric: tabular-nums;
  }
  .br-stat {
    font: 400 9px/1 'Inter', sans-serif; color: #ccc;
    min-width: 30px; text-align: right;
  }
  .br-detail {
    font: 400 9px/1 'Inter', sans-serif; color: #bbb;
  }
  .br-active {
    color: #27864a; font-size: 6px;
    animation: pulse 2s ease-in-out infinite;
  }

  /* ── Best banner ── */
  .best-banner {
    display: flex; align-items: center; gap: 6px;
    margin: 4px 14px; padding: 6px 10px;
    background: rgba(212,160,23,0.04);
    border: 1px solid rgba(212,160,23,0.12);
    border-radius: 6px;
  }
  .best-icon { color: #d4a017; font-size: 12px; }
  .best-label {
    font: 600 10px/1 'Inter', sans-serif;
    color: #999; flex: 1;
  }
  .best-val {
    font: 800 13px/1 'SF Mono', monospace;
    color: #d4a017; font-variant-numeric: tabular-nums;
  }

  /* ── Submit section (running) ── */
  .submit-section {
    margin-top: auto;
    padding: 8px 14px;
    border-top: 1px solid #f5f5f5;
    display: flex; flex-direction: column; gap: 6px;
  }
  .submit-label {
    font: 600 9px/1 'Inter', sans-serif;
    color: #bbb; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .submit-row { display: flex; gap: 4px; }
  .submit-input {
    flex: 1; font: 400 11px/1 'Inter', sans-serif;
    color: #333; background: #fafafa;
    border: 1px solid #eee; border-radius: 6px;
    padding: 6px 10px; outline: none;
    transition: border-color 200ms;
  }
  .submit-input:focus { border-color: #D97757; }
  .submit-input::placeholder { color: #ccc; }
  .submit-hint {
    font: 400 10px/1 'Inter', sans-serif;
    color: #ddd;
  }

  /* ── Summary card (complete) ── */
  .summary-card {
    margin: 8px 14px;
    padding: 10px 12px;
    background: #fafafa;
    border-radius: 8px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .summary-title {
    font: 700 11px/1 'Inter', sans-serif;
    color: #666; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .summary-text {
    font: 400 11px/1.4 'Inter', sans-serif; color: #888;
  }
  .global-best {
    display: flex; align-items: center; gap: 6px;
    padding-top: 6px; border-top: 1px solid #eee;
    margin-top: 2px;
  }
  .gb-label {
    font: 600 9px/1 'Inter', sans-serif;
    color: #d4a017; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .gb-branch {
    font: 600 11px/1 'Inter', sans-serif; color: #444;
    text-transform: uppercase;
  }
  .gb-arrow { color: #ccc; font-size: 11px; }
  .gb-metric {
    font: 800 13px/1 'SF Mono', monospace;
    color: #27864a; font-variant-numeric: tabular-nums;
  }

  /* ── Next actions (complete) ── */
  .next-actions {
    padding: 8px 14px;
    margin-top: auto;
    display: flex; flex-direction: column; gap: 6px;
    border-top: 1px solid #f0f0f0;
  }
  .action-grid { display: flex; gap: 6px; }
  .next-btn {
    flex: 1; display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 7px;
    border: 1px solid #eee; background: #fff;
    cursor: pointer; transition: all 150ms;
    text-align: left;
  }
  .next-btn:hover { border-color: #D97757; background: rgba(217,119,87,0.02); }
  .next-icon {
    font: 600 16px/1 'Inter', sans-serif; color: #D97757;
    width: 24px; text-align: center;
  }
  .next-text { display: flex; flex-direction: column; gap: 1px; }
  .next-name { font: 600 11px/1 'Inter', sans-serif; color: #444; }
  .next-desc { font: 400 9px/1 'Inter', sans-serif; color: #bbb; }
  .click-hint {
    font: 400 10px/1 'Inter', sans-serif;
    color: #ddd; text-align: center; margin-top: 2px;
  }

  /* Deploy */
  .deploy-btn {
    width: 100%; padding: 10px;
    background: #D97757; color: #fff;
    border: none; border-radius: 7px;
    font: 600 12px/1 'Inter', sans-serif;
    cursor: pointer; transition: background 150ms;
    letter-spacing: 0.02em;
  }
  .deploy-btn:hover { background: #c56a4d; }
  .deploy-options {
    display: flex; flex-direction: column; gap: 4px;
  }
  .deploy-opt {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px;
    border: 1px solid #eee; background: #fff;
    cursor: pointer; transition: all 150ms;
    text-align: left;
  }
  .deploy-opt:hover { border-color: #D97757; background: rgba(217,119,87,0.03); }
  .do-icon { font-size: 16px; width: 24px; text-align: center; flex-shrink: 0; }
  .do-text { display: flex; flex-direction: column; gap: 1px; }
  .do-name { font: 600 11px/1 'Inter', sans-serif; color: #444; }
  .do-desc { font: 400 9px/1 'Inter', sans-serif; color: #bbb; }
  .deploy-back {
    padding: 4px 8px; border: none; background: none;
    font: 500 10px/1 'Inter', sans-serif; color: #bbb;
    cursor: pointer; align-self: flex-start;
  }
  .deploy-back:hover { color: #666; }

  /* Code editor */
  .code-section {
    padding: 8px 14px;
    border-top: 1px solid #f5f5f5;
    display: flex; flex-direction: column; gap: 4px;
  }
  .code-header {
    display: flex; align-items: center; gap: 6px;
  }
  .code-title {
    font: 700 10px/1 'SF Mono', 'Fira Code', monospace;
    color: #555;
  }
  .code-hint {
    font: 400 9px/1 'Inter', sans-serif;
    color: #bbb; flex: 1;
  }
  .code-toggle {
    font: 600 9px/1 'Inter', sans-serif;
    color: #D97757; background: rgba(217,119,87,0.06);
    border: none; border-radius: 4px;
    padding: 3px 8px; cursor: pointer;
    transition: all 150ms;
  }
  .code-toggle:hover { background: rgba(217,119,87,0.12); }
  .code-editor {
    font: 400 11px/1.5 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    color: #333; background: #f8f7f6;
    border: 1px solid #eee; border-radius: 6px;
    padding: 8px 10px; resize: vertical;
    outline: none; tab-size: 2;
    transition: border-color 200ms;
  }
  .code-editor:focus { border-color: #D97757; }
  .code-actions {
    display: flex; align-items: center; gap: 8px;
  }
  .action-btn.retrain {
    background: #27864a; color: #fff;
    padding: 7px 14px; border-radius: 6px;
    font: 600 11px/1 'Inter', sans-serif;
    border: none; cursor: pointer;
    transition: background 150ms;
  }
  .action-btn.retrain:hover { background: #1f6e3c; }

  /* ── Owl sections ── */
  .owl-greeting {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 14px 6px;
  }
  .owl-greeting :global(.pixel-owl) {
    flex-shrink: 0;
  }
  .owl-speech {
    display: flex; flex-direction: column; gap: 2px;
  }
  .owl-msg {
    font: 700 12px/1.2 'Inter', sans-serif;
    color: #444;
  }
  .owl-sub {
    font: 400 10px/1.2 'Inter', sans-serif;
    color: #aaa;
  }
  .owl-mini {
    width: 20px; height: 20px;
    overflow: hidden; border-radius: 4px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .owl-mini :global(.pixel-owl) {
    transform: translate(-50%, -50%);
    position: relative; left: 50%; top: 50%;
  }
  .owl-celebrate {
    display: flex; justify-content: center;
    padding: 12px 14px 4px;
  }
</style>

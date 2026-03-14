<script lang="ts">
  import { onMount } from "svelte";
  import { router } from "../stores/router.ts";
  import { jobStore } from "../stores/jobStore.ts";
  import {
    createFixturePlayback,
    demoFixtureText,
    parseNdjson,
  } from "../utils/fixturePlayer.ts";
  import {
    buildScaledNodes,
    isWorkerActiveState,
    oscillate01,
    smoothPulse,
  } from "../utils/meshSim.ts";
  import type { VisualizerModel } from "../utils/types.ts";
  import { TOPIC_SUGGESTIONS } from "../data/topicSuggestions.ts";

  import MeshCanvas from "../components/MeshCanvas.svelte";
  import HeroSection from "../components/HeroSection.svelte";
  import StatusPanel from "../components/StatusPanel.svelte";
  import { DEMO_JOBS } from "../data/dashboardFixture.ts";
  import type { DashboardJob, ResearchMetrics, SystemMetrics } from "../data/dashboardFixture.ts";
  import { keepCount, completedCount, qualityScore } from "../stores/jobStore.ts";
  import { PPAP_STAGES } from "../data/protocolData.ts";
  import { wallet, WALLET_OPTIONS } from "../stores/walletStore.ts";

  // ── Models summary (top 3) ──
  const TOP_MODELS = [
    { name: 'Crypto Market 24h', metric: '1.231 bpb', type: 'Transformer', downloads: 1243 },
    { name: 'Token Sentiment', metric: '91.2% F1', type: 'BERT-tiny', downloads: 3420 },
    { name: 'MEV Detection', metric: '96.8% AUC', type: 'LightGBM', downloads: 2180 },
  ];

  // ── Protocol summary ──
  const PROTOCOL_STATS = {
    tvl: '$12.4M',
    burned: '847K',
    activeBonds: '2,341',
    trustScore: 847,
    mau: '892 / 1,443',
  };

  let searchQuery = "";
  let mounted = false;
  let destroyed = false;

  const topicSuggestions = TOPIC_SUGGESTIONS;

  const events = parseNdjson(demoFixtureText);
  const playback = createFixturePlayback(events);
  const emptyModel: VisualizerModel = { workers: [], nodes: [], jobs: [], tape: [] };

  let frameIndex = playback.length > 0 ? 0 : -1;
  let meshSimulationTime = 0;
  let meshPopulationDisplayed = 0;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  $: fixtureModel = playback[Math.max(frameIndex, 0)] ?? emptyModel;
  $: model = fixtureModel;
  $: meshPopulationCeiling = model.nodes.length === 0 ? 0 : clamp(Math.max(3200, model.nodes.length * 660), 2200, 5600);
  $: meshPopulationTarget = (() => {
    if (model.nodes.length === 0) return 0;
    const lw = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
    const sw = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
    return Math.round(model.nodes.length + meshPopulationCeiling * clamp(0.07 + lw * 0.72 + sw * 0.12, 0.07, 0.97));
  })();
  $: renderNodes = buildScaledNodes(model.nodes, model.jobs, meshPopulationDisplayed, meshPopulationCeiling, meshSimulationTime);

  // ── Live metrics ──
  $: activeWorkers = model.workers.filter(w => isWorkerActiveState(w.state));
  $: totalNodes = model.nodes.length;

  $: liveJobs = (() => {
    const base: DashboardJob[] = [...DEMO_JOBS];
    if ($jobStore.phase !== 'idle' && $jobStore.topic) {
      const existing = base.find(j => j.topic === $jobStore.topic);
      if (!existing) {
        const completedExps = $jobStore.experiments.filter(e =>
          e.status === 'keep' || e.status === 'discard' || e.status === 'crash'
        ).length;
        const progress = $jobStore.totalExperiments > 0
          ? Math.round((completedExps / $jobStore.totalExperiments) * 100)
          : 0;
        base.unshift({
          id: 'job-active',
          topic: $jobStore.topic,
          status: $jobStore.phase === 'complete' ? 'complete' : 'running',
          progress,
          metric: $jobStore.bestMetric === Infinity ? 0 : $jobStore.bestMetric,
          metricLabel: 'bpb',
          findings: $keepCount,
          startedAt: $jobStore.startedAt,
        });
      }
    }
    return base;
  })();

  $: runningCount = liveJobs.filter(j => j.status === 'running').length;
  $: doneCount = liveJobs.filter(j => j.status === 'complete').length;

  let liveResearch: ResearchMetrics;
  $: liveResearch = {
    activeJobs: liveJobs.filter(j => j.status === 'running').length + liveJobs.filter(j => j.status === 'queued').length,
    activeAgents: activeWorkers.length || 2,
    configsTested: $jobStore.phase !== 'idle'
      ? `${$completedCount}/${$jobStore.totalExperiments}`
      : `${model.jobs.reduce((acc, j) => acc + j.workerIds.length, 0) || 12}/60`,
    findings: $keepCount || liveJobs.reduce((acc, j) => acc + j.findings, 0),
    hitRate: $qualityScore || 42,
  };

  let liveSystem: SystemMetrics;
  $: liveSystem = {
    nodes: totalNodes || 8,
    cpuCores: 32,
    cpuUsage: totalNodes > 0
      ? Math.round((activeWorkers.length / Math.max(1, model.workers.length)) * 100)
      : 85,
    memUsedGb: Math.round(Math.max(8, totalNodes * 3)),
    memTotalGb: 128,
    vramUsedGb: Math.round(Math.max(12, activeWorkers.length * 8)),
    vramTotalGb: 96,
    activeFlows: model.jobs.length || 1,
  };

  // Job helpers
  function statusIcon(s: DashboardJob['status']): string {
    switch (s) { case 'running': return '●'; case 'complete': return '✓'; case 'queued': return '◐'; }
  }
  function statusColor(s: DashboardJob['status']): string {
    switch (s) { case 'running': return 'var(--accent)'; case 'complete': return 'var(--green)'; case 'queued': return 'var(--text-muted)'; }
  }
  function elapsed(startedAt: number): string {
    const mins = Math.floor((Date.now() - startedAt) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}h${rm > 0 ? String(rm).padStart(2, '0') : ''}`;
  }

  function handleSearch(e: CustomEvent<string>) {
    const topic = e.detail;
    jobStore.startJob(topic);
    router.navigate("research", { topic });
  }
  function handleTopic(e: CustomEvent<string>) {
    searchQuery = e.detail;
    jobStore.startJob(e.detail);
    router.navigate("research", { topic: e.detail });
  }

  onMount(() => {
    mounted = true;
    meshPopulationDisplayed = model.nodes.length;

    let dwellCount = 0;
    const fixtureInterval = setInterval(() => {
      if (playback.length <= 1) return;
      if (frameIndex < 0) { frameIndex = 0; return; }
      if (frameIndex >= playback.length - 1) {
        dwellCount += 1;
        if (dwellCount >= 3) { dwellCount = 0; frameIndex = 0; }
        return;
      }
      frameIndex += 1;
    }, 2800);

    const tickInterval = setInterval(() => {
      meshSimulationTime += 0.5;
      const floor = model.nodes.length;
      const cur = Math.max(meshPopulationDisplayed, floor);
      if (cur !== meshPopulationTarget) {
        const step = Math.max(3, Math.ceil(Math.abs(meshPopulationTarget - cur) * 0.03));
        meshPopulationDisplayed = cur < meshPopulationTarget
          ? Math.min(meshPopulationTarget, cur + step)
          : Math.max(meshPopulationTarget, cur - step);
      }
    }, 500);

    return () => {
      destroyed = true;
      clearInterval(fixtureInterval);
      clearInterval(tickInterval);
    };
  });
</script>

<div class="home" class:mounted data-theme="light">
  <!-- Globe background -->
  <div class="dash-globe">
    <MeshCanvas nodes={renderNodes} jobs={model.jobs} workers={model.workers} viewerLocation={{ lat: 37.57, lng: 126.98 }} />
  </div>

  <!-- ═══════════ Network Health Bar — platform info, always visible ═══════════ -->
  <button class="dash-net-bar" on:click={() => router.navigate('network')}>
    <span class="dash-net-dot"></span>
    <span class="dash-net-label">HOOT NETWORK</span>
    <span class="dash-net-sep">·</span>
    <span class="dash-net-stat"><strong>{liveSystem.nodes}</strong> Nodes</span>
    <span class="dash-net-sep">·</span>
    <span class="dash-net-stat"><strong>{Math.ceil(liveSystem.nodes / 2)}×</strong> GPU</span>
    <span class="dash-net-sep">·</span>
    <span class="dash-net-stat">CPU <strong>{liveSystem.cpuUsage}%</strong></span>
    <span class="dash-net-sep">·</span>
    <span class="dash-net-stat"><strong>{liveSystem.memUsedGb}/{liveSystem.memTotalGb}G</strong> Mem</span>
    <span class="dash-net-sep">·</span>
    <span class="dash-net-stat"><strong>{liveSystem.vramUsedGb}/{liveSystem.vramTotalGb}G</strong> VRAM</span>
    <span class="dash-net-arrow">→</span>
  </button>

  {#if $wallet.connected}
    <!-- ═══════════ LOGGED IN: Command Center ═══════════ -->
    <div class="dash-wrap">
      <div class="dash-greeting">
        <span class="dash-greeting-dot"></span>
        <span class="dash-greeting-addr">{$wallet.address}</span>
        <span class="dash-greeting-name">via {$wallet.name}</span>
      </div>

      <div class="dash-split">
        <!-- LEFT: Editor (sticky) -->
        <div class="dash-left">
          <HeroSection
            bind:searchQuery
            {topicSuggestions}
            on:search={handleSearch}
            on:topic={handleTopic}
          />
        </div>

        <!-- RIGHT: Status + Jobs + Network -->
        <div class="dash-right">
          <!-- ── MY RESEARCH ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">MY RESEARCH</span>
            <span class="dash-section-line"></span>
          </div>
          <StatusPanel
            research={liveResearch}
            {runningCount}
            {doneCount}
          />

          <div class="dr-cols">
            <div class="dr-card dr-jobs-list">
              <div class="dr-head">
                <span class="dr-label">Research Jobs</span>
                <span class="dr-count">{liveJobs.length}</span>
              </div>
              {#each liveJobs as job (job.id)}
                <button class="dr-row" on:click={() => router.navigate('research', { topic: job.topic })}>
                  <span class="dr-icon" style:color={statusColor(job.status)}>{statusIcon(job.status)}</span>
                  <span class="dr-name">{job.topic}</span>
                </button>
              {/each}
            </div>

            <div class="dr-detail">
              {#each liveJobs as job (job.id)}
                <button class="dm-job" on:click={() => router.navigate('research', { topic: job.topic })}>
                  <span class="dm-job-icon" style:color={statusColor(job.status)}>{statusIcon(job.status)}</span>
                  <span class="dm-job-topic">{job.topic}</span>
                  {#if job.metric > 0}
                    <span class="dm-job-metric">{(job.metric * 100).toFixed(1)}%</span>
                  {/if}
                  <span class="dm-job-badge" class:dm-badge-done={job.status === 'complete'} class:dm-badge-run={job.status === 'running'}>
                    {job.status === 'complete' ? 'COMPLETED' : job.status === 'running' ? `${job.progress}%` : 'QUEUED'}
                  </span>
                </button>
              {/each}

              <div class="dm-panels">
                <div class="dm-panel">
                  <div class="dm-panel-head">All Findings</div>
                  <div class="dm-panel-body">
                    {#each liveJobs.filter(j => j.findings > 0) as job}
                      <button class="dm-finding" on:click={() => router.navigate('research', { topic: job.topic })}>
                        <span>{job.topic}</span>
                        <span class="dm-finding-val">{job.findings} finds</span>
                      </button>
                    {/each}
                    {#if liveJobs.filter(j => j.findings > 0).length === 0}
                      <span class="dm-empty">No findings yet</span>
                    {/if}
                  </div>
                </div>
                <div class="dm-panel">
                  <div class="dm-panel-head">Event Log</div>
                  <div class="dm-panel-body">
                    <div class="dm-log">
                      <span class="dm-log-time">{new Date().toLocaleTimeString('en-GB')}</span>
                      <span class="dm-log-type">SYSTEM</span>
                      <span>Connected. {liveJobs.length} existing jobs loaded.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── MY PORTFOLIO ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">MY PORTFOLIO</span>
            <span class="dash-section-line"></span>
          </div>
          <div class="dr-portfolio-row">
            <div class="dr-card">
              <div class="dr-head">
                <span class="dr-label">Models</span>
                <span class="dr-count">6</span>
                <button class="dr-link" on:click={() => router.navigate('models')}>→</button>
              </div>
              <div class="dr-models">
                {#each TOP_MODELS as m}
                  <button class="dr-model-row" on:click={() => router.navigate('model-detail')}>
                    <span class="dr-model-info">
                      <span class="dr-model-name">{m.name}</span>
                      <span class="dr-model-type">{m.type} · {m.downloads.toLocaleString()} ↓</span>
                    </span>
                    <span class="dr-model-metric">{m.metric}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="dr-card">
              <div class="dr-head">
                <span class="dr-label">My Bonds</span>
                <button class="dr-link" on:click={() => router.navigate('protocol')}>→</button>
              </div>
              <div class="dr-bonds">
                <div class="dr-bond-row">
                  <span class="dr-bond-dot" style:background="var(--green)"></span>
                  <span class="dr-bond-info">
                    <span class="dr-bond-name">seoul-4090</span>
                    <span class="dr-bond-tier">Standard · 2,000 HOOT</span>
                  </span>
                  <span class="dr-bond-badge dr-bond-active">ACTIVE</span>
                </div>
                <div class="dr-bond-row">
                  <span class="dr-bond-dot" style:background="var(--gold)"></span>
                  <span class="dr-bond-info">
                    <span class="dr-bond-name">berlin-a100</span>
                    <span class="dr-bond-tier">Enterprise · 10,000 HOOT</span>
                  </span>
                  <span class="dr-bond-badge dr-bond-unbond">4d LEFT</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── ECOSYSTEM ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">ECOSYSTEM</span>
            <span class="dash-section-line"></span>
          </div>
          <button class="dr-card dr-card-btn" on:click={() => router.navigate('protocol')}>
            <div class="dr-head">
              <span class="dr-label">Protocol Health</span>
              <span class="dr-link-icon">→</span>
            </div>
            <div class="dr-eco">
              <div class="dr-eco-stats">
                <div class="dr-eco-stat">
                  <span class="dr-eco-val">{PROTOCOL_STATS.tvl}</span>
                  <span class="dr-eco-key">TVL</span>
                </div>
                <div class="dr-eco-stat">
                  <span class="dr-eco-val">{PROTOCOL_STATS.burned}</span>
                  <span class="dr-eco-key">Burned</span>
                </div>
                <div class="dr-eco-stat">
                  <span class="dr-eco-val">{PROTOCOL_STATS.activeBonds}</span>
                  <span class="dr-eco-key">Bonds</span>
                </div>
                <div class="dr-eco-stat">
                  <span class="dr-eco-val">{PROTOCOL_STATS.trustScore}</span>
                  <span class="dr-eco-key">Trust</span>
                </div>
                <div class="dr-eco-stat">
                  <span class="dr-eco-val">{PROTOCOL_STATS.mau}</span>
                  <span class="dr-eco-key">MAU</span>
                </div>
              </div>
              <div class="dr-eco-ppap">
                <span class="dr-eco-ppap-label">PPAP</span>
                <div class="dr-eco-ppap-stages">
                  {#each PPAP_STAGES as stage, i}
                    <span class="dr-eco-ppap-stage" style:color={stage.color}>{stage.icon}</span>
                    {#if i < PPAP_STAGES.length - 1}
                      <span class="dr-eco-ppap-arrow">→</span>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

  {:else}
    <!-- ═══════════ LOGGED OUT: Landing Page ═══════════ -->
    <div class="dash-wrap">
      <h1 class="dash-headline">
        Turn any idea into<br/>a specialized AI model.
      </h1>
      <p class="dash-sub">
        Describe your research goal. HOOT builds and trains the model autonomously.
      </p>

      <div class="dash-split">
        <!-- LEFT: Editor -->
        <div class="dash-left">
          <HeroSection
            bind:searchQuery
            {topicSuggestions}
            on:search={handleSearch}
            on:topic={handleTopic}
          />
        </div>

        <!-- RIGHT: Onboarding flow -->
        <div class="dash-right">
          <!-- ── GET STARTED ── -->
          <div class="lp-connect">
            <div class="lp-connect-head">
              <span class="lp-connect-title">Get Started</span>
              <span class="lp-connect-sub">Connect your wallet to access the full command center</span>
            </div>
            <div class="lp-wallets">
              {#each WALLET_OPTIONS as w}
                <button class="lp-wallet-btn" on:click={() => wallet.connect(w.name)}>
                  <span class="lp-wallet-icon">{w.icon}</span>
                  <span class="lp-wallet-name">{w.name}</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- ── PROVEN RESULTS ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">PROVEN RESULTS</span>
            <span class="dash-section-line"></span>
          </div>
          <div class="lp-proof">
            <div class="lp-proof-nums">
              <div class="lp-proof-stat">
                <span class="lp-proof-val" style:color="var(--accent)">0.9851</span>
                <span class="lp-proof-delta" style:color="var(--green)">+3.7%</span>
                <span class="lp-proof-key">Balanced Accuracy</span>
              </div>
              <div class="lp-proof-stat">
                <span class="lp-proof-val" style:color="var(--green)">FN = 0</span>
                <span class="lp-proof-delta" style:color="var(--green)">-100%</span>
                <span class="lp-proof-key">False Negatives</span>
              </div>
              <div class="lp-proof-stat">
                <span class="lp-proof-val">5,000+</span>
                <span class="lp-proof-delta">autonomous</span>
                <span class="lp-proof-key">Configs Explored</span>
              </div>
            </div>
            <div class="lp-proof-bars">
              <div class="lp-bar-row">
                <span class="lp-bar-name">Rule-based Pipeline</span>
                <div class="lp-bar-track"><div class="lp-bar-fill" style:width="95%"></div></div>
                <span class="lp-bar-v">0.9499</span>
              </div>
              <div class="lp-bar-row">
                <span class="lp-bar-name">HOOT Autoresearch</span>
                <div class="lp-bar-track"><div class="lp-bar-fill lp-bar-best" style:width="98.5%"></div></div>
                <span class="lp-bar-v lp-bar-hi">0.9851</span>
              </div>
            </div>
          </div>

          <!-- ── HOW IT WORKS ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">HOW IT WORKS</span>
            <span class="dash-section-line"></span>
          </div>
          <div class="lp-steps">
            <div class="lp-step">
              <span class="lp-step-num">1</span>
              <div class="lp-step-text">
                <span class="lp-step-title">Describe</span>
                <span class="lp-step-desc">Write your research goal in natural language</span>
              </div>
            </div>
            <div class="lp-step">
              <span class="lp-step-num">2</span>
              <div class="lp-step-text">
                <span class="lp-step-title">Train</span>
                <span class="lp-step-desc">Agents explore thousands of configs autonomously</span>
              </div>
            </div>
            <div class="lp-step">
              <span class="lp-step-num">3</span>
              <div class="lp-step-text">
                <span class="lp-step-title">Collect</span>
                <span class="lp-step-desc">Get a purpose-built AI model with verified research</span>
              </div>
            </div>
          </div>

          <!-- ── ECOSYSTEM ── -->
          <div class="dash-section">
            <span class="dash-section-line"></span>
            <span class="dash-section-label">ECOSYSTEM</span>
            <span class="dash-section-line"></span>
          </div>
          <div class="lp-eco">
            <div class="lp-eco-stat">
              <span class="lp-eco-val">{PROTOCOL_STATS.tvl}</span>
              <span class="lp-eco-key">TVL</span>
            </div>
            <div class="lp-eco-stat">
              <span class="lp-eco-val">{PROTOCOL_STATS.burned}</span>
              <span class="lp-eco-key">Burned</span>
            </div>
            <div class="lp-eco-stat">
              <span class="lp-eco-val">{PROTOCOL_STATS.activeBonds}</span>
              <span class="lp-eco-key">Active Bonds</span>
            </div>
            <div class="lp-eco-stat">
              <span class="lp-eco-val">{PROTOCOL_STATS.mau}</span>
              <span class="lp-eco-key">MAU Target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .home {
    opacity: 0; transition: opacity 600ms ease;
    -webkit-font-smoothing: antialiased;
    background: var(--page-bg, #FAF9F7);
    min-height: 100vh;
    position: relative;
  }
  .home.mounted { opacity: 1; }

  :global(.px-icon) {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  /* ── Globe bg (subtle) ── */
  .dash-globe {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    opacity: 0.08;
    pointer-events: none;
    filter: saturate(0.3) sepia(0.1);
    z-index: 0;
  }

  /* ── Wrapper ── */
  .dash-wrap {
    position: relative;
    z-index: 1;
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px 20px 32px;
    animation: fadeUp 600ms cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Headline (full-width above split) ── */
  .dash-headline {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 8px;
  }
  .dash-sub {
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text-secondary, #6b6560);
    margin: 0 0 16px;
  }

  /* ── Greeting bar (logged in) ── */
  .dash-greeting {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 14px;
  }
  .dash-greeting-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39,134,74,0.4);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .dash-greeting-addr {
    font-family: var(--font-mono);
    font-size: 0.72rem; font-weight: 700;
    color: var(--text-primary);
  }
  .dash-greeting-name {
    font-family: var(--font-mono);
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
  }

  /* ── 2-column split: 40% / 60% ── */
  .dash-split {
    display: grid;
    grid-template-columns: 2fr 3fr;
    gap: 16px;
    align-items: start;
  }

  /* ── Left: Editor (sticky) ── */
  .dash-left {
    position: sticky;
    top: 16px;
    min-width: 0;
  }

  /* ── Right: Panels stack ── */
  .dash-right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  /* ── Shared card ── */
  .dr-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    overflow: hidden;
  }
  .dr-head {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015);
  }
  .dr-label {
    font-family: var(--font-mono);
    font-size: 0.52rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    flex: 1;
  }
  .dr-count {
    font-family: var(--font-mono);
    font-size: 0.44rem; font-weight: 700;
    color: var(--accent, #D97757);
    background: rgba(217,119,87,0.06);
    border: 1px solid rgba(217,119,87,0.12);
    padding: 0 5px; border-radius: 100px;
  }
  .dr-link {
    appearance: none; border: none; background: none;
    font-size: 0.72rem; font-weight: 700;
    color: var(--accent, #D97757);
    cursor: pointer; padding: 0 4px;
    transition: transform 150ms;
  }
  .dr-link:hover { transform: translateX(2px); }

  /* ── Sub 2-column: job list + detail ── */
  .dr-cols {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 10px;
  }

  /* ── Job list sidebar (compact) ── */
  .dr-jobs-list { align-self: start; }
  .dr-row {
    appearance: none; border: none;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    display: flex; align-items: center; gap: 6px;
    padding: 7px 12px;
    background: transparent;
    cursor: pointer; text-align: left;
    transition: background 150ms;
    width: 100%;
  }
  .dr-row:last-child { border-bottom: none; }
  .dr-row:hover { background: rgba(0,0,0,0.02); }
  .dr-icon { font-size: 0.5rem; flex-shrink: 0; }
  .dr-name {
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── Job detail cards ── */
  .dr-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dm-job {
    appearance: none; width: 100%; text-align: left; cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    transition: border-color 150ms, box-shadow 150ms;
  }
  .dm-job:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 2px 8px rgba(217,119,87,0.1);
  }
  .dm-job-icon { font-size: 0.55rem; flex-shrink: 0; }
  .dm-job-topic {
    font-size: 0.68rem; font-weight: 600;
    color: var(--text-primary);
    flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-job-metric {
    font-family: var(--font-mono);
    font-size: 0.74rem; font-weight: 700;
    color: var(--green, #27864a); flex-shrink: 0;
  }
  .dm-job-badge {
    font-family: var(--font-mono);
    font-size: 0.42rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 100px; flex-shrink: 0;
    color: var(--text-muted); background: rgba(0,0,0,0.03);
    border: 1px solid rgba(0,0,0,0.06);
  }
  .dm-badge-done {
    color: var(--green, #27864a);
    background: rgba(39,134,74,0.06);
    border-color: rgba(39,134,74,0.12);
  }
  .dm-badge-run {
    color: var(--accent, #D97757);
    background: rgba(217,119,87,0.06);
    border-color: rgba(217,119,87,0.12);
  }

  /* ── Findings + Event Log panels ── */
  .dm-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .dm-panel {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    overflow: hidden;
  }
  .dm-panel-head {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015);
    font-family: var(--font-mono);
    font-size: 0.5rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
  }
  .dm-panel-body { padding: 8px 12px; }
  .dm-finding {
    appearance: none; border: none; width: 100%; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    padding: 3px 0;
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-primary); background: transparent;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    transition: color 150ms;
  }
  .dm-finding:hover { color: var(--accent, #D97757); }
  .dm-finding:last-child { border-bottom: none; }
  .dm-finding-val {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 600;
    color: var(--text-muted);
  }
  .dm-empty {
    font-size: 0.58rem; color: var(--text-muted);
  }
  .dm-log {
    display: flex; align-items: baseline; gap: 8px;
    font-size: 0.54rem; color: var(--text-secondary);
  }
  .dm-log-time {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 600;
    color: var(--text-muted); flex-shrink: 0;
  }
  .dm-log-type {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 700;
    color: var(--blue, #2980b9); flex-shrink: 0;
  }

  /* ── Network Health Bar (platform info, top strip) ── */
  .dash-net-bar {
    position: relative; z-index: 1;
    appearance: none; border: none;
    display: flex; align-items: center; gap: 8px;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 8px 20px;
    background: rgba(39,134,74,0.04);
    border-bottom: 1px solid rgba(39,134,74,0.1);
    cursor: pointer;
    transition: background 150ms;
  }
  .dash-net-bar:hover { background: rgba(39,134,74,0.07); }
  .dash-net-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 6px rgba(39,134,74,0.4);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .dash-net-label {
    font-family: var(--font-mono);
    font-size: 0.5rem; font-weight: 800;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--green, #27864a);
    white-space: nowrap;
  }
  .dash-net-sep { font-size: 0.5rem; color: rgba(39,134,74,0.2); }
  .dash-net-stat {
    font-family: var(--font-mono);
    font-size: 0.54rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }
  .dash-net-stat :global(strong) {
    font-weight: 700; color: var(--text-primary);
  }
  .dash-net-arrow {
    font-size: 0.72rem; font-weight: 700;
    color: var(--green, #27864a);
    margin-left: auto;
    transition: transform 150ms;
    flex-shrink: 0;
  }
  .dash-net-bar:hover .dash-net-arrow { transform: translateX(2px); }

  /* ── Section dividers ── */
  .dash-section {
    display: flex; align-items: center; gap: 10px;
    margin-top: 4px;
  }
  .dash-section-line {
    flex: 1; height: 1px;
    background: var(--border-subtle, #EDEAE5);
  }
  .dash-section-label {
    font-family: var(--font-mono);
    font-size: 0.46rem; font-weight: 800;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }

  /* ── Portfolio row: Models + Bonds ── */
  .dr-portfolio-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  /* ── Clickable card (whole card) ── */
  .dr-card-btn {
    appearance: none; width: 100%; text-align: left;
    cursor: pointer; transition: border-color 150ms, box-shadow 150ms;
  }
  .dr-card-btn:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 2px 8px rgba(217,119,87,0.1);
  }
  .dr-link-icon {
    font-size: 0.72rem; font-weight: 700;
    color: var(--accent, #D97757);
    transition: transform 150ms;
  }
  .dr-card-btn:hover .dr-link-icon { transform: translateX(2px); }

  /* ── Models section ── */
  .dr-models { padding: 0; }
  .dr-model-row {
    appearance: none; border: none; width: 100%; text-align: left;
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 14px; background: transparent; cursor: pointer;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
    transition: background 150ms;
  }
  .dr-model-row:last-child { border-bottom: none; }
  .dr-model-row:hover { background: rgba(0,0,0,0.02); }
  .dr-model-info {
    display: flex; flex-direction: column; gap: 1px;
    min-width: 0;
  }
  .dr-model-name {
    font-size: 0.58rem; font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dr-model-type {
    font-family: var(--font-mono);
    font-size: 0.4rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
  }
  .dr-model-metric {
    font-family: var(--font-mono);
    font-size: 0.52rem; font-weight: 700;
    color: var(--green, #27864a);
    flex-shrink: 0; margin-left: 8px;
  }

  /* ── Bonds section ── */
  .dr-bonds { padding: 0; }
  .dr-bond-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .dr-bond-row:last-child { border-bottom: none; }
  .dr-bond-dot {
    width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0;
  }
  .dr-bond-info {
    display: flex; flex-direction: column; gap: 1px;
    flex: 1; min-width: 0;
  }
  .dr-bond-name {
    font-size: 0.6rem; font-weight: 600;
    color: var(--text-primary);
  }
  .dr-bond-tier {
    font-family: var(--font-mono);
    font-size: 0.4rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
  }
  .dr-bond-badge {
    font-family: var(--font-mono);
    font-size: 0.4rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 100px;
    flex-shrink: 0;
  }
  .dr-bond-active {
    color: var(--green, #27864a);
    background: rgba(39,134,74,0.06);
    border: 1px solid rgba(39,134,74,0.12);
  }
  .dr-bond-unbond {
    color: var(--gold, #d4a017);
    background: rgba(212,160,23,0.06);
    border: 1px solid rgba(212,160,23,0.12);
  }

  /* ── Ecosystem / Protocol Health card ── */
  .dr-eco { padding: 10px 14px; }
  .dr-eco-stats {
    display: flex; gap: 16px; flex-wrap: wrap;
  }
  .dr-eco-stat {
    display: flex; flex-direction: column; gap: 1px;
  }
  .dr-eco-val {
    font-family: var(--font-mono);
    font-size: 0.72rem; font-weight: 700;
    color: var(--text-primary);
  }
  .dr-eco-key {
    font-family: var(--font-mono);
    font-size: 0.38rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
  }
  .dr-eco-ppap {
    display: flex; align-items: center; gap: 8px;
    margin-top: 10px; padding-top: 8px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .dr-eco-ppap-label {
    font-family: var(--font-mono);
    font-size: 0.42rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }
  .dr-eco-ppap-stages {
    display: flex; align-items: center; gap: 4px;
  }
  .dr-eco-ppap-stage { font-size: 0.7rem; }
  .dr-eco-ppap-arrow {
    font-size: 0.48rem;
    color: var(--border, #E5E0DA);
  }

  /* ── Landing: Connect CTA ── */
  .lp-connect {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    overflow: hidden;
  }
  .lp-connect-head {
    padding: 14px 16px 10px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .lp-connect-title {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem; font-weight: 700;
    color: var(--text-primary);
  }
  .lp-connect-sub {
    font-size: 0.56rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
  }
  .lp-wallets {
    display: flex; gap: 8px;
    padding: 0 16px 14px;
  }
  .lp-wallet-btn {
    appearance: none; border: 1px solid var(--border, #E5E0DA);
    flex: 1;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 8px;
    border-radius: 8px;
    background: var(--page-bg, #FAF9F7);
    cursor: pointer;
    transition: border-color 150ms, box-shadow 150ms, background 150ms;
  }
  .lp-wallet-btn:hover {
    border-color: var(--accent, #D97757);
    box-shadow: 0 2px 8px rgba(217,119,87,0.1);
    background: #fff;
  }
  .lp-wallet-icon { font-size: 1rem; }
  .lp-wallet-name {
    font-family: var(--font-mono);
    font-size: 0.56rem; font-weight: 700;
    color: var(--text-primary);
  }

  /* ── Landing: Proof / Benchmark ── */
  .lp-proof {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    padding: 14px 16px;
  }
  .lp-proof-nums {
    display: flex; gap: 16px; margin-bottom: 12px;
  }
  .lp-proof-stat {
    display: flex; flex-direction: column; gap: 1px;
  }
  .lp-proof-val {
    font-family: var(--font-mono);
    font-size: 0.88rem; font-weight: 700;
    line-height: 1; color: var(--text-primary);
  }
  .lp-proof-delta {
    font-family: var(--font-mono);
    font-size: 0.42rem; font-weight: 600;
    color: var(--text-muted);
  }
  .lp-proof-key {
    font-family: var(--font-mono);
    font-size: 0.38rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }
  .lp-proof-bars {
    display: flex; flex-direction: column; gap: 6px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .lp-bar-row {
    display: flex; align-items: center; gap: 8px;
  }
  .lp-bar-name {
    font-family: var(--font-mono);
    font-size: 0.44rem; font-weight: 600;
    color: var(--text-muted, #9a9590);
    width: 100px; flex-shrink: 0;
  }
  .lp-bar-track {
    flex: 1; height: 6px; border-radius: 3px;
    background: rgba(0,0,0,0.04);
    overflow: hidden;
  }
  .lp-bar-fill {
    height: 100%; border-radius: 3px;
    background: var(--border, #E5E0DA);
  }
  .lp-bar-best { background: var(--accent, #D97757); }
  .lp-bar-v {
    font-family: var(--font-mono);
    font-size: 0.48rem; font-weight: 700;
    color: var(--text-muted, #9a9590);
    width: 36px; text-align: right; flex-shrink: 0;
  }
  .lp-bar-hi { color: var(--accent, #D97757); }

  /* ── Landing: Steps ── */
  .lp-steps {
    display: flex; flex-direction: column; gap: 6px;
  }
  .lp-step {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 14px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
  }
  .lp-step-num {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 1.1rem; font-weight: 700;
    color: var(--accent, #D97757);
    line-height: 1; flex-shrink: 0;
    width: 20px; text-align: center;
  }
  .lp-step-text {
    display: flex; flex-direction: column; gap: 2px;
  }
  .lp-step-title {
    font-size: 0.68rem; font-weight: 700;
    color: var(--text-primary);
  }
  .lp-step-desc {
    font-size: 0.54rem; font-weight: 500;
    color: var(--text-muted, #9a9590);
    line-height: 1.4;
  }

  /* ── Landing: Ecosystem stats ── */
  .lp-eco {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));
    overflow: hidden;
  }
  .lp-eco-stat {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px; padding: 14px 8px;
    border-right: 1px solid var(--border-subtle, #EDEAE5);
  }
  .lp-eco-stat:last-child { border-right: none; }
  .lp-eco-val {
    font-family: var(--font-mono);
    font-size: 0.78rem; font-weight: 700;
    line-height: 1; color: var(--text-primary);
  }
  .lp-eco-key {
    font-family: var(--font-mono);
    font-size: 0.38rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .dash-split { grid-template-columns: 1fr; }
    .dash-left { position: static; }
  }
  @media (max-width: 768px) {
    .dr-cols { grid-template-columns: 1fr; }
    .dm-panels { grid-template-columns: 1fr; }
    .dr-portfolio-row { grid-template-columns: 1fr; }
    .dash-net-bar { flex-wrap: wrap; gap: 4px 8px; }
  }
  @media (max-width: 600px) {
    .dash-wrap { padding: 12px 12px 24px; }
    .dash-headline { font-size: 1.8rem; }
  }
</style>

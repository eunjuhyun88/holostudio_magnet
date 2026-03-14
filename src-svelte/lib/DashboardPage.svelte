<script lang="ts">
  import { onMount } from "svelte";
  import { router } from "./router.ts";
  import { jobStore } from "./jobStore.ts";
  import MeshCanvas from "./MeshCanvas.svelte";
  import PixelOwl from "./PixelOwl.svelte";
  import {
    createFixturePlayback,
    demoFixtureText,
    parseNdjson,
  } from "../../src/fixed/fixturePlayer.ts";
  import {
    buildScaledNodes,
    isWorkerActiveState,
    oscillate01,
    smoothPulse,
  } from "../../src/core/meshSim.ts";
  import type { VisualizerModel } from "../../src/fixed/types.ts";

  let searchQuery = "";
  let mounted = false;

  let scrollY = 0;

  let statsVisible = false;
  let statsEl: HTMLElement;
  let displayNodes = 0;
  let displayGpu = 0;
  let displayWorkers = 0;
  let displayJobs = 0;
  let displayFindings = 0;

  function animateCounter(from: number, to: number, duration: number, cb: (v: number) => void) {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      cb(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  let sectionsRevealed = new Set<string>();
  function revealSection(id: string) {
    sectionsRevealed.add(id);
    sectionsRevealed = sectionsRevealed;
  }

  const tickerEvents = [
    "seoul-4090 training job-0012",
    "berlin-a100 evaluating exp-441",
    "experiment exp-439 keep +0.03 bpb",
    "singapore-4080 assigned job-0015",
    "mumbai-l40s training exp-442",
    "tokyo-4090 evaluating exp-440",
    "experiment exp-438 discard -0.01 bpb",
    "dubai-h100 online 2x GPU",
  ];

  const topicSuggestions = [
    "Ethereum price prediction",
    "DeFi risk analysis",
    "Token sentiment",
    "NFT market trends",
    "MEV detection",
    "Whale wallet tracking",
  ];

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
  $: totalNodes = renderNodes.length;
  $: activeWorkers = model.workers.filter(w => isWorkerActiveState(w.state)).length;
  $: totalGpu = model.nodes.reduce((s, n) => s + n.gpu, 0);
  $: keepCount = model.tape.filter(e => e.result === "keep").length;

  function handleSearch() {
    if (!searchQuery.trim()) return;
    jobStore.startJob(searchQuery.trim());
    router.navigate("research", { topic: searchQuery.trim() });
  }

  function selectTopic(topic: string) {
    searchQuery = topic;
    handleSearch();
  }

  onMount(() => {
    mounted = true;
    meshPopulationDisplayed = model.nodes.length;

    const handleScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-reveal');
          if (id) revealSection(id);
          if (entry.target === statsEl && !statsVisible) {
            statsVisible = true;
            animateCounter(0, totalNodes, 1200, v => displayNodes = v);
            animateCounter(0, totalGpu, 800, v => displayGpu = v);
            animateCounter(0, activeWorkers, 800, v => displayWorkers = v);
            animateCounter(0, model.jobs.length, 600, v => displayJobs = v);
            animateCounter(0, keepCount, 600, v => displayFindings = v);
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    requestAnimationFrame(() => {
      document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
      if (statsEl) observer.observe(statsEl);
    });

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

    // Combined tick: clock + population update (was 2 separate intervals at 250ms+140ms)
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
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      clearInterval(fixtureInterval);
      clearInterval(tickInterval);
    };
  });
</script>

<svelte:window bind:scrollY={scrollY} />

<div class="home" class:mounted data-theme="light">

  <!-- ════ HERO ════ -->
  <section class="hero">
    <div class="hero-bg">
      <MeshCanvas nodes={renderNodes} jobs={model.jobs} workers={model.workers} viewerLocation={{ lat: 37.57, lng: 126.98 }} />
    </div>

    <div class="hero-content">
      <h1 class="hero-h1">
        Turn any idea into<br/>a specialized AI model.
      </h1>
      <p class="hero-sub">
        HOOT turns user intent into working AI through automated research
        and distributed compute. Large models are generalists — HOOT creates specialists.
      </p>

      <div class="pe-editor-wrap">
        <div class="pe-owl-track">
          <div class="pe-walking-owl">
            <PixelOwl size={0.22} mood="idle" />
          </div>
        </div>
        <div class="program-editor">
        <div class="pe-chrome">
          <div class="pe-dots">
            <span class="pe-dot red"></span>
            <span class="pe-dot yellow"></span>
            <span class="pe-dot green"></span>
          </div>
          <span class="pe-filename">program.md</span>
        </div>
        <div class="pe-body">
          <div class="pe-line-numbers">
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
          </div>
          <textarea
            class="pe-textarea"
            rows="6"
            placeholder={"# Research Goal\nPredict Ethereum price movements using on-chain data\n\n# Approach\nTrain a time-series model on DEX volume, gas fees,\nand whale wallet activity from the last 90 days"}
            bind:value={searchQuery}
            on:keydown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSearch(); }}
          ></textarea>
        </div>
        <div class="pe-footer">
          <div class="pe-meta">
            <span class="pe-tag">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
                <rect x="3" y="1" width="2" height="2" fill="currentColor"/>
                <rect x="5" y="3" width="2" height="2" fill="currentColor"/>
                <rect x="7" y="5" width="2" height="2" fill="currentColor" opacity="0.7"/>
                <rect x="1" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
                <rect x="3" y="9" width="2" height="2" fill="currentColor" opacity="0.5"/>
                <rect x="9" y="1" width="2" height="2" fill="currentColor" opacity="0.4"/>
              </svg>
              60+ train.py mutations
            </span>
            <span class="pe-tag">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
                <rect x="1" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
                <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
                <rect x="5" y="7" width="2" height="2" fill="currentColor"/>
                <rect x="7" y="1" width="2" height="2" fill="currentColor"/>
                <rect x="9" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
              </svg>
              val_bpb hill-climbing
            </span>
            <span class="pe-tag">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
                <rect x="1" y="1" width="4" height="4" fill="currentColor"/>
                <rect x="7" y="1" width="4" height="4" fill="currentColor" opacity="0.7"/>
                <rect x="1" y="7" width="4" height="4" fill="currentColor" opacity="0.7"/>
                <rect x="7" y="7" width="4" height="4" fill="currentColor"/>
              </svg>
              Distributed GPU mesh
            </span>
            <span class="pe-tag accent">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
                <rect x="4" y="1" width="4" height="2" fill="currentColor"/>
                <rect x="2" y="3" width="2" height="2" fill="currentColor"/>
                <rect x="8" y="3" width="2" height="2" fill="currentColor"/>
                <rect x="2" y="5" width="2" height="4" fill="currentColor"/>
                <rect x="8" y="5" width="2" height="4" fill="currentColor"/>
                <rect x="4" y="9" width="4" height="2" fill="currentColor"/>
                <rect x="5" y="3" width="2" height="2" fill="currentColor" opacity="0.5"/>
                <rect x="5" y="5" width="2" height="2" fill="currentColor" opacity="0.3"/>
                <rect x="7" y="5" width="2" height="2" fill="currentColor" opacity="0.4"/>
              </svg>
              ~5 min
            </span>
          </div>
          <button class="pe-submit" on:click={handleSearch}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" class="px-icon" shape-rendering="crispEdges">
              <rect x="6" y="0" width="2" height="2" fill="currentColor"/>
              <rect x="5" y="2" width="2" height="2" fill="currentColor"/>
              <rect x="3" y="4" width="4" height="2" fill="currentColor"/>
              <rect x="5" y="6" width="2" height="2" fill="currentColor"/>
              <rect x="4" y="8" width="2" height="2" fill="currentColor"/>
              <rect x="3" y="10" width="2" height="2" fill="currentColor"/>
            </svg>
            Launch Autoresearch
          </button>
        </div>
        <div class="pe-examples">
          <span class="pe-examples-label">Examples:</span>
          {#each topicSuggestions.slice(0, 4) as t}
            <button class="chip" on:click={() => selectTopic(t)}>{t}</button>
          {/each}
        </div>
      </div>
      </div>

      <div class="hero-actions">
        <button class="dl-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="7" y="1" width="2" height="2" fill="currentColor"/>
            <rect x="7" y="3" width="2" height="2" fill="currentColor"/>
            <rect x="7" y="5" width="2" height="2" fill="currentColor"/>
            <rect x="7" y="7" width="2" height="2" fill="currentColor"/>
            <rect x="5" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
            <rect x="9" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
            <rect x="3" y="9" width="2" height="2" fill="currentColor" opacity="0.4"/>
            <rect x="11" y="9" width="2" height="2" fill="currentColor" opacity="0.4"/>
            <rect x="1" y="11" width="14" height="2" fill="currentColor" opacity="0.3"/>
            <rect x="1" y="13" width="14" height="2" fill="currentColor"/>
          </svg>
          Download for macOS
        </button>
        <span class="dl-alt">
          Also available for
          <button class="dl-link">Windows</button> and
          <button class="dl-link">Linux</button>
        </span>
      </div>
    </div>
  </section>

  <!-- ════ FEATURED — BENCHMARK SHOWCASE ════ -->
  <section class="featured" data-reveal="featured" class:revealed={sectionsRevealed.has('featured')}>
    <div class="feat-card">
      <span class="feat-kicker">PROVEN RESULTS</span>
      <h2 class="feat-h2">Autoresearch matched hand-built<br/>model performance — autonomously.</h2>
      <div class="feat-nums">
        <div class="feat-n">
          <span class="feat-v accent">0.9851</span>
          <span class="feat-d green">+3.7% vs baseline</span>
          <span class="feat-l">Balanced Accuracy</span>
        </div>
        <div class="feat-n">
          <span class="feat-v green">FN = 0</span>
          <span class="feat-d green">-100% (11 → 0)</span>
          <span class="feat-l">False Negatives</span>
        </div>
        <div class="feat-n">
          <span class="feat-v">5,000+</span>
          <span class="feat-d">autonomous</span>
          <span class="feat-l">Configs Explored</span>
        </div>
      </div>
      <div class="feat-bars">
        <div class="bar-row">
          <span class="bar-name">Rule-based Pipeline</span>
          <div class="bar-track"><div class="bar-fill base" style="width:95%"></div></div>
          <span class="bar-v">0.9499</span>
        </div>
        <div class="bar-row">
          <span class="bar-name">ML Ensemble (Ours)</span>
          <div class="bar-track"><div class="bar-fill best" style="width:98.5%"></div></div>
          <span class="bar-v hi">0.9851</span>
        </div>
      </div>
      <button class="feat-btn" on:click={() => router.navigate('model-detail', { modelId: 'model-um69vho1' })}>
        View full benchmark →
      </button>
    </div>
  </section>

  <!-- ════ HOW IT WORKS ════ -->
  <section class="how" data-reveal="how" class:revealed={sectionsRevealed.has('how')}>
    <span class="kicker">HOW IT WORKS</span>
    <h2 class="sec-h2">Three steps to a trained model</h2>
    <div class="steps">
      <div class="step">
        <div class="step-n">1</div>
        <h3>Describe your goal</h3>
        <p>Enter a research topic. An AI agent designs the ML pipeline, selects features, and configures the search space.</p>
      </div>
      <div class="step-arr">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="1" y="7" width="10" height="2" fill="currentColor" opacity="0.4"/>
            <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
            <rect x="11" y="7" width="2" height="2" fill="currentColor"/>
            <rect x="9" y="9" width="2" height="2" fill="currentColor"/>
          </svg>
      </div>
      <div class="step">
        <div class="step-n">2</div>
        <h3>Distributed training</h3>
        <p>A mesh of GPU nodes trains, evaluates, and evolves models in parallel — 12 experiments per hour per node.</p>
      </div>
      <div class="step-arr">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="1" y="7" width="10" height="2" fill="currentColor" opacity="0.4"/>
            <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
            <rect x="11" y="7" width="2" height="2" fill="currentColor"/>
            <rect x="9" y="9" width="2" height="2" fill="currentColor"/>
          </svg>
      </div>
      <div class="step">
        <div class="step-n">3</div>
        <h3>Collect your model</h3>
        <p>After hundreds of experiments, deploy the best model — or keep improving with more compute.</p>
      </div>
    </div>
  </section>

  <!-- ════ LIVE NETWORK ════ -->
  <section class="net" bind:this={statsEl} data-reveal="net">
    <div class="net-bar" class:revealed={sectionsRevealed.has('net')}>
      <div class="net-live">
        <span class="live-dot"></span>
        <span class="live-label">Network Live</span>
      </div>
      <div class="net-nums">
        <div class="nn"><span class="nv">{(statsVisible ? displayNodes : 0).toLocaleString()}</span><span class="nk">Nodes</span></div>
        <div class="nn"><span class="nv">{statsVisible ? displayGpu : 0}x</span><span class="nk">GPU</span></div>
        <div class="nn"><span class="nv">{statsVisible ? displayWorkers : 0}</span><span class="nk">Workers</span></div>
        <div class="nn"><span class="nv">{statsVisible ? displayJobs : 0}</span><span class="nk">Jobs</span></div>
        <div class="nn hi"><span class="nv">{statsVisible ? displayFindings : 0}</span><span class="nk">Findings</span></div>
      </div>
      <button class="ghost-btn" on:click={() => router.navigate('network')}>View Network →</button>
    </div>
    <div class="ticker" class:revealed={sectionsRevealed.has('net')}>
      <div class="ticker-track">
        {#each [...tickerEvents, ...tickerEvents] as evt}
          <span class="ticker-item">
            <span class="td" class:training={evt.includes('training')} class:evaluating={evt.includes('evaluating')} class:keep={evt.includes('keep')} class:discard={evt.includes('discard')} class:online={evt.includes('online')}></span>
            {evt}
          </span>
        {/each}
      </div>
    </div>
  </section>

  <!-- ════ EXPLORE ════ -->
  <section class="explore" data-reveal="explore" class:revealed={sectionsRevealed.has('explore')}>
    <div class="ex-grid">
      <button class="ex-card" on:click={() => router.navigate('research')}>
        <div class="ex-icon acc">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="1" y="13" width="14" height="2" fill="currentColor" opacity="0.3"/>
            <rect x="1" y="1" width="2" height="14" fill="currentColor" opacity="0.3"/>
            <rect x="3" y="9" width="2" height="2" fill="currentColor"/>
            <rect x="5" y="7" width="2" height="2" fill="currentColor"/>
            <rect x="7" y="9" width="2" height="2" fill="currentColor"/>
            <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
            <rect x="11" y="3" width="2" height="2" fill="currentColor"/>
            <rect x="13" y="1" width="2" height="2" fill="currentColor"/>
          </svg>
        </div>
        <h3>Autoresearch</h3>
        <p>Monitor experiments, metrics, and distributed training in real-time.</p>
        <span class="ex-link">Open →</span>
      </button>
      <button class="ex-card" on:click={() => router.navigate('models')}>
        <div class="ex-icon">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="1" y="1" width="6" height="6" fill="currentColor"/>
            <rect x="9" y="1" width="6" height="6" fill="currentColor" opacity="0.7"/>
            <rect x="1" y="9" width="6" height="6" fill="currentColor" opacity="0.7"/>
            <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
          </svg>
        </div>
        <h3>Model Hub</h3>
        <p>Browse trained models, benchmarks, and deployment options.</p>
        <span class="ex-link">Open →</span>
      </button>
      <button class="ex-card" on:click={() => router.navigate('network')}>
        <div class="ex-icon">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
            <rect x="5" y="1" width="6" height="2" fill="currentColor"/>
            <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
            <rect x="11" y="3" width="2" height="2" fill="currentColor"/>
            <rect x="1" y="5" width="2" height="6" fill="currentColor"/>
            <rect x="13" y="5" width="2" height="6" fill="currentColor"/>
            <rect x="3" y="11" width="2" height="2" fill="currentColor"/>
            <rect x="11" y="11" width="2" height="2" fill="currentColor"/>
            <rect x="5" y="13" width="6" height="2" fill="currentColor"/>
            <rect x="1" y="7" width="14" height="2" fill="currentColor" opacity="0.35"/>
            <rect x="7" y="1" width="2" height="14" fill="currentColor" opacity="0.35"/>
          </svg>
        </div>
        <h3>Live Network</h3>
        <p>Global compute mesh — nodes, jobs, and GPU utilization in real-time.</p>
        <span class="ex-link">Open →</span>
      </button>
    </div>
  </section>

</div>

<style>
  .home {
    opacity: 0; transition: opacity 600ms ease;
    -webkit-font-smoothing: antialiased;
    background: var(--page-bg, #FAF9F7);
    min-height: 100vh;
  }
  .home.mounted { opacity: 1; }

  /* ═══ HERO ═══ */
  .hero {
    position: relative;
    max-width: 960px;
    margin: 0 auto;
    padding: 100px 40px 60px;
    text-align: center;
  }
  .hero-bg {
    position: absolute;
    top: -60px; left: -200px; right: -200px; bottom: -100px;
    opacity: 0.18;
    pointer-events: none;
    filter: saturate(0.5) sepia(0.15);
  }
  .hero-content {
    position: relative; z-index: 1;
    animation: fadeUp 800ms cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  :global(.px-icon) {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .hero-h1 {
    font-family: var(--font-display, 'Playfair Display', serif);
    font-size: 3.4rem;
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 24px;
  }
  .hero-sub {
    font-size: 1.05rem;
    line-height: 1.65;
    color: var(--text-secondary, #6b6560);
    max-width: 560px;
    margin: 0 auto 40px;
  }

  /* Program Editor */
  .pe-editor-wrap {
    position: relative;
    max-width: 640px;
    margin: 0 auto 32px;
  }

  .program-editor {
    border: 1px solid var(--border, #E5E0DA);
    border-radius: var(--radius-md, 10px);
    background: var(--surface, #fff);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    overflow: hidden;
    animation: fadeUp 600ms cubic-bezier(0.16,1,0.3,1) 200ms both;
    transition: box-shadow 300ms ease, border-color 300ms ease;
  }
  .program-editor:focus-within {
    border-color: var(--accent, #D97757);
    box-shadow: 0 0 0 3px rgba(217,119,87,0.08), var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.12));
  }
  .pe-chrome {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(0,0,0,0.02);
    border-bottom: 1px solid var(--border-subtle, #EDEAE5);
  }
  .pe-dots {
    display: flex;
    gap: 5px;
  }
  .pe-dot {
    width: 8px; height: 8px; border-radius: 50%;
  }
  .pe-dot.red { background: #ff5f56; }
  .pe-dot.yellow { background: #ffbd2e; }
  .pe-dot.green { background: #27c93f; }
  .pe-filename {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    margin-left: 4px;
  }
  /* ── Walking Owl on top of editor ── */
  .pe-owl-track {
    position: absolute;
    top: -22px;
    left: 0;
    right: 0;
    height: 24px;
    z-index: 3;
    pointer-events: none;
  }
  .pe-walking-owl {
    position: absolute;
    bottom: 0;
    left: 20px;
    animation: owlPatrol 10s linear infinite, owlStep 0.35s ease-in-out infinite;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12));
  }
  @keyframes owlPatrol {
    0%   { left: 20px;  transform: scaleX(1); }
    45%  { left: calc(100% - 44px); transform: scaleX(1); }
    50%  { left: calc(100% - 44px); transform: scaleX(-1); }
    95%  { left: 20px;  transform: scaleX(-1); }
    100% { left: 20px;  transform: scaleX(1); }
  }
  @keyframes owlStep {
    0%, 100% { margin-bottom: 0; }
    50%      { margin-bottom: 2px; }
  }
  .pe-body {
    display: flex;
    min-height: 120px;
  }
  .pe-line-numbers {
    display: flex;
    flex-direction: column;
    padding: 12px 0 12px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.62rem;
    line-height: 1.7;
    color: var(--border, #E5E0DA);
    user-select: none;
    width: 28px;
    text-align: right;
    flex-shrink: 0;
  }
  .pe-textarea {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    resize: none;
    padding: 12px 14px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    line-height: 1.7;
    color: var(--text-primary, #2D2D2D);
    min-width: 0;
  }
  .pe-textarea::placeholder {
    color: var(--text-muted, #9a9590);
    opacity: 0.7;
  }
  .pe-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
    background: rgba(0,0,0,0.015);
    gap: 10px;
  }
  .pe-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }
  .pe-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.52rem;
    font-weight: 600;
    color: var(--text-secondary, #6b6560);
    background: rgba(0, 0, 0, 0.03);
    padding: 3px 9px;
    border-radius: 100px;
    border: 1px solid rgba(0, 0, 0, 0.04);
    white-space: nowrap;
    letter-spacing: 0.02em;
  }
  .pe-tag svg { color: var(--text-muted, #9a9590); flex-shrink: 0; }
  .pe-tag.accent {
    background: rgba(217, 119, 87, 0.06);
    border-color: rgba(217, 119, 87, 0.12);
    color: var(--accent, #D97757);
  }
  .pe-tag.accent svg { color: var(--accent, #D97757); }
  .pe-submit {
    appearance: none;
    border: none;
    background: var(--accent, #D97757);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 10px 20px;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 150ms, transform 100ms;
  }
  .pe-submit:hover { background: var(--accent-hover, #C4644A); }
  .pe-submit:active { transform: scale(0.97); }
  .pe-examples {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    flex-wrap: wrap;
  }
  .pe-examples-label {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.55rem;
    font-weight: 600;
    color: var(--text-muted, #9a9590);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 12px; }
  .chip {
    appearance: none;
    border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff);
    padding: 5px 14px; border-radius: 100px;
    font-size: 0.68rem; font-weight: 500;
    color: var(--text-secondary, #6b6560); cursor: pointer;
    transition: all 150ms;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }

  /* Download */
  .hero-actions {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    animation: fadeUp 600ms cubic-bezier(0.16,1,0.3,1) 400ms both;
  }
  .dl-primary {
    appearance: none; border: none;
    background: var(--accent, #D97757); color: #fff;
    font-size: 0.78rem; font-weight: 600;
    padding: 10px 22px; border-radius: 100px;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: background 150ms, transform 100ms;
  }
  .dl-primary:hover { background: var(--accent-hover, #C4644A); }
  .dl-primary:active { transform: scale(0.97); }
  .dl-alt {
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }
  .dl-link {
    appearance: none; border: none; background: none; padding: 0;
    font-size: 0.72rem; font-weight: 600;
    color: var(--text-secondary, #6b6560); cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px;
    transition: color 150ms;
  }
  .dl-link:hover { color: var(--accent); }

  /* ═══ FEATURED ═══ */
  .featured {
    max-width: 960px; margin: 0 auto; padding: 0 40px 64px;
    opacity: 0; transform: translateY(24px);
    transition: opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1);
  }
  .featured.revealed { opacity: 1; transform: translateY(0); }

  .feat-card {
    background: linear-gradient(135deg, #3D2B22, #2A1E18);
    border-radius: 20px;
    padding: 56px 48px;
    color: #fff;
    border: 1px solid rgba(217, 119, 87, 0.15);
  }
  .feat-kicker {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.56rem; font-weight: 700; letter-spacing: 0.14em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 16px;
  }
  .feat-h2 {
    font-family: var(--font-display);
    font-size: 1.6rem; font-weight: 600;
    line-height: 1.4;
    color: #fff;
    margin: 0 0 40px;
  }
  .feat-nums {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; margin-bottom: 36px;
  }
  .feat-n {
    display: flex; flex-direction: column; gap: 6px;
    padding: 20px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .feat-v {
    font-size: 2rem; font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1; letter-spacing: -0.02em;
    color: #fff;
  }
  .feat-v.accent { color: var(--accent, #D97757); }
  .feat-v.green { color: #4ade80; }
  .feat-d {
    font-size: 0.6rem; font-weight: 600;
    font-family: var(--font-mono);
    color: rgba(255,255,255,0.35);
  }
  .feat-d.green { color: #4ade80; }
  .feat-l {
    font-size: 0.54rem; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: rgba(255,255,255,0.3); font-family: var(--font-mono);
  }

  /* Bars */
  .feat-bars { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
  .bar-row { display: flex; align-items: center; gap: 14px; }
  .bar-name {
    width: 160px; text-align: right;
    font-size: 0.72rem; font-weight: 600;
    color: rgba(255,255,255,0.4); font-family: var(--font-mono); flex-shrink: 0;
  }
  .bar-track { flex: 1; height: 10px; background: rgba(255,255,255,0.06); border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; transition: width 1.4s cubic-bezier(0.16,1,0.3,1); }
  .bar-fill.base { background: rgba(255,255,255,0.2); }
  .bar-fill.best { background: linear-gradient(90deg, var(--accent, #D97757), #4ade80); }
  .bar-v {
    width: 52px; font-size: 0.78rem; font-weight: 700;
    font-family: var(--font-mono); color: rgba(255,255,255,0.5); flex-shrink: 0;
  }
  .bar-v.hi { color: var(--accent, #D97757); }

  .feat-btn {
    appearance: none; border: 1px solid rgba(255,255,255,0.15);
    background: none; padding: 10px 20px; border-radius: 100px;
    font-size: 0.72rem; font-weight: 600;
    color: rgba(255,255,255,0.7); cursor: pointer;
    transition: all 200ms;
  }
  .feat-btn:hover { border-color: rgba(255,255,255,0.4); color: #fff; }

  /* ═══ HOW IT WORKS ═══ */
  .how {
    max-width: 960px; margin: 0 auto;
    padding: 64px 40px;
    opacity: 0; transform: translateY(24px);
    transition: opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1);
  }
  .how.revealed { opacity: 1; transform: translateY(0); }

  .kicker {
    display: block; text-align: center;
    font-family: var(--font-mono);
    font-size: 0.56rem; font-weight: 700; letter-spacing: 0.14em;
    color: var(--accent, #D97757); margin-bottom: 12px;
  }
  .sec-h2 {
    text-align: center;
    font-family: var(--font-display);
    font-size: 1.8rem; font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    margin: 0 0 48px; letter-spacing: -0.02em;
  }

  .steps { display: flex; align-items: flex-start; justify-content: center; }
  .step { flex: 1; max-width: 280px; padding: 0 24px; }
  .step h3 { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; }
  .step p { font-size: 0.82rem; color: var(--text-secondary); margin: 0; line-height: 1.55; }
  .step-n {
    width: 32px; height: 32px; border-radius: 10px;
    background: var(--accent, #D97757); color: #fff;
    font-size: 0.72rem; font-weight: 700; font-family: var(--font-mono);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .step-arr {
    display: flex; align-items: center;
    color: var(--border, #E5E0DA);
    flex-shrink: 0; padding-top: 6px;
    animation: arrowDrift 1.8s ease-in-out infinite;
  }
  @keyframes arrowDrift { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }

  /* ═══ NETWORK ═══ */
  .net { max-width: 960px; margin: 0 auto; padding: 0 40px 48px; }
  .net-bar {
    display: flex; align-items: center; gap: 20px;
    padding: 16px 24px;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #E5E0DA);
    border-radius: 14px;
    opacity: 0; transform: translateY(12px);
    transition: opacity 600ms cubic-bezier(0.16,1,0.3,1),
                transform 600ms cubic-bezier(0.16,1,0.3,1),
                box-shadow 200ms;
  }
  .net-bar.revealed { opacity: 1; transform: translateY(0); }
  .net-bar:hover { box-shadow: var(--shadow-md); }

  .net-live { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green, #27864a);
    box-shadow: 0 0 8px rgba(39,134,74,0.5);
    animation: pulse 2.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .live-label {
    font-size: 0.64rem; font-weight: 700; color: var(--green);
    text-transform: uppercase; font-family: var(--font-mono); letter-spacing: 0.08em;
  }
  .net-nums { display: flex; align-items: center; gap: 16px; flex: 1; overflow-x: auto; }
  .nn { display: flex; flex-direction: column; gap: 1px; white-space: nowrap; }
  .nv {
    font-size: 1.1rem; font-weight: 700; color: var(--text-primary);
    font-family: var(--font-mono); font-variant-numeric: tabular-nums; line-height: 1.2;
  }
  .nn.hi .nv { color: var(--green, #27864a); }
  .nk {
    font-size: 0.54rem; font-weight: 500; color: var(--text-muted);
    text-transform: uppercase; font-family: var(--font-mono); letter-spacing: 0.06em;
  }
  .ghost-btn {
    appearance: none; border: 1px solid var(--border, #E5E0DA);
    background: var(--surface, #fff); padding: 8px 16px; border-radius: 100px;
    font-size: 0.7rem; font-weight: 600;
    color: var(--text-secondary, #6b6560); cursor: pointer;
    flex-shrink: 0; white-space: nowrap; transition: all 200ms;
  }
  .ghost-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* Ticker */
  .ticker {
    margin-top: 8px; padding: 9px 0; overflow: hidden;
    border-radius: 10px; background: var(--surface, #fff);
    border: 1px solid var(--border-subtle, #EDEAE5);
    position: relative;
    opacity: 0; transform: translateY(8px);
    transition: opacity 500ms cubic-bezier(0.16,1,0.3,1) 200ms,
                transform 500ms cubic-bezier(0.16,1,0.3,1) 200ms;
  }
  .ticker.revealed { opacity: 1; transform: translateY(0); }
  .ticker::before, .ticker::after {
    content: ''; position: absolute; top: 0; bottom: 0; width: 40px; z-index: 1; pointer-events: none;
  }
  .ticker::before { left: 0; background: linear-gradient(to right, var(--surface, #fff), transparent); }
  .ticker::after { right: 0; background: linear-gradient(to left, var(--surface, #fff), transparent); }
  .ticker-track {
    display: flex; gap: 32px; white-space: nowrap;
    animation: tickerScroll 24s linear infinite; width: max-content;
  }
  .ticker-item {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.66rem; font-family: var(--font-mono); color: var(--text-muted, #9a9590);
  }
  .td {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--accent); animation: breathe 2s ease-in-out infinite;
  }
  .td.training { background: var(--accent); }
  .td.evaluating { background: var(--gold, #b7860e); }
  .td.keep { background: var(--green); }
  .td.discard { background: var(--red, #c0392b); }
  .td.online { background: rgba(80,170,255,0.8); }

  /* ═══ EXPLORE ═══ */
  .explore {
    max-width: 960px; margin: 0 auto;
    padding: 0 40px 80px;
    opacity: 0; transform: translateY(24px);
    transition: opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1);
  }
  .explore.revealed { opacity: 1; transform: translateY(0); }

  .ex-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 2px; background: var(--border-subtle, #EDEAE5);
    border-radius: 16px; overflow: hidden;
  }
  .ex-card {
    appearance: none; border: none;
    background: var(--surface, #fff);
    padding: 28px 24px; text-align: left; cursor: pointer;
    transition: background 200ms;
  }
  .ex-card:hover { background: var(--page-bg, #FAF9F7); }
  .ex-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(0,0,0,0.04);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-secondary); margin-bottom: 16px;
    transition: transform 200ms;
  }
  .ex-icon.acc { background: rgba(217,119,87,0.06); color: var(--accent); }
  .ex-card:hover .ex-icon { transform: scale(1.06); }
  .ex-card h3 { font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
  .ex-card p { font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 12px; line-height: 1.5; }
  .ex-link {
    font-size: 0.7rem; font-weight: 600; color: var(--accent);
    display: inline-block; transition: transform 150ms;
  }
  .ex-card:hover .ex-link { transform: translateX(3px); }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 860px) {
    .hero { padding: 80px 24px 48px; }
    .hero-h1 { font-size: 2.6rem; }
    .steps { flex-direction: column; align-items: center; }
    .step-arr { display: none; }
    .step { max-width: 100%; }
    .featured { padding: 0 24px 48px; }
    .feat-card { padding: 40px 28px; }
    .feat-nums { grid-template-columns: 1fr; }
    .feat-h2 { font-size: 1.3rem; }
    .bar-name { width: 120px; font-size: 0.66rem; }
    .how { padding: 48px 24px; }
    .net { padding: 0 24px 40px; }
    .net-bar { flex-wrap: wrap; gap: 12px; }
    .ghost-btn { width: 100%; text-align: center; justify-content: center; display: flex; }
    .explore { padding: 0 24px 60px; }
    .ex-grid { grid-template-columns: 1fr; }
    .sec-h2 { font-size: 1.5rem; }
    .hero-actions { flex-direction: column; gap: 10px; }
  }

  @media (max-width: 600px) {
    .hero { padding: 64px 16px 40px; }
    .hero-h1 { font-size: 2rem; }
    .hero-sub { font-size: 0.9rem; margin-bottom: 28px; }
    .pe-footer { flex-direction: column; gap: 8px; }
    .pe-submit { width: 100%; justify-content: center; }
    .pe-meta { justify-content: center; }
    .pe-tag { font-size: 0.48rem; padding: 2px 7px; }
    .pe-line-numbers { display: none; }
    .pe-textarea { padding: 12px; }
    .pe-examples { gap: 4px; }
    .chips { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; -webkit-overflow-scrolling: touch; }
    .featured { padding: 0 16px 40px; }
    .feat-card { padding: 32px 20px; border-radius: 16px; }
    .feat-v { font-size: 1.5rem; }
    .feat-h2 { font-size: 1.15rem; }
    .how { padding: 40px 16px; }
    .sec-h2 { font-size: 1.3rem; margin-bottom: 28px; }
    .step { padding: 0 16px; }
    .step h3 { font-size: 0.88rem; }
    .step p { font-size: 0.78rem; }
    .net { padding: 0 16px 32px; }
    .net-bar { flex-direction: column; gap: 10px; padding: 12px; }
    .net-live { justify-content: center; }
    .net-nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; overflow-x: visible; }
    .nn { align-items: center; text-align: center; }
    .nv { font-size: 0.95rem; }
    .nk { font-size: 0.5rem; }
    .explore { padding: 0 16px 48px; }
    .ex-card { padding: 22px 18px; }
    .dl-primary { font-size: 0.74rem; padding: 10px 18px; }
    .ticker-track { animation-duration: 20s; }
  }

  @media (max-width: 400px) {
    .hero-h1 { font-size: 1.65rem; }
    .hero-sub { font-size: 0.82rem; }
    .feat-nums { grid-template-columns: 1fr; }
    .feat-v { font-size: 1.3rem; }
    .net-nums { grid-template-columns: repeat(2, 1fr); }
    .nv { font-size: 0.85rem; }
  }
</style>

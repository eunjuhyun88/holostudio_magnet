<script lang="ts">
  import { onMount } from "svelte";

  import {
    buildJobNodeCountMap,
    buildJobSwarmGroups,
    buildScaledNodes,
    getJobFlowCount,
    isWorkerActiveState,
    oscillate01,
    smoothPulse,
  } from "../src/core/meshSim.ts";
  import {
    createFixturePlayback,
    demoFixtureText,
    parseNdjson,
  } from "../src/fixed/fixturePlayer.ts";
  import { connectTelemetryStream, resolveTelemetryUrl } from "../src/fixed/liveTelemetry.ts";
  import type { TelemetryEvent, VisualizerModel, Worker } from "../src/fixed/types.ts";
  import ExperimentTape from "./lib/ExperimentTape.svelte";
  import GlobeCanvasIsland from "./lib/GlobeCanvasIsland.svelte";
  import ModeButton from "./lib/ModeButton.svelte";
  import WorkerBoard from "./lib/WorkerBoard.svelte";

  type TelemetryMode = "fixture" | "live";
  type TelemetryStatus = "offline" | "connecting" | "streaming" | "error";
  type ViewerLocationState = "locating" | "ready" | "denied" | "unavailable";
  type ViewerLocation = {
    lat: number;
    lng: number;
    label: string;
  };

  const events = parseNdjson(demoFixtureText);
  const playback = createFixturePlayback(events);
  const emptyModel: VisualizerModel = {
    workers: [],
    nodes: [],
    jobs: [],
    tape: [],
  };

  let frameIndex = playback.length > 0 ? 0 : -1;
  let telemetryMode: TelemetryMode = "fixture";
  let liveModel: VisualizerModel | null = null;
  let lastTelemetryEvent: TelemetryEvent | null = null;
  let telemetryStatus: TelemetryStatus = "offline";
  let viewportWidth = 1440;
  let meshSimulationTime = 0;
  let meshPopulationDisplayed = 0;
  let selectedWorkerId: string | null = null;
  let recentNodeJoinDelta = 0;
  let previousNodeCount = 0;
  let telemetryUrl: string | null = null;
  let viewerLocation: ViewerLocation | null = null;
  let viewerLocationState: ViewerLocationState = "locating";

  let liveCleanup: (() => void) | null = null;
  let fixtureInterval: number | null = null;
  let meshClockInterval: number | null = null;
  let meshPopulationInterval: number | null = null;
  let joinDeltaTimeout: number | null = null;
  let mounted = false;

  // HUD panel states - collapsed by default for cleaner view
  let workersExpanded = false;
  let tapeExpanded = false;

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  $: fixtureModel = playback[Math.max(frameIndex, 0)] ?? emptyModel;
  $: model = telemetryMode === "live" ? liveModel ?? fixtureModel : fixtureModel;
  $: meshPopulationCeiling =
    model.nodes.length === 0
      ? 0
      : clamp(Math.max(3200, model.nodes.length * 660), 2200, 5600);
  $: meshPopulationTarget = (() => {
    if (model.nodes.length === 0) return 0;
    const longWave = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
    const surgeWave = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
    const envelope = clamp(0.07 + longWave * 0.72 + surgeWave * 0.12, 0.07, 0.97);
    return Math.round(model.nodes.length + meshPopulationCeiling * envelope);
  })();
  $: renderNodes = buildScaledNodes(
    model.nodes,
    model.jobs,
    meshPopulationDisplayed,
    meshPopulationCeiling,
    meshSimulationTime,
  );
  $: selectedWorker = model.workers.find((worker) => worker.id === selectedWorkerId) ?? null;
  $: if (selectedWorkerId && !model.workers.some((worker) => worker.id === selectedWorkerId)) {
    selectedWorkerId = model.workers[0]?.id ?? null;
  }
  $: totalGpu = model.nodes.reduce((sum, node) => sum + node.gpu, 0);
  $: activeWorkers = model.workers.filter((worker) => isWorkerActiveState(worker.state)).length;
  $: claimedDonors = renderNodes.filter((node) => node.jobId).length;
  $: evaluatingWorkers = model.workers.filter((worker) => worker.state === "evaluating").length;
  $: activeJobs = model.jobs.filter((job) => job.state === "training" || job.state === "evaluating");
  $: activeFlowCount = model.jobs.reduce((sum, job) => sum + getJobFlowCount(job), 0);
  $: keepCount = model.tape.filter((entry) => entry.result === "keep").length;
  $: discardCount = model.tape.filter((entry) => entry.result === "discard").length;
  $: crashCount = model.tape.filter((entry) => entry.result === "crash").length;
  $: isMobile = viewportWidth < 860;
  $: jobNodeCountMap = buildJobNodeCountMap(renderNodes);
  $: activeSwarmPreview = buildJobSwarmGroups(model.jobs, jobNodeCountMap).slice(0, 4);
  $: runtimeLabel =
    telemetryMode === "live"
      ? telemetryStatus
      : playback.length > 0
        ? `frame ${frameIndex + 1}/${playback.length}`
        : "replay idle";
  $: selectedFocusLabel = selectedWorker
    ? `${selectedWorker.region} · ${selectedWorker.gpuLabel}`
    : viewerLocation
      ? "viewer anchored"
      : "mesh overview";

  $: {
    const nextCount = model.nodes.length;
    if (nextCount > previousNodeCount) {
      recentNodeJoinDelta = nextCount - previousNodeCount;
      if (joinDeltaTimeout !== null) window.clearTimeout(joinDeltaTimeout);
      joinDeltaTimeout = window.setTimeout(() => { recentNodeJoinDelta = 0; }, 900);
    }
    previousNodeCount = nextCount;
  }

  onMount(() => {
    viewportWidth = window.innerWidth;
    telemetryUrl = resolveTelemetryUrl(window.location.search);
    telemetryMode = telemetryUrl ? "live" : "fixture";
    telemetryStatus = telemetryUrl ? "connecting" : "offline";
    meshPopulationDisplayed = model.nodes.length;
    mounted = true;

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          viewerLocation = { lat: position.coords.latitude, lng: position.coords.longitude, label: "YOUR BROWSER" };
          viewerLocationState = "ready";
        },
        () => { viewerLocationState = "denied"; },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 6000 },
      );
    } else {
      viewerLocationState = "unavailable";
    }

    const handleResize = () => { viewportWidth = window.innerWidth; };
    window.addEventListener("resize", handleResize);

    let dwellCount = 0;
    fixtureInterval = window.setInterval(() => {
      if (telemetryMode !== "fixture" || playback.length <= 1) return;
      if (frameIndex < 0) { frameIndex = 0; return; }
      if (frameIndex >= playback.length - 1) {
        dwellCount += 1;
        if (dwellCount >= 3) { dwellCount = 0; frameIndex = 0; }
        return;
      }
      frameIndex = frameIndex + 1;
    }, 2800);

    meshClockInterval = window.setInterval(() => { meshSimulationTime += 0.25; }, 250);

    meshPopulationInterval = window.setInterval(() => {
      const floor = model.nodes.length;
      const safeCurrent = Math.max(meshPopulationDisplayed, floor);
      if (safeCurrent === meshPopulationTarget) return;
      if (safeCurrent < meshPopulationTarget) {
        const step = Math.max(2, Math.ceil((meshPopulationTarget - safeCurrent) * 0.017));
        meshPopulationDisplayed = Math.min(meshPopulationTarget, safeCurrent + step);
        return;
      }
      const step = Math.max(2, Math.ceil((safeCurrent - meshPopulationTarget) * 0.013));
      meshPopulationDisplayed = Math.max(meshPopulationTarget, safeCurrent - step);
    }, 140);

    if (telemetryUrl) {
      const connection = connectTelemetryStream({
        url: telemetryUrl,
        onSnapshot(nextModel, event) {
          liveModel = nextModel;
          lastTelemetryEvent = event;
          telemetryStatus = "streaming";
        },
        onError() { telemetryStatus = "error"; },
      });
      liveCleanup = () => connection.unsubscribe();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (fixtureInterval !== null) window.clearInterval(fixtureInterval);
      if (meshClockInterval !== null) window.clearInterval(meshClockInterval);
      if (meshPopulationInterval !== null) window.clearInterval(meshPopulationInterval);
      if (joinDeltaTimeout !== null) window.clearTimeout(joinDeltaTimeout);
      liveCleanup?.();
    };
  });
</script>

<svelte:head>
  <title>HOOT Autonomous Research Mesh</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="viewport" class:mounted>
  <!-- ═══ Full-viewport Globe Background ═══ -->
  <div class="globe-bg">
    <div class="globe-ambient">
      <div class="ambient-orb orb-1"></div>
      <div class="ambient-orb orb-2"></div>
      <div class="ambient-orb orb-3"></div>
    </div>
    <GlobeCanvasIsland
      nodes={renderNodes}
      jobs={model.jobs}
      workers={model.workers}
      {selectedWorker}
      {viewerLocation}
    />
    <div class="globe-vignette"></div>
  </div>

  <!-- ═══ HUD Overlay Layer ═══ -->
  <div class="hud">
    <!-- ─── Top: Dynamic Island ─── -->
    <header class="island">
      <div class="island-left">
        <div class="island-brand">
          <span class="brand-dot"></span>
          <span class="brand-name">HOOT</span>
          {#if !isMobile}
            <span class="brand-sep"></span>
            <span class="brand-sub">Autonomous Research Mesh</span>
          {/if}
        </div>
      </div>
      <div class="island-center">
        <div class="mode-switch">
          <ModeButton
            label="Fixture"
            active={telemetryMode === "fixture"}
            on:click={() => (telemetryMode = "fixture")}
          />
          <ModeButton
            label="Live"
            active={telemetryMode === "live"}
            disabled={!telemetryUrl}
            on:click={() => telemetryUrl && (telemetryMode = "live")}
          />
        </div>
      </div>
      <div class="island-right">
        <div class="island-metrics">
          <span class="island-metric">
            <span class="metric-dot supply"></span>
            {model.nodes.length.toLocaleString()}
            {#if recentNodeJoinDelta > 0}<span class="delta node-join-flash">+{recentNodeJoinDelta}</span>{/if}
          </span>
          <span class="island-metric">
            <span class="metric-dot gpu"></span>
            {totalGpu}x
          </span>
          <span class="island-metric status-{telemetryMode === 'live' ? telemetryStatus : 'fixture'}">
            {runtimeLabel}
          </span>
        </div>
      </div>
    </header>

    <!-- ─── Left: Compact Stats ─── -->
    <div class="hud-left">
      <div class="stat-card">
        <div class="stat-label">Donors</div>
        <div class="stat-value">{renderNodes.length.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Claimed</div>
        <div class="stat-value accent-cyan">{claimedDonors.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Verify</div>
        <div class="stat-value accent-amber">{evaluatingWorkers}</div>
      </div>
      <div class="stat-card compact-row">
        <span class="tc-inline keep">{keepCount}</span>
        <span class="tc-inline discard">{discardCount}</span>
        <span class="tc-inline crash">{crashCount}</span>
      </div>
    </div>

    <!-- ─── Right: Workers Panel ─── -->
    <div class="hud-right" class:collapsed={!workersExpanded}>
      <button class="panel-toggle" on:click={() => workersExpanded = !workersExpanded}>
        <span class="toggle-title">
          <span class="toggle-kicker">GPU Workspaces</span>
          <span class="toggle-badge">{activeWorkers}/{model.workers.length}</span>
        </span>
        <span class="toggle-chevron" class:open={workersExpanded}>&#9662;</span>
      </button>
      {#if workersExpanded}
        <div class="panel-body" style="animation: hud-slide-in 300ms ease both;">
          <WorkerBoard
            workers={model.workers}
            jobs={model.jobs}
            renderNodes={renderNodes}
            tape={model.tape}
            compact={isMobile}
            tablet={viewportWidth < 1280}
            {selectedWorkerId}
            on:select={(event) => (selectedWorkerId = event.detail)}
          />
        </div>
      {/if}
    </div>

    <!-- ─── Bottom: Experiment Tape ─── -->
    <div class="hud-bottom" class:collapsed={!tapeExpanded}>
      <button class="panel-toggle" on:click={() => tapeExpanded = !tapeExpanded}>
        <span class="toggle-title">
          <span class="toggle-kicker">Experiment Tape</span>
          <span class="tape-summary-inline">
            <span class="tc keep">{keepCount}</span>
            <span class="tc discard">{discardCount}</span>
            <span class="tc crash">{crashCount}</span>
          </span>
        </span>
        <span class="toggle-chevron" class:open={tapeExpanded}>&#9662;</span>
      </button>
      {#if tapeExpanded}
        <div class="panel-body tape-scroll" style="animation: hud-slide-in 300ms ease both;">
          <ExperimentTape tape={model.tape} compact={isMobile} />
        </div>
      {/if}
    </div>

    <!-- ─── Bottom Legend Bar ─── -->
    <div class="hud-legend">
      <div class="legend-items">
        <span class="legend-item"><span class="legend-dot quiet"></span>Quiet supply</span>
        <span class="legend-item"><span class="legend-dot training"></span>Training</span>
        <span class="legend-item"><span class="legend-dot verify"></span>Verifying</span>
        {#if viewerLocation}
          <span class="legend-item"><span class="legend-dot viewer"></span>Your browser</span>
        {/if}
      </div>
      <div class="legend-focus">
        <span class="focus-indicator"></span>
        {selectedFocusLabel}
      </div>
    </div>

    {#if !telemetryUrl}
      <div class="hint-bar">
        <code>?telemetry=http://localhost:8787/events</code>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(html, body, #app) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  :global(body) {
    color: #e8ecf4;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #000000;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(*) {
    box-sizing: border-box;
  }

  /* ═══ Viewport Shell ═══ */
  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    transition: opacity 600ms ease;
  }

  .viewport.mounted {
    opacity: 1;
  }

  /* ═══ Full-viewport Globe Background ═══ */
  .globe-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: radial-gradient(ellipse at 50% 45%, rgba(8, 16, 36, 1), rgba(0, 0, 0, 1));
  }

  .globe-bg :global(.host) {
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
  }

  .globe-ambient {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .ambient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    will-change: transform;
    pointer-events: none;
  }

  .orb-1 {
    width: 700px;
    height: 700px;
    top: -15%;
    left: 5%;
    background: rgba(20, 50, 140, 0.2);
    animation: float-orb 22s ease-in-out infinite;
  }

  .orb-2 {
    width: 550px;
    height: 550px;
    top: -5%;
    right: 0;
    background: rgba(51, 209, 255, 0.06);
    animation: float-orb 28s ease-in-out infinite reverse;
  }

  .orb-3 {
    width: 450px;
    height: 450px;
    bottom: -5%;
    left: 35%;
    background: rgba(14, 60, 180, 0.1);
    animation: float-orb 20s ease-in-out infinite 4s;
  }

  @keyframes float-orb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -20px) scale(1.06); }
    66% { transform: translate(-20px, 15px) scale(0.94); }
  }

  .globe-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background:
      radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.45) 100%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, transparent 15%, transparent 85%, rgba(0, 0, 0, 0.25) 100%);
  }

  /* ═══ HUD Overlay Layer ═══ */
  .hud {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    display: flex;
    flex-direction: column;
  }

  .hud > * {
    pointer-events: auto;
  }

  /* ─── Dynamic Island ─── */
  .island {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 12px auto 0;
    padding: 10px 20px;
    max-width: 920px;
    width: calc(100% - 24px);
    border-radius: 100px;
    background: rgba(12, 12, 16, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 50;
    flex-shrink: 0;
  }

  .island-left { flex-shrink: 0; }

  .island-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #33d1ff;
    box-shadow: 0 0 12px rgba(51, 209, 255, 0.5);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(51, 209, 255, 0.5); }
    50% { opacity: 0.7; box-shadow: 0 0 6px rgba(51, 209, 255, 0.3); }
  }

  .brand-name {
    font-weight: 700;
    font-size: 0.88rem;
    letter-spacing: 0.08em;
    color: #ffffff;
  }

  .brand-sep {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.12);
  }

  .brand-sub {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.02em;
  }

  .island-center { flex-shrink: 0; }

  .mode-switch {
    display: flex;
    gap: 4px;
  }

  .island-right { flex-shrink: 0; }

  .island-metrics {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .island-metric {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .metric-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .metric-dot.supply { background: #5fd3ff; }
  .metric-dot.gpu { background: #a78bfa; }

  .delta {
    color: #2ad47d;
    font-weight: 600;
  }

  .node-join-flash {
    animation: join-flash 800ms ease both;
  }

  @keyframes join-flash {
    0% { opacity: 0; transform: translateY(4px) scale(0.8); }
    20% { opacity: 1; transform: translateY(-2px) scale(1.15); color: #6fffb2; }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .status-streaming { color: #2ad47d; }
  .status-connecting { color: #ffb44d; }
  .status-error { color: #ff5d73; }
  .status-offline, .status-fixture { color: rgba(255, 255, 255, 0.4); }

  /* ─── HUD Left Panel ─── */
  .hud-left {
    position: absolute;
    left: 14px;
    top: 64px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 130px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .hud-left::-webkit-scrollbar { display: none; }

  .stat-card {
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(8, 10, 16, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    transition: background 200ms ease, border-color 200ms ease;
  }

  .stat-card:hover {
    background: rgba(12, 14, 20, 0.75);
    border-color: rgba(255, 255, 255, 0.07);
  }

  .stat-label {
    font-size: 0.56rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 2px;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .stat-value.accent-cyan { color: #33d1ff; }
  .stat-value.accent-amber { color: #ffb44d; }

  .compact-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
  }

  .tc-inline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 4px;
    border-radius: 5px;
    font-size: 0.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .tc-inline.keep { background: rgba(42, 212, 125, 0.12); color: #2ad47d; }
  .tc-inline.discard { background: rgba(255, 93, 115, 0.12); color: #ff5d73; }
  .tc-inline.crash { background: rgba(216, 76, 255, 0.12); color: #d84cff; }

  /* ─── HUD Right Panel (Workers) ─── */
  .hud-right {
    position: absolute;
    right: 14px;
    top: 64px;
    width: 290px;
    max-height: calc(100vh - 140px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: rgba(8, 10, 16, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.02) inset,
      0 6px 24px rgba(0, 0, 0, 0.35);
    transition: max-height 300ms ease;
  }

  .hud-right.collapsed {
    max-height: 42px;
  }

  /* ─── HUD Bottom Panel (Tape) ─── */
  .hud-bottom {
    position: absolute;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, calc(100% - 32px));
    max-height: 200px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: rgba(8, 10, 16, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.02) inset,
      0 6px 24px rgba(0, 0, 0, 0.35);
    transition: max-height 300ms ease;
  }

  .hud-bottom.collapsed {
    max-height: 42px;
  }

  .tape-scroll {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  .tape-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .tape-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .tape-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  /* ─── Panel Toggle Buttons ─── */
  .panel-toggle {
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 200ms ease;
  }

  .panel-toggle:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .toggle-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle-kicker {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(142, 182, 255, 0.7);
  }

  .toggle-badge {
    padding: 3px 8px;
    border-radius: 100px;
    background: rgba(51, 209, 255, 0.08);
    border: 1px solid rgba(51, 209, 255, 0.15);
    color: #8deaff;
    font-size: 0.66rem;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .toggle-chevron {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.3);
    transition: transform 200ms ease;
    line-height: 1;
  }

  .toggle-chevron.open {
    transform: rotate(0deg);
  }

  .toggle-chevron:not(.open) {
    transform: rotate(-90deg);
  }

  .tape-summary-inline {
    display: flex;
    gap: 4px;
  }

  .tc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 20px;
    padding: 0 5px;
    border-radius: 6px;
    font-size: 0.64rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .tc.keep {
    background: rgba(42, 212, 125, 0.1);
    color: #2ad47d;
    border: 1px solid rgba(42, 212, 125, 0.18);
  }

  .tc.discard {
    background: rgba(255, 93, 115, 0.1);
    color: #ff5d73;
    border: 1px solid rgba(255, 93, 115, 0.18);
  }

  .tc.crash {
    background: rgba(216, 76, 255, 0.1);
    color: #d84cff;
    border: 1px solid rgba(216, 76, 255, 0.18);
  }

  .panel-body {
    padding: 0 12px 12px;
    overflow-y: auto;
  }

  @keyframes hud-slide-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── Legend Bar ─── */
  .hud-legend {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
    pointer-events: none;
  }

  .legend-items {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.02em;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .legend-dot.quiet { background: #45607f; }
  .legend-dot.training { background: #33d1ff; box-shadow: 0 0 8px rgba(51, 209, 255, 0.4); }
  .legend-dot.verify { background: #ffb44d; box-shadow: 0 0 8px rgba(255, 180, 77, 0.4); }
  .legend-dot.viewer { background: #c8fbff; box-shadow: 0 0 8px rgba(200, 251, 255, 0.4); }

  .legend-focus {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .focus-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #8deaff;
    box-shadow: 0 0 8px rgba(141, 234, 255, 0.4);
  }

  /* ─── Hint Bar ─── */
  .hint-bar {
    position: absolute;
    bottom: 40px;
    right: 20px;
    pointer-events: auto;
  }

  .hint-bar code {
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 0.66rem;
    color: rgba(255, 255, 255, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* ═══ Responsive: Tablet ═══ */
  @media (max-width: 1280px) {
    .hud-left {
      width: 140px;
    }

    .hud-right {
      width: 280px;
    }

    .island {
      max-width: 700px;
    }
  }

  /* ═══ Responsive: Mobile ═══ */
  @media (max-width: 860px) {
    .island {
      margin: 8px auto 0;
      padding: 8px 14px;
      gap: 8px;
      max-width: calc(100% - 16px);
    }

    .island-metrics {
      gap: 8px;
      font-size: 0.7rem;
    }

    .hud-left {
      position: absolute;
      left: 8px;
      top: 60px;
      width: 140px;
      gap: 6px;
    }

    .stat-card {
      padding: 8px 10px;
      border-radius: 12px;
    }

    .stat-value {
      font-size: 1.1rem;
    }

    .stat-label {
      font-size: 0.58rem;
    }

    .hud-right {
      position: absolute;
      right: 8px;
      top: 60px;
      width: calc(100% - 160px);
      max-width: 280px;
    }

    .hud-bottom {
      bottom: 44px;
      width: calc(100% - 16px);
      max-height: 200px;
    }

    .hud-legend {
      padding: 10px 16px;
    }

    .legend-items {
      gap: 10px;
    }
  }

  /* ═══ Very small screens ═══ */
  @media (max-width: 600px) {
    .hud-left {
      display: none;
    }

    .hud-right {
      width: calc(100% - 16px);
      max-width: none;
      left: 8px;
      right: 8px;
      top: 56px;
      max-height: calc(50vh - 80px);
    }

    .hud-bottom {
      max-height: 180px;
    }
  }
</style>

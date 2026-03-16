<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { fly, fade } from "svelte/transition";
  import { debounce } from "../utils/perf.ts";

  import {
    buildJobNodeCountMap,
    buildJobSwarmGroups,
    buildScaledNodes,
    getJobFlowCount,
    isWorkerActiveState,
    oscillate01,
    smoothPulse,
  } from "../utils/meshSim.ts";
  import {
    createFixturePlayback,
    demoFixtureText,
    parseNdjson,
  } from "../utils/fixturePlayer.ts";
  import { connectTelemetryStream, resolveTelemetryUrl } from "../utils/liveTelemetry.ts";
  import { fetchRuntimeMesh, readRuntimeConfig, subscribeRuntimeMesh } from "../api/client.ts";
  import { mapRuntimeMeshToVisualizer } from "../api/runtimeVisualizerAdapter.ts";
  import type { TelemetryEvent, VisualizerModel, Worker, Job } from "../utils/types.ts";
  import ExperimentTape from "../components/ExperimentTape.svelte";
  import MeshCanvas from "../components/MeshCanvas.svelte";
  import NodeCard from "../components/NodeCard.svelte";
  import WorkerBoard from "../components/WorkerBoard.svelte";
  import NetworkHUD from "../components/NetworkHUD.svelte";
  import JobsPanel from "../components/JobsPanel.svelte";
  import { router } from "../stores/router.ts";
  import { jobStore } from '../stores/jobStore.ts';
  import { wallet } from '../stores/walletStore.ts';
  import ContractCallModal from '../components/ContractCallModal.svelte';
  import BondPanel from '../components/BondPanel.svelte';
  import PixelIcon from '../components/PixelIcon.svelte';
  import TrustGaugePanel from '../components/TrustGaugePanel.svelte';
  import type { ContractCall } from '../data/protocolData.ts';
  import { SIMULATED_BALANCE, MAU_TARGET, TRUST_SCORE_TARGET } from '../data/protocolData.ts';
  import { animateCounter } from '../utils/animate.ts';
  import { rewardStore, rewardSummary } from '../stores/rewardStore.ts';
  import { isConnected } from '../stores/connectionStore.ts';
  import { nodeStore, hasGpuNode } from '../stores/nodeStore.ts';
  import GPUOnboardWizard from '../components/studio/GPUOnboardWizard.svelte';
  import NotaryPanel from '../components/network/NotaryPanel.svelte';

  // ── Wallet ──
  $: walletConnected = $wallet.connected;
  $: walletAddress = $wallet.address;

  // ── GPU Onboard Detection ──
  let showOnboardWizard = false;
  $: needsGpuOnboard = walletConnected && !$hasGpuNode;

  function handleGpuOnboardComplete() {
    showOnboardWizard = false;
    nodeStore.init();
  }

  // ── Contract Call Modal ──
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
  let confirmTxTimer: ReturnType<typeof setTimeout> | null = null;
  function confirmTx() {
    modalStep = 'pending';
    if (confirmTxTimer) clearTimeout(confirmTxTimer);
    confirmTxTimer = setTimeout(() => {
      if (!mounted) return; // guard against unmounted state
      modalStep = 'confirmed';
    }, 2200);
  }

  // ── Phase 5: Jobs commit/reveal + Claim ──
  function handleJobCommit(jobId: string) {
    openContractModal({
      title: 'Submit Config Hash',
      contract: '0x4F0a...7E3d  HootJobs.sol',
      fn: 'commitResult',
      params: [
        { name: 'jobId', type: 'uint256', value: jobId },
        { name: 'keccak256Hash', type: 'bytes32', value: '0x' + Math.random().toString(16).slice(2, 18) + '...' },
      ],
      fee: '0 HOOT',
      gas: '~85,000',
      note: 'Submits a result hash. The actual result must be revealed in the Reveal phase.',
      accentColor: 'var(--accent)',
    });
  }

  function handleJobReveal(jobId: string) {
    openContractModal({
      title: 'Reveal Config',
      contract: '0x4F0a...7E3d  HootJobs.sol',
      fn: 'revealResult',
      params: [
        { name: 'jobId', type: 'uint256', value: jobId },
        { name: 'actualResult', type: 'bytes', value: '0x...' },
      ],
      fee: '0 HOOT',
      gas: '~95,000',
      note: 'Reveals the actual result matching the committed hash.',
      accentColor: 'var(--green)',
    });
  }

  function handleClaimRewards() {
    const eBase = +(poolBTotal * 0.4).toFixed(2);
    const eWork = +(poolBTotal * 0.6).toFixed(2);
    openContractModal({
      title: 'Claim Rewards',
      contract: '0x3E8b...5A2f  HootNodes.sol',
      fn: 'claimRewards',
      params: [
        { name: 'nodeId', type: 'string', value: myNode?.id ?? 'node-???' },
      ],
      fee: `0 HOOT (claim: ${poolBTotal.toFixed(2)} HOOT)`,
      gas: '~110,000',
      note: `Pool B (GPU Rewards): ${poolBTotal.toFixed(2)} HOOT\n  E_base (base): ${eBase} HOOT\n  E_work (work): ${eWork} HOOT`,
      accentColor: 'var(--green)',
    });
  }

  function handleBondRelease() {
    openContractModal({
      title: 'Release Bond',
      contract: '0x3E8b...5A2f  HootNodes.sol',
      fn: 'unbondNode',
      params: [
        { name: 'nodeId', type: 'string', value: myNode?.id ?? 'node-???' },
      ],
      fee: '0 HOOT',
      gas: '~75,000',
      note: '⚠ Releasing bond starts a 90-day lock period. Node operation is disabled during lockup.',
      accentColor: '#c0392b',
    });
  }

  // ── Live Jobs: derive from model.jobs (telemetry/fixture data) ──
  // Use worker Map for O(jobs + workers) instead of O(jobs × workers)
  $: workerMap = new Map(model.workers.map(w => [w.id, w]));
  $: liveJobs = model.jobs.map(j => {
    const nodeCount = j.nodeIds.length;
    const workerCount = j.workerIds.length;
    const estBudget = Math.round(nodeCount * 180 + workerCount * 45);
    let doneWorkers = 0;
    for (const wid of j.workerIds) {
      const w = workerMap.get(wid);
      if (w && (w.state === 'keep' || w.state === 'discard')) doneWorkers++;
    }
    const progress = workerCount > 0 ? Math.round((doneWorkers / workerCount) * 100) : 0;
    const rewardEst = +(3.0 + nodeCount * 0.8).toFixed(1);
    return { ...j, nodeCount, workerCount, estBudget, progress, doneWorkers, rewardEst };
  });
  // Single-pass job categorization instead of 3 separate .filter() calls
  $: jobCategories = (() => {
    const queued: typeof liveJobs = [];
    const running: typeof liveJobs = [];
    const done: typeof liveJobs = [];
    for (const j of liveJobs) {
      if (j.state === 'queued') queued.push(j);
      else if (j.state === 'training' || j.state === 'evaluating') running.push(j);
      else if (j.state === 'done') done.push(j);
    }
    return { queued, running, done };
  })();
  $: queuedJobs = jobCategories.queued;
  $: runningJobs = jobCategories.running;
  $: doneJobs = jobCategories.done;
  $: autoresearchActive = $jobStore.phase === 'running' || $jobStore.phase === 'setup';
  $: autoresearchTopic = $jobStore.topic;

  type TelemetryMode = "fixture" | "live" | "runtime";
  type TelemetryStatus = "offline" | "connecting" | "streaming" | "error";
  type ViewerLocation = { lat: number; lng: number; label: string; };

  const events = parseNdjson(demoFixtureText);
  const playback = createFixturePlayback(events);
  const emptyModel: VisualizerModel = { workers: [], nodes: [], jobs: [], tape: [] };

  let frameIndex = playback.length > 0 ? 0 : -1;
  let telemetryMode: TelemetryMode = "fixture";
  let liveModel: VisualizerModel | null = null;
  let runtimeModel: VisualizerModel | null = null;
  let lastTelemetryEvent: TelemetryEvent | null = null;
  let telemetryStatus: TelemetryStatus = "offline";
  let viewportWidth = 1440;
  let meshSimulationTime = 0;
  let meshPopulationDisplayed = 0;
  let selectedWorkerId: string | null = null;
  let recentNodeJoinDelta = 0;
  let previousNodeCount = 0;
  let telemetryUrl: string | null = null;
  let runtimeAvailable = false;
  let runtimeApiBase: string | null = null;
  let runtimeRoot: string | null = null;
  let viewerLocation: ViewerLocation | null = null;

  let liveCleanup: (() => void) | null = null;
  let runtimeCleanup: (() => void) | null = null;
  let rafHandle: number | null = null;
  let joinDeltaTimeout: number | null = null;
  let mounted = false;
  let dwellCount = 0;

  let activeTab: "gpu" | "jobs" | "bond-trust" | "notary" | "swarms" | "feed" = "gpu";

  // ── Bond & Trust animated counters ──
  const simulatedBalance = SIMULATED_BALANCE;
  let trustScore = 0;
  let mau = 0;
  const mauTarget = MAU_TARGET;
  let bondTrustDestroyed = false;

  // ── Pool B reward summary for node operators (single-pass, cached Date.now) ──
  $: poolBStats = (() => {
    const now = Date.now();
    const day = 86400000;
    let total = 0, today = 0, week = 0;
    for (const r of $rewardStore) {
      if (r.pool !== 'B' || r.amount <= 0) continue;
      total += r.amount;
      const age = now - new Date(r.timestamp).getTime();
      if (age < day) today += r.amount;
      if (age < 7 * day) week += r.amount;
    }
    return { total: +total.toFixed(2), today: +today.toFixed(2), week: +week.toFixed(2) };
  })();
  $: poolBTotal = poolBStats.total;
  $: poolBToday = poolBStats.today;
  $: poolB7d = poolBStats.week;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  $: fixtureModel = playback[Math.max(frameIndex, 0)] ?? emptyModel;
  $: model = telemetryMode === "live"
    ? liveModel ?? fixtureModel
    : telemetryMode === "runtime"
      ? runtimeModel ?? fixtureModel
      : fixtureModel;
  $: meshPopulationCeiling = model.nodes.length === 0 ? 0 : clamp(Math.max(3200, model.nodes.length * 660), 2200, 5600);
  $: meshPopulationTarget = (() => {
    if (model.nodes.length === 0) return 0;
    const lw = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
    const sw = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
    return Math.round(model.nodes.length + meshPopulationCeiling * clamp(0.07 + lw * 0.72 + sw * 0.12, 0.07, 0.97));
  })();
  $: renderNodes = buildScaledNodes(model.nodes, model.jobs, meshPopulationDisplayed, meshPopulationCeiling, meshSimulationTime);
  // Use workerMap for O(1) selectedWorker lookup instead of .find()
  $: selectedWorker = (selectedWorkerId ? workerMap.get(selectedWorkerId) : null) ?? null;
  $: if (selectedWorkerId && !workerMap.has(selectedWorkerId)) {
    selectedWorkerId = model.workers[0]?.id ?? null;
  }
  $: totalGpu = model.nodes.reduce((s, n) => s + n.gpu, 0);
  // Single-pass worker state counts instead of 2 separate .filter() calls
  $: workerStats = (() => {
    let active = 0, evaluating = 0;
    for (const w of model.workers) {
      if (isWorkerActiveState(w.state)) active++;
      if (w.state === 'evaluating') evaluating++;
    }
    return { active, evaluating };
  })();
  $: activeWorkers = workerStats.active;
  $: claimedDonors = renderNodes.filter(n => n.jobId).length;
  $: evaluatingWorkers = workerStats.evaluating;
  $: activeFlowCount = model.jobs.reduce((s, j) => s + getJobFlowCount(j), 0);
  // Single-pass tape counts instead of 3 separate filters
  $: tapeCounts = (() => {
    let keep = 0, discard = 0, crash = 0;
    for (const e of model.tape) {
      if (e.result === 'keep') keep++;
      else if (e.result === 'discard') discard++;
      else if (e.result === 'crash') crash++;
    }
    return { keep, discard, crash };
  })();
  $: keepCount = tapeCounts.keep;
  $: discardCount = tapeCounts.discard;
  $: crashCount = tapeCounts.crash;
  $: jobNodeCountMap = buildJobNodeCountMap(renderNodes);
  $: activeSwarmPreview = buildJobSwarmGroups(model.jobs, jobNodeCountMap).slice(0, 4);
  $: runtimeLabel = telemetryMode === "live"
    ? telemetryStatus
    : telemetryMode === "runtime"
      ? `runtime ${telemetryStatus}`
      : playback.length > 0
        ? `frame ${frameIndex + 1}/${playback.length}`
        : "replay idle";

  // "My GPU" — use first active worker's node, or first node
  $: myNode = model.nodes.find(n => n.state === 'training' || n.state === 'assigned') ?? model.nodes[0] ?? null;
  $: myWorker = myNode ? model.workers.find(w => w.nodeId === myNode.id) ?? null : null;
  $: myTrustScore = myNode ? Math.min(100, 65 + Math.floor(Math.abs(hashCode(myNode.id)) % 35)) : 0;

  function hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  }

  // Activity log entries
  $: activityLog = buildActivityLog(model, myNode);

  function buildActivityLog(m: typeof model, node: typeof myNode) {
    if (!node) return [];
    const entries: Array<{time: string; text: string; type: 'claim' | 'train' | 'eval' | 'result' | 'available'}> = [];
    const nodeWorker = m.workers.find(w => w.nodeId === node.id);
    if (nodeWorker) {
      const workerTapeEntries = m.tape.filter(e => e.workerId === nodeWorker.id).slice(-5);
      for (const e of workerTapeEntries) {
        if (e.result === 'keep') {
          entries.push({ time: e.ts.slice(11, 19), text: `Eval complete — keep ${e.metricDelta ? (e.metricDelta > 0 ? '+' : '') + e.metricDelta.toFixed(4) : ''} bpb`, type: 'result' });
        } else if (e.result === 'discard') {
          entries.push({ time: e.ts.slice(11, 19), text: `Eval complete — discard`, type: 'result' });
        } else {
          entries.push({ time: e.ts.slice(11, 19), text: `Experiment crashed`, type: 'result' });
        }
      }
    }
    if (node.state === 'training' && nodeWorker) {
      entries.push({ time: 'NOW', text: `Training ${nodeWorker.experimentId}...`, type: 'train' });
    } else if (node.state === 'assigned') {
      entries.push({ time: 'NOW', text: `GPU claimed for ${node.jobId ?? 'job'}`, type: 'claim' });
    } else if (node.state === 'available') {
      entries.push({ time: 'NOW', text: `GPU available — waiting for next job`, type: 'available' });
    }
    return entries.reverse().slice(0, 6);
  }

  $: {
    const nc = model.nodes.length;
    if (nc > previousNodeCount) {
      recentNodeJoinDelta = nc - previousNodeCount;
      if (joinDeltaTimeout !== null) window.clearTimeout(joinDeltaTimeout);
      joinDeltaTimeout = window.setTimeout(() => { recentNodeJoinDelta = 0; }, 900);
    }
    previousNodeCount = nc;
  }

  onMount(() => {
    if (get(jobStore).phase === 'idle') {
      if (get(isConnected)) {
        void jobStore.connectRuntime();
      }
      // demo mode: fixture playback handles visualization
    }

    viewportWidth = window.innerWidth;
    const runtimeConfig = readRuntimeConfig();
    runtimeApiBase = runtimeConfig.apiBase;
    runtimeRoot = runtimeConfig.runtimeRoot;
    telemetryUrl = resolveTelemetryUrl(window.location.search);
    telemetryMode = telemetryUrl ? "live" : "fixture";
    telemetryStatus = telemetryUrl ? "connecting" : "offline";
    meshPopulationDisplayed = model.nodes.length;
    mounted = true;

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { viewerLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "YOUR BROWSER" }; },
        () => {},
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 6000 },
      );
    }

    const handleResize = debounce(() => { viewportWidth = window.innerWidth; }, 300);
    window.addEventListener("resize", handleResize);

    // UX-N1: Single RAF loop replaces 3 separate setIntervals
    let lastFixtureT = performance.now();
    let lastClockT = lastFixtureT;
    let lastPopT = lastFixtureT;
    function tick(now: number) {
      // Fixture frame advancement (~2800ms)
      if (now - lastFixtureT >= 2800) {
        lastFixtureT = now;
        if (telemetryMode === "fixture" && playback.length > 1) {
          if (frameIndex < 0) { frameIndex = 0; }
          else if (frameIndex >= playback.length - 1) {
            dwellCount += 1;
            if (dwellCount >= 3) { dwellCount = 0; frameIndex = 0; }
          } else { frameIndex += 1; }
        }
      }
      // Simulation clock (~500ms)
      if (now - lastClockT >= 500) {
        lastClockT = now;
        meshSimulationTime += 0.5;
      }
      // Population smoothing (~300ms)
      if (now - lastPopT >= 300) {
        lastPopT = now;
        const floor = model.nodes.length;
        const cur = Math.max(meshPopulationDisplayed, floor);
        if (cur !== meshPopulationTarget) {
          const step = Math.max(4, Math.ceil(Math.abs(meshPopulationTarget - cur) * 0.03));
          meshPopulationDisplayed = cur < meshPopulationTarget ? Math.min(meshPopulationTarget, cur + step) : Math.max(meshPopulationTarget, cur - step);
        }
      }
      rafHandle = requestAnimationFrame(tick);
    }
    rafHandle = requestAnimationFrame(tick);

    if (telemetryUrl) {
      const conn = connectTelemetryStream({
        url: telemetryUrl,
        onSnapshot(m, e) { liveModel = m; lastTelemetryEvent = e; telemetryStatus = "streaming"; },
        onError() { telemetryStatus = "error"; },
      });
      liveCleanup = () => conn.unsubscribe();
    } else {
      void connectRuntimeMesh();
    }

    // Bond & Trust animated counters
    const isDestroyed = () => bondTrustDestroyed;
    const delayBondTrust = setTimeout(() => {
      animateCounter(0, TRUST_SCORE_TARGET, 2000, v => trustScore = v, isDestroyed);
      animateCounter(0, MAU_TARGET * 0.618, 1500, v => mau = v, isDestroyed);
    }, 400);

    return () => {
      mounted = false;
      bondTrustDestroyed = true;
      clearTimeout(delayBondTrust);
      if (confirmTxTimer) clearTimeout(confirmTxTimer);
      window.removeEventListener("resize", handleResize);
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      if (joinDeltaTimeout !== null) clearTimeout(joinDeltaTimeout);
      liveCleanup?.();
      runtimeCleanup?.();
    };
  });

  async function connectRuntimeMesh() {
    telemetryStatus = "connecting";

    try {
      const mesh = await fetchRuntimeMesh({ apiBase: runtimeApiBase, runtimeRoot });
      const hasRuntimeData = mesh.workspaces.length > 0 || mesh.totals.results > 0 || mesh.controller?.reachable;
      if (!hasRuntimeData) {
        telemetryStatus = "offline";
        runtimeAvailable = false;
        return false;
      }

      runtimeModel = mapRuntimeMeshToVisualizer(mesh);
      runtimeAvailable = true;
      telemetryMode = "runtime";
      telemetryStatus = "streaming";

      runtimeCleanup?.();
      runtimeCleanup = subscribeRuntimeMesh({
        apiBase: runtimeApiBase,
        runtimeRoot,
        onSnapshot(nextMesh) {
          runtimeModel = mapRuntimeMeshToVisualizer(nextMesh);
          runtimeAvailable = true;
          if (telemetryMode === "runtime") {
            telemetryStatus = "streaming";
          }
        },
        onError() {
          runtimeAvailable = false;
          if (telemetryMode === "runtime") {
            telemetryStatus = "error";
            telemetryMode = "fixture";
          }
        },
      });

      return true;
    } catch {
      telemetryStatus = "offline";
      runtimeAvailable = false;
      return false;
    }
  }
</script>

<div class="network" class:mounted>
  <NetworkHUD
    nodeCount={renderNodes.length}
    {recentNodeJoinDelta}
    {totalGpu}
    {activeWorkers}
    {activeFlowCount}
    {runtimeLabel}
    myNodeState={myNode?.state ?? null}
    {telemetryMode}
    {telemetryUrl}
    {runtimeAvailable}
    on:modeChange={async e => {
      if (e.detail === 'runtime') {
        if (!runtimeAvailable) {
          await connectRuntimeMesh();
        } else {
          telemetryMode = 'runtime';
        }
        return;
      }
      telemetryMode = e.detail;
    }}
    on:viewGlobe={() => router.navigate('network')}
  />

  <!-- Content: Canvas + Side Panel -->
  <div class="content">
    <div class="canvas-area">
      <MeshCanvas nodes={renderNodes} jobs={model.jobs} workers={model.workers} {selectedWorker} viewerLocation={viewerLocation ? {lat: viewerLocation.lat, lng: viewerLocation.lng} : null} />
    </div>

    <div class="side-panel">
      <!-- GPU Onboard Prompt -->
      {#if needsGpuOnboard && !showOnboardWizard}
        <button class="gpu-onboard-prompt" on:click={() => { showOnboardWizard = true; }}>
          <span class="gop-icon"><PixelIcon type="sparkle" size={16} /></span>
          <div class="gop-body">
            <span class="gop-title">Register your GPU</span>
            <span class="gop-desc">Connect your GPU to the network and earn compute rewards</span>
          </div>
          <span class="gop-arrow">→</span>
        </button>
      {/if}

      <!-- My Node Summary (when GPU registered) -->
      {#if $hasGpuNode}
        <div class="my-node-card">
          <div class="mnc-top">
            <span class="mnc-id">{$nodeStore.nodeId}</span>
            <span class="mnc-sep">·</span>
            <span class="mnc-gpu">{$nodeStore.gpuModel}</span>
            <span class="mnc-sep">·</span>
            <span class="mnc-status" class:mnc-on={$nodeStore.online}>● {$nodeStore.online ? 'ON' : 'OFF'}</span>
          </div>
          <div class="mnc-stats">
            <span>{$nodeStore.jobsCompleted} jobs completed</span>
            <span class="mnc-sep">·</span>
            <span class="mnc-earn">+{$nodeStore.totalEarnings.toFixed(1)} HOOT earned</span>
          </div>
          <div class="mnc-bottom">
            <span>Trust: {$nodeStore.trustScore}/1000</span>
            <span class="mnc-sep">·</span>
            <span>PoAW blocks: {$nodeStore.poawBlocks}</span>
          </div>
        </div>
      {/if}

      <div class="panel-tabs" role="tablist" aria-label="Network panels">
        <button class="ptab" class:active={activeTab === 'gpu'} on:click={() => activeTab = 'gpu'} role="tab" aria-selected={activeTab === 'gpu'}>
          My GPU
        </button>
        <button class="ptab" class:active={activeTab === 'bond-trust'} on:click={() => activeTab = 'bond-trust'} role="tab" aria-selected={activeTab === 'bond-trust'}>
          Bond &amp; Trust
        </button>
        <button class="ptab" class:active={activeTab === 'jobs'} on:click={() => activeTab = 'jobs'} role="tab" aria-selected={activeTab === 'jobs'}>
          Jobs <span class="tbadge" class:tbadge-green={liveJobs.length > 0}>{liveJobs.length}</span>
        </button>
        <button class="ptab" class:active={activeTab === 'notary'} on:click={() => activeTab = 'notary'} role="tab" aria-selected={activeTab === 'notary'}>
          Notary
        </button>
        <button class="ptab" class:active={activeTab === 'swarms'} on:click={() => activeTab = 'swarms'} role="tab" aria-selected={activeTab === 'swarms'}>
          Swarms <span class="tbadge">{model.jobs.length}</span>
        </button>
        <button class="ptab" class:active={activeTab === 'feed'} on:click={() => activeTab = 'feed'} role="tab" aria-selected={activeTab === 'feed'}>
          Feed <span class="tbadge">{model.tape.length}</span>
        </button>
      </div>

      <div class="panel-body">
        {#key activeTab}
        <div class="tab-content" in:fly={{ x: 12, duration: 200, delay: 40 }} out:fade={{ duration: 80 }}>
        {#if activeTab === 'gpu'}
          <div class="psection gpu-hero">
            {#if myNode}
              <h4 class="slabel">My Node</h4>
              <NodeCard node={myNode} worker={myWorker} trustScore={myTrustScore} selected={true} showEarnings={true} />

              <!-- Phase 5: Reward claim button -->
              {#if poolBTotal > 0}
                <button class="reward-claim-btn" on:click={handleClaimRewards}>
                  Claim Rewards ({poolBTotal.toFixed(2)} HOOT) →
                </button>
              {/if}

              <h4 class="slabel" style="margin-top: 16px;">Activity Log</h4>
              <div class="activity-log">
                {#each activityLog as entry, i (entry.time + entry.text + entry.type)}
                  <div class="log-entry" in:fly={{ x: -10, duration: 250, delay: i * 50 }}>
                    <div class="log-indicator">
                      <span class="log-dot" class:train={entry.type === 'train'} class:claim={entry.type === 'claim'} class:result={entry.type === 'result'} class:available={entry.type === 'available'}></span>
                      {#if i < activityLog.length - 1}
                        <span class="log-line"></span>
                      {/if}
                    </div>
                    <div class="log-content">
                      <span class="log-text">{entry.text}</span>
                      <span class="log-time">{entry.time}</span>
                    </div>
                  </div>
                {/each}
                {#if activityLog.length === 0}
                  <div class="empty">No activity yet</div>
                {/if}
              </div>
            {:else}
              <div class="empty">No GPU node detected</div>
            {/if}
          </div>
        {:else if activeTab === 'jobs'}
          <JobsPanel
            {queuedJobs}
            {runningJobs}
            {doneJobs}
            totalJobCount={liveJobs.length}
            {autoresearchActive}
            {autoresearchTopic}
            myNodeId={myNode?.id ?? null}
          />
          <!-- Phase 5: Commit/Reveal actions per job -->
          {#if runningJobs.length > 0 || doneJobs.length > 0}
            <div class="psection job-actions-section">
              <h4 class="slabel">On-Chain Actions</h4>
              <div class="job-action-list">
                {#each runningJobs as job (job.id)}
                  <div class="job-action-row">
                    <span class="ja-id">{job.id.slice(0, 8)}</span>
                    <span class="ja-state ja-executing">EXECUTING</span>
                    <button class="ja-btn" on:click={() => handleJobCommit(job.id)}>commit →</button>
                  </div>
                {/each}
                {#each doneJobs as job (job.id)}
                  <div class="job-action-row">
                    <span class="ja-id">{job.id.slice(0, 8)}</span>
                    <span class="ja-state ja-committed">COMMITTED</span>
                    <button class="ja-btn ja-btn-reveal" on:click={() => handleJobReveal(job.id)}>reveal →</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else if activeTab === 'bond-trust'}
          <div class="psection bond-trust-section">
            <BondPanel {simulatedBalance} on:openModal={e => openContractModal(e.detail)} />
            <div style="margin-top: 20px;">
              <TrustGaugePanel {trustScore} {mau} {mauTarget} />
            </div>
            <div class="node-reward-summary">
              <h4 class="slabel" style="margin-top: 16px;">GPU Earnings (Pool B)</h4>
              <div class="nrs-grid">
                <div class="nrs-card nrs-total">
                  <span class="nrs-val">{poolBTotal.toFixed(2)}</span>
                  <span class="nrs-lbl">Total HOOT</span>
                </div>
                <div class="nrs-card">
                  <span class="nrs-val">{poolBToday.toFixed(2)}</span>
                  <span class="nrs-lbl">Today</span>
                </div>
                <div class="nrs-card">
                  <span class="nrs-val">{poolB7d.toFixed(2)}</span>
                  <span class="nrs-lbl">7-Day</span>
                </div>
              </div>
            </div>
            <!-- Phase 5: Bond release -->
            {#if $hasGpuNode}
              <div class="bond-release-section">
                <button class="bond-release-btn" on:click={handleBondRelease}>
                  Release Bond
                </button>
                <span class="bond-release-warn">⚠ 90-day lock period begins</span>
              </div>
            {/if}
          </div>
        {:else if activeTab === 'notary'}
          <div class="psection">
            <NotaryPanel on:openModal={e => openContractModal(e.detail)} />
          </div>
        {:else if activeTab === 'swarms'}
          <div class="psection">
            <h4 class="slabel">Active Swarms</h4>
            {#if activeSwarmPreview.length > 0}
              {#each activeSwarmPreview as swarm (swarm.job.id)}
                <div class="job-card" class:training={swarm.job.state === 'training'}>
                  <div class="jhead">
                    <span class="jdot" class:training={swarm.job.state === 'training'} class:evaluating={swarm.job.state === 'evaluating'}></span>
                    <span class="jid">{swarm.job.id.slice(0, 8)}</span>
                    <span class="jstate">{swarm.job.state}</span>
                  </div>
                  <div class="jmeta">
                    <span>{swarm.nodeCount} nodes</span>
                    <span>{getJobFlowCount(swarm.job)} flows</span>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="empty">No active swarms</div>
            {/if}
          </div>
          <div class="psection">
            <h4 class="slabel">Mesh Stats</h4>
            <div class="stats-grid">
              <div class="scard"><span class="sv">{renderNodes.length.toLocaleString()}</span><span class="sl">Donors</span></div>
              <div class="scard"><span class="sv accent">{claimedDonors.toLocaleString()}</span><span class="sl">Claimed</span></div>
              <div class="scard"><span class="sv gold">{evaluatingWorkers}</span><span class="sl">Verifying</span></div>
              <div class="scard"><span class="sv">{activeFlowCount}</span><span class="sl">Flows</span></div>
            </div>
          </div>
          <div class="psection">
            <h4 class="slabel">Results</h4>
            <div class="results-row">
              <span class="rc keep">{keepCount} keep</span>
              <span class="rc discard">{discardCount} discard</span>
              <span class="rc crash">{crashCount} crash</span>
            </div>
          </div>
          <div class="psection scroll">
            <h4 class="slabel">Workers</h4>
            <WorkerBoard
              workers={model.workers} jobs={model.jobs} renderNodes={renderNodes}
              tape={model.tape} compact={true} tablet={viewportWidth < 1280}
              {selectedWorkerId} on:select={e => selectedWorkerId = e.detail}
            />
          </div>
        {:else if activeTab === 'feed'}
          <div class="psection scroll">
            <ExperimentTape tape={model.tape} compact={true} />
          </div>
        {/if}
        </div>
        {/key}
      </div>
    </div>
  </div>

  <!-- CONTRACT CALL MODAL -->
  <ContractCallModal
    {modalCall}
    {modalOpen}
    {modalStep}
    {walletConnected}
    {walletAddress}
    on:close={closeModal}
    on:confirm={confirmTx}
    on:connectWallet={() => { wallet.connect('Phantom'); }}
  />

  <!-- GPU Onboard Wizard Overlay -->
  {#if showOnboardWizard}
    <GPUOnboardWizard
      on:close={() => { showOnboardWizard = false; }}
      on:complete={handleGpuOnboardComplete}
    />
  {/if}
</div>

<style>
  .network {
    height: calc(100vh - 52px);
    display: flex;
    flex-direction: column;
    background: var(--page-bg, #FAF9F7);
    opacity: 0;
    transition: opacity 400ms ease;
    overflow: hidden;
  }
  .network.mounted { opacity: 1; }

  /* Content */
  .content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 340px;
    min-height: 0;
  }
  .canvas-area {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .canvas-area::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(250, 249, 247, 0.15) 100%);
    pointer-events: none;
    animation: canvas-breathe 6s ease-in-out infinite;
    z-index: 1;
  }
  @keyframes canvas-breathe {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.5; }
  }

  /* Side Panel */
  .side-panel {
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(229, 224, 218, 0.5);
    background: rgba(255, 255, 255, 0.95);
    overflow: hidden;
    animation: slideInRight var(--dur-entrance, 700ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
  }
  .panel-tabs {
    display: flex;
    gap: 4px;
    padding: 6px;
    flex-shrink: 0;
    background: var(--border-subtle, #EDEAE5);
  }
  .ptab {
    appearance: none;
    border: none;
    background: none;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 6px;
    font-size: 0.74rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
    cursor: pointer;
    border-radius: 8px;
    transition: all 150ms ease;
  }
  .ptab:hover { color: var(--text-secondary, #6b6560); background: rgba(255,255,255,0.5); }
  .ptab.active { color: var(--text-primary, #2D2D2D); background: var(--surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .tbadge {
    padding: 1px 5px;
    border-radius: 100px;
    background: var(--border-subtle, #EDEAE5);
    font-size: 0.6rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .ptab.active .tbadge {
    background: rgba(217, 119, 87, 0.1);
    color: var(--accent, #D97757);
  }
  .tbadge-green {
    background: rgba(39, 134, 74, 0.12);
    color: var(--green, #27864a);
  }
  .ptab.active .tbadge-green {
    background: rgba(39, 134, 74, 0.15);
    color: var(--green, #27864a);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.08) transparent;
    position: relative;
  }
  /* UX-N3: Tab content transition wrapper */
  .tab-content {
    min-height: 100%;
  }
  .panel-body::-webkit-scrollbar { width: 4px; }
  .panel-body::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }

  .psection { padding: 14px 16px; border-bottom: 1px solid var(--border-subtle, #EDEAE5); }
  .psection.scroll { padding: 8px; border-bottom: none; }
  .psection:last-child { border-bottom: none; }
  .slabel {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent, #D97757);
    margin: 0 0 10px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Job Cards (Swarms tab) */
  .job-card {
    padding: 10px 12px;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--border, #E5E0DA);
    margin-bottom: 6px;
    transition: all 150ms ease;
  }
  .job-card:hover { border-color: var(--text-muted, #9a9590); }
  .job-card.training { border-color: rgba(217, 119, 87, 0.3); background: rgba(217, 119, 87, 0.03); }
  .jhead { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .jdot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
  .jdot.training { background: var(--accent, #D97757); box-shadow: 0 0 6px rgba(217, 119, 87, 0.4); }
  .jdot.evaluating { background: var(--gold, #b7860e); }
  .jid {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .jstate {
    margin-left: auto;
    font-size: 0.62rem;
    font-weight: 500;
    color: var(--text-muted, #9a9590);
    padding: 1px 6px;
    border-radius: 100px;
    background: var(--border-subtle, #EDEAE5);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .jmeta { display: flex; gap: 10px; font-size: 0.68rem; color: var(--text-muted, #9a9590); }

  /* Stats Grid */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .scard {
    padding: 8px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border-subtle, #EDEAE5);
    text-align: center;
  }
  .sv {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    line-height: 1.2;
  }
  .sv.accent { color: var(--accent, #D97757); }
  .sv.gold { color: var(--gold, #b7860e); }
  .sl {
    display: block;
    font-size: 0.56rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted, #9a9590);
    margin-top: 1px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  /* Results */
  .results-row { display: flex; gap: 6px; }
  .rc {
    padding: 4px 10px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.7rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .rc.keep { background: rgba(39, 134, 74, 0.08); color: var(--green, #27864a); }
  .rc.discard { background: rgba(192, 57, 43, 0.08); color: var(--red, #c0392b); }
  .rc.crash { background: rgba(139, 58, 98, 0.08); color: #8b3a62; }

  .empty { padding: 20px; text-align: center; color: var(--text-muted, #9a9590); font-size: 0.78rem; }

  /* ====== NODE REWARD SUMMARY ====== */
  .nrs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .nrs-card {
    background: var(--page-bg, #FAF9F7);
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: var(--radius-sm, 6px);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .nrs-card.nrs-total {
    border-color: var(--accent, #D97757);
    background: rgba(217,119,87,0.04);
  }
  .nrs-val {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-primary, #2D2D2D);
    font-variant-numeric: tabular-nums;
  }
  .nrs-lbl {
    font-size: 0.58rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #9a9590);
  }

  /* My GPU tab */
  .gpu-hero { padding: 14px 16px; }

  /* Activity Log */
  .activity-log { display: flex; flex-direction: column; }
  /* UX-N5: log entry uses Svelte fly transition (replaces CSS animation) */
  .log-entry {
    display: flex;
    gap: 10px;
  }
  .log-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 12px;
    flex-shrink: 0;
    padding-top: 8px;
  }
  .log-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--text-muted, #9a9590);
    flex-shrink: 0;
    transition: all 200ms ease;
  }
  .log-dot.train {
    background: var(--accent, #D97757);
    box-shadow: 0 0 6px rgba(217, 119, 87, 0.4);
  }
  .log-dot.claim {
    background: var(--accent, #D97757);
    box-shadow: 0 0 4px rgba(217, 119, 87, 0.3);
  }
  .log-dot.result {
    background: var(--green, #27864a);
    box-shadow: 0 0 4px rgba(39, 134, 74, 0.3);
  }
  .log-dot.available {
    background: var(--green, #27864a);
  }
  .log-line {
    width: 1.5px;
    flex: 1;
    min-height: 12px;
    background: var(--border-subtle, #EDEAE5);
    margin: 3px 0;
  }
  .log-content {
    flex: 1;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(0, 0, 0, 0.015);
    border: 1px solid var(--border-subtle, #EDEAE5);
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .log-text {
    font-size: 0.7rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-secondary, #6b6560);
    line-height: 1.3;
  }
  .log-time {
    font-size: 0.6rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--text-muted, #9a9590);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .network { transition: none; }
    .side-panel { animation: none; }
    .canvas-area::after { animation: none; }
    .log-dot { transition: none; }
    .job-card { transition: none; }
    .ptab { transition: none; }
  }

  @media (max-width: 1024px) { .content { grid-template-columns: 1fr 300px; } }
  @media (max-width: 860px) {
    .content { grid-template-columns: 1fr; grid-template-rows: 55vh 1fr; }
    .side-panel {
      border-left: none;
      border-top: 1px solid var(--border, #E5E0DA);
      animation: fadeInUp var(--dur-entrance, 700ms) var(--ease-out-expo) both;
    }
  }
  @media (max-width: 600px) {
    .content { grid-template-rows: 38vh 1fr; }
    .canvas-area {
      position: fixed;
      top: calc(52px + 44px);
      left: 0; right: 0;
      height: 38vh;
      z-index: 0;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
    .side-panel {
      position: relative;
      z-index: 2;
      margin-top: 38vh;
      border-radius: var(--radius-lg, 16px) var(--radius-lg, 16px) 0 0;
      min-height: 50vh;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
    .panel-tabs {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      position: sticky;
      top: 0;
      z-index: 3;
    }
    .panel-tabs::-webkit-scrollbar { display: none; }
    .ptab {
      flex: 0 0 auto;
      min-width: 72px;
      min-height: 44px;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }
    .content { display: block; }
  }

  /* ── GPU Onboard Prompt ── */
  .gpu-onboard-prompt {
    appearance: none; border: 1.5px dashed var(--accent, #D97757);
    background: rgba(217, 119, 87, 0.04);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: all 200ms;
    text-align: left; width: 100%;
    margin-bottom: 8px;
  }
  .gpu-onboard-prompt:hover {
    background: rgba(217, 119, 87, 0.08);
    box-shadow: 0 2px 10px rgba(217, 119, 87, 0.12);
    transform: translateY(-1px);
  }
  .gop-icon { font-size: 1.2rem; flex-shrink: 0; }
  .gop-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .gop-title { font-size: 0.78rem; font-weight: 700; color: var(--text-primary, #2D2D2D); }
  .gop-desc { font-size: 0.6rem; color: var(--text-muted, #9a9590); }
  .gop-arrow { font-size: 0.82rem; font-weight: 600; color: var(--accent, #D97757); }

  /* ── My Node Summary Card ── */
  .my-node-card {
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(39, 134, 74, 0.04);
    border: 1px solid rgba(39, 134, 74, 0.15);
    display: flex; flex-direction: column; gap: 4px;
    margin-bottom: 8px;
    font-size: 0.68rem;
  }
  .mnc-top {
    display: flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-weight: 600;
    color: var(--text-primary, #2D2D2D);
    flex-wrap: wrap;
  }
  .mnc-gpu { color: var(--text-secondary, #6b6560); font-weight: 500; }
  .mnc-status { color: var(--text-muted, #9a9590); }
  .mnc-on { color: var(--green, #27864a); }
  .mnc-sep { color: var(--border, #E5E0DA); }
  .mnc-stats {
    display: flex; align-items: center; gap: 4px;
    color: var(--text-secondary, #6b6560);
  }
  .mnc-earn { font-family: var(--font-mono); font-weight: 600; color: var(--green, #27864a); }
  .mnc-bottom {
    display: flex; align-items: center; gap: 4px;
    color: var(--text-muted, #9a9590);
    font-size: 0.6rem;
  }

  /* ═══ Phase 5: Job commit/reveal actions ═══ */
  .job-actions-section { margin-top: 12px; }
  .job-action-list { display: flex; flex-direction: column; gap: 6px; }
  .job-action-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--border-subtle, #EDEAE5);
    border-radius: 10px; background: var(--surface, #fff);
  }
  .ja-id {
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600;
    color: var(--text-primary); flex-shrink: 0;
  }
  .ja-state {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 700;
    padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  }
  .ja-executing { background: rgba(217,119,87,0.08); color: var(--accent, #D97757); }
  .ja-committed { background: rgba(39,134,74,0.08); color: var(--green, #27864a); }
  .ja-btn {
    appearance: none; border: 1px solid var(--accent, #D97757);
    background: transparent; color: var(--accent, #D97757);
    font-family: var(--font-mono); font-size: 0.66rem; font-weight: 700;
    padding: 5px 12px; border-radius: 8px; cursor: pointer;
    margin-left: auto; transition: all 150ms; white-space: nowrap;
  }
  .ja-btn:hover { background: var(--accent, #D97757); color: #fff; }
  .ja-btn-reveal { border-color: var(--green, #27864a); color: var(--green, #27864a); }
  .ja-btn-reveal:hover { background: var(--green, #27864a); color: #fff; }

  /* ═══ Phase 5: Reward claim ═══ */
  .reward-claim-btn {
    appearance: none; border: 1.5px solid var(--green, #27864a);
    background: rgba(39,134,74,0.04); color: var(--green, #27864a);
    font-family: var(--font-mono); font-size: 0.76rem; font-weight: 700;
    padding: 10px 18px; border-radius: 12px; cursor: pointer;
    width: 100%; margin-top: 12px; transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .reward-claim-btn:hover {
    background: var(--green, #27864a); color: #fff;
    box-shadow: 0 4px 16px rgba(39,134,74,0.2);
    transform: translateY(-1px);
  }

  /* ═══ Phase 5: Bond release ═══ */
  .bond-release-section {
    display: flex; align-items: center; gap: 10px;
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid var(--border-subtle, #EDEAE5);
  }
  .bond-release-btn {
    appearance: none; border: 1px solid #c0392b;
    background: transparent; color: #c0392b;
    font-size: 0.72rem; font-weight: 600;
    padding: 8px 16px; border-radius: 8px; cursor: pointer;
    transition: all 150ms;
  }
  .bond-release-btn:hover { background: rgba(192,57,43,0.06); }
  .bond-release-warn {
    font-size: 0.62rem; color: var(--text-muted, #9a9590);
    font-style: italic;
  }
</style>

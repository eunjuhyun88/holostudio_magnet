import { get, writable } from 'svelte/store';

import { debounce } from '../utils/perf.ts';
import { createFixturePlayback, demoFixtureText, parseNdjson } from '../utils/fixturePlayer.ts';
import { isWorkerActiveState } from '../utils/meshSim.ts';
import { fetchDashboardEvents, fetchDashboardSummary, fetchRuntimeMesh, readRuntimeConfig, subscribeRuntimeMesh } from '../api/client.ts';
import { hasRuntimeMeshData } from '../api/meshAdapter.ts';
import { mapRuntimeMeshToVisualizer } from '../api/runtimeVisualizerAdapter.ts';
import { TOPIC_SUGGESTIONS } from '../data/topicSuggestions.ts';
import {
  DEMO_JOBS,
  type DashboardJob,
  type ResearchMetrics,
  type SystemMetrics,
} from '../data/dashboardFixture.ts';
import { getDashboardData, getDashboardEvents } from '../services/dashboardService.ts';
import type {
  DashboardData,
  DashboardEvent,
  ModelsSummary,
  NetworkSummary,
  PortfolioSummary,
  ProtocolSummary,
  ResearchSummary,
} from '../services/types.ts';
import type { Node, VisualizerModel, Worker } from '../utils/types.ts';
import { jobStore } from './jobStore.ts';
import { apiBase as apiBaseStore, isConnected } from './connectionStore.ts';
import { router } from './router.ts';
import { wallet } from './walletStore.ts';
import { widgetStore } from './widgetStore.ts';

interface DashboardSnapshot {
  data: DashboardData;
  events: DashboardEvent[];
  model: VisualizerModel;
}

export interface DashboardViewModel {
  mounted: boolean;
  topicSuggestions: string[];
  model: VisualizerModel;
  renderNodes: Node[];
  activeWorkers: Worker[];
  totalNodes: number;
  idleWorkers: number;
  liveJobs: DashboardJob[];
  runningCount: number;
  doneCount: number;
  liveResearch: ResearchMetrics;
  liveSystem: SystemMetrics;
  researchSummary: ResearchSummary;
  networkSummary: NetworkSummary;
  protocolSummary: ProtocolSummary;
  modelsSummary: ModelsSummary;
  portfolioSummary: PortfolioSummary;
  events: DashboardEvent[];
  modelsTrained: number;
  isLoggedIn: boolean;
}

const playback = createFixturePlayback(parseNdjson(demoFixtureText));
const emptyModel: VisualizerModel = { workers: [], nodes: [], jobs: [], tape: [] };

function createStaticSnapshot(): DashboardSnapshot {
  const model = playback[0] ?? emptyModel;
  const activeWorkers = model.workers.filter((worker) => isWorkerActiveState(worker.state));
  const idleWorkers = Math.max(0, model.workers.length - activeWorkers.length);
  const system = buildSystemMetricsFromRuntime({
    jobs: DEMO_JOBS,
    model,
    network: {
      nodes: model.nodes.length || 8,
      gpuCount: model.nodes.reduce((sum, node) => sum + node.gpu, 0) || 8,
      activeWorkers: activeWorkers.length,
      idleWorkers,
      cpuUsage: model.workers.length > 0 ? Math.round((activeWorkers.length / model.workers.length) * 100) : 0,
      memUsedGb: Math.max(8, model.nodes.length * 3),
      memTotalGb: 128,
      vramUsedGb: Math.max(12, activeWorkers.length * 8),
      vramTotalGb: 96,
    },
  });

  return {
    data: getDashboardData(DEMO_JOBS, system, activeWorkers.length, idleWorkers),
    events: getDashboardEvents(),
    model,
  };
}

function buildViewModel(snapshot: DashboardSnapshot, mounted: boolean, isLoggedIn: boolean): DashboardViewModel {
  const model = snapshot.model;
  const activeWorkers = model.workers.filter((worker) => isWorkerActiveState(worker.state));
  const liveJobs = snapshot.data.jobs;
  const runningCount = liveJobs.filter((job) => job.status === 'running').length;
  const doneCount = liveJobs.filter((job) => job.status === 'complete').length;
  const liveSystem = buildSystemMetricsFromRuntime({
    jobs: liveJobs,
    model,
    network: snapshot.data.network,
  });
  const liveResearch = buildResearchMetricsFromRuntime({
    jobs: liveJobs,
    model,
    research: snapshot.data.research,
    activeWorkers,
  });

  return {
    mounted,
    topicSuggestions: TOPIC_SUGGESTIONS,
    model,
    renderNodes: model.nodes,
    activeWorkers,
    totalNodes: snapshot.data.network.nodes,
    idleWorkers: snapshot.data.network.idleWorkers,
    liveJobs,
    runningCount,
    doneCount,
    liveResearch,
    liveSystem,
    researchSummary: snapshot.data.research,
    networkSummary: snapshot.data.network,
    protocolSummary: snapshot.data.protocol,
    modelsSummary: snapshot.data.models,
    portfolioSummary: snapshot.data.portfolio,
    events: snapshot.events,
    modelsTrained: snapshot.data.models.count * 282,
    isLoggedIn,
  };
}

function buildResearchMetricsFromRuntime(input: {
  jobs: DashboardJob[];
  model: VisualizerModel;
  research: ResearchSummary;
  activeWorkers: Worker[];
}): ResearchMetrics {
  const configuredJobs = input.jobs.length > 0 ? input.jobs.length : 1;
  const configsTested = input.model.tape.length > 0
    ? `${input.model.tape.length}/${Math.max(input.model.tape.length, configuredJobs * 10)}`
    : `${input.research.completedJobs}/${Math.max(configuredJobs, input.research.completedJobs)}`;

  return {
    activeJobs: input.research.runningJobs + input.research.queuedJobs,
    activeAgents: input.activeWorkers.length || input.research.runningJobs || 0,
    configsTested,
    findings: input.research.totalFindings,
    hitRate: input.research.hitRate,
  };
}

function buildSystemMetricsFromRuntime(input: {
  jobs: DashboardJob[];
  model: VisualizerModel;
  network: NetworkSummary;
}): SystemMetrics {
  return {
    nodes: input.network.nodes,
    cpuCores: input.model.nodes.reduce((sum, node) => sum + node.cpu, 0) || Math.max(32, input.network.nodes * 4),
    cpuUsage: input.network.cpuUsage,
    memUsedGb: input.network.memUsedGb,
    memTotalGb: input.network.memTotalGb,
    vramUsedGb: input.network.vramUsedGb,
    vramTotalGb: input.network.vramTotalGb,
    activeFlows: input.model.jobs.length || input.jobs.filter((job) => job.status !== 'complete').length,
  };
}

function createDashboardStore() {
  let snapshot = createStaticSnapshot();
  let mounted = false;
  let attachCount = 0;
  let currentWalletMode = false;
  let currentConnectedMode = get(isConnected);
  let currentApiBase = get(apiBaseStore);

  const store = writable<DashboardViewModel>(buildViewModel(snapshot, mounted, currentWalletMode));
  const { subscribe, set } = store;

  let walletUnsubscribe: (() => void) | null = null;
  let connectionUnsubscribe: (() => void) | null = null;
  let apiBaseUnsubscribe: (() => void) | null = null;
  let runtimeCleanup: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;

  function publish() {
    set(buildViewModel(snapshot, mounted, currentWalletMode));
  }

  function syncWidgetLayout(loggedIn: boolean) {
    widgetStore.loadLayout(loggedIn);
    if (typeof window !== 'undefined') {
      widgetStore.adjustForViewport(window.innerWidth);
    }
  }

  async function refreshRuntimeSnapshot(meshOverride?: Awaited<ReturnType<typeof fetchRuntimeMesh>>) {
    const runtimeConfig = readRuntimeConfig();
    const apiBase = runtimeConfig.apiBase ?? currentApiBase;
    const runtimeRoot = runtimeConfig.runtimeRoot;

    try {
      const [mesh, data, events] = await Promise.all([
        meshOverride ? Promise.resolve(meshOverride) : fetchRuntimeMesh({ apiBase, runtimeRoot }),
        fetchDashboardSummary({ apiBase, runtimeRoot }),
        fetchDashboardEvents({ apiBase, runtimeRoot }),
      ]);

      snapshot = {
        model: hasRuntimeMeshData(mesh) ? mapRuntimeMeshToVisualizer(mesh) : emptyModel,
        data,
        events,
      };
      publish();
    } catch {
      if (!currentConnectedMode) {
        snapshot = createStaticSnapshot();
        publish();
      }
    }
  }

  function disconnectRuntimeStream() {
    if (runtimeCleanup) {
      runtimeCleanup();
      runtimeCleanup = null;
    }
  }

  function connectRuntimeStream() {
    disconnectRuntimeStream();
    if (typeof window === 'undefined' || typeof EventSource === 'undefined' || !currentConnectedMode) {
      return;
    }

    const runtimeConfig = readRuntimeConfig();
    const apiBase = runtimeConfig.apiBase ?? currentApiBase;
    const runtimeRoot = runtimeConfig.runtimeRoot;

    runtimeCleanup = subscribeRuntimeMesh({
      apiBase,
      runtimeRoot,
      onSnapshot: (mesh) => {
        void refreshRuntimeSnapshot(mesh);
      },
      onError: () => {
        // Keep the last good runtime snapshot until the next successful refresh.
      },
    });
  }

  function refreshSource() {
    if (currentConnectedMode) {
      void refreshRuntimeSnapshot();
      connectRuntimeStream();
      return;
    }

    disconnectRuntimeStream();
    snapshot = createStaticSnapshot();
    publish();
  }

  function init() {
    if (typeof window === 'undefined') return;
    attachCount += 1;
    if (attachCount > 1) return;

    mounted = true;
    currentWalletMode = get(wallet).connected;
    currentConnectedMode = get(isConnected);
    currentApiBase = get(apiBaseStore);
    syncWidgetLayout(currentWalletMode);
    publish();

    walletUnsubscribe = wallet.subscribe(($wallet) => {
      if ($wallet.connected === currentWalletMode) {
        return;
      }
      currentWalletMode = $wallet.connected;
      syncWidgetLayout(currentWalletMode);
      publish();
    });

    connectionUnsubscribe = isConnected.subscribe((connected) => {
      if (connected === currentConnectedMode || attachCount === 0) {
        return;
      }
      currentConnectedMode = connected;
      refreshSource();
    });

    apiBaseUnsubscribe = apiBaseStore.subscribe((nextApiBase) => {
      if (nextApiBase === currentApiBase || attachCount === 0) {
        return;
      }
      currentApiBase = nextApiBase;
      if (currentConnectedMode) {
        refreshSource();
      }
    });

    resizeHandler = debounce(() => {
      widgetStore.adjustForViewport(window.innerWidth);
    }, 300);
    window.addEventListener('resize', resizeHandler, { passive: true });

    refreshSource();
  }

  function destroy() {
    if (typeof window === 'undefined') return;
    attachCount = Math.max(0, attachCount - 1);
    if (attachCount > 0) return;

    mounted = false;
    disconnectRuntimeStream();

    walletUnsubscribe?.();
    walletUnsubscribe = null;

    connectionUnsubscribe?.();
    connectionUnsubscribe = null;

    apiBaseUnsubscribe?.();
    apiBaseUnsubscribe = null;

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    publish();
  }

  async function startResearch(topic: string) {
    if (get(isConnected)) {
      const runtimeConfig = readRuntimeConfig();
      const jobId = await jobStore.startRuntimeJob(topic, {
        apiBase: runtimeConfig.apiBase ?? get(apiBaseStore),
        runtimeRoot: runtimeConfig.runtimeRoot,
      });
      router.navigate('studio', jobId ? { topic, jobId } : { topic });
      void refreshRuntimeSnapshot();
      return;
    }

    jobStore.startJob(topic);
    router.navigate('studio', { topic });
  }

  return {
    subscribe,
    init,
    destroy,
    startResearch,
  };
}

export const dashboardStore = createDashboardStore();

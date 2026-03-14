import { derived, get, writable } from 'svelte/store';
import { router } from './router.ts';
import {
  jobStore,
  keepCount,
  completedCount,
  qualityScore,
  type AutoresearchJob,
} from './jobStore.ts';
import { wallet } from './walletStore.ts';
import { widgetStore } from './widgetStore.ts';
import {
  createFixturePlayback,
  demoFixtureText,
  parseNdjson,
} from '../utils/fixturePlayer.ts';
import {
  buildScaledNodes,
  isWorkerActiveState,
  oscillate01,
  smoothPulse,
} from '../utils/meshSim.ts';
import type { Node, VisualizerModel, Worker } from '../utils/types.ts';
import { TOPIC_SUGGESTIONS } from '../data/topicSuggestions.ts';
import {
  DEMO_JOBS,
  type DashboardJob,
  type ResearchMetrics,
  type SystemMetrics,
} from '../data/dashboardFixture.ts';
import {
  getDashboardEvents,
  getModelsSummary,
  getNetworkSummary,
  getPortfolioSummary,
  getProtocolSummary,
  getResearchSummary,
} from '../services/dashboardService.ts';
import type {
  DashboardEvent,
  ModelsSummary,
  NetworkSummary,
  PortfolioSummary,
  ProtocolSummary,
  ResearchSummary,
} from '../services/types.ts';

interface DashboardRuntimeState {
  mounted: boolean;
  frameIndex: number;
  meshSimulationTime: number;
  meshPopulationDisplayed: number;
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

const events = parseNdjson(demoFixtureText);
const playback = createFixturePlayback(events);
const emptyModel: VisualizerModel = { workers: [], nodes: [], jobs: [], tape: [] };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getFixtureModel(frameIndex: number): VisualizerModel {
  return playback[Math.max(frameIndex, 0)] ?? emptyModel;
}

function getMeshPopulationCeiling(model: VisualizerModel) {
  if (model.nodes.length === 0) return 0;
  return clamp(Math.max(3200, model.nodes.length * 660), 2200, 5600);
}

function getMeshPopulationTarget(model: VisualizerModel, meshSimulationTime: number) {
  if (model.nodes.length === 0) return 0;
  const ceiling = getMeshPopulationCeiling(model);
  const longWave = smoothPulse(oscillate01(meshSimulationTime / 24 - Math.PI / 2));
  const shortWave = smoothPulse(oscillate01(meshSimulationTime / 12.5 - 0.7));
  return Math.round(
    model.nodes.length + ceiling * clamp(0.07 + longWave * 0.72 + shortWave * 0.12, 0.07, 0.97),
  );
}

function buildLiveJobs(
  currentJob: AutoresearchJob,
  keepTotal: number,
) {
  const baseJobs: DashboardJob[] = [...DEMO_JOBS];

  if (currentJob.phase !== 'idle' && currentJob.topic) {
    const existing = baseJobs.find((job) => job.topic === currentJob.topic);
    if (!existing) {
      const completedExperiments = currentJob.experiments.filter((experiment) =>
        experiment.status === 'keep' || experiment.status === 'discard' || experiment.status === 'crash'
      ).length;
      const progress = currentJob.totalExperiments > 0
        ? Math.round((completedExperiments / currentJob.totalExperiments) * 100)
        : 0;

      baseJobs.unshift({
        id: 'job-active',
        topic: currentJob.topic,
        status: currentJob.phase === 'complete' ? 'complete' : 'running',
        progress,
        metric: currentJob.bestMetric === Infinity ? 0 : currentJob.bestMetric,
        metricLabel: 'bpb',
        findings: keepTotal,
        startedAt: currentJob.startedAt,
      });
    }
  }

  return baseJobs;
}

function buildResearchMetrics(
  liveJobs: DashboardJob[],
  model: VisualizerModel,
  activeWorkers: Worker[],
  job: AutoresearchJob,
  keepTotal: number,
  completedTotal: number,
  quality: number,
): ResearchMetrics {
  return {
    activeJobs: liveJobs.filter((item) => item.status === 'running').length
      + liveJobs.filter((item) => item.status === 'queued').length,
    activeAgents: activeWorkers.length || 2,
    configsTested: job.phase !== 'idle'
      ? `${completedTotal}/${job.totalExperiments}`
      : `${model.jobs.reduce((sum, item) => sum + item.workerIds.length, 0) || 12}/60`,
    findings: keepTotal || liveJobs.reduce((sum, item) => sum + item.findings, 0),
    hitRate: quality || 42,
  };
}

function buildSystemMetrics(
  model: VisualizerModel,
  activeWorkers: Worker[],
): SystemMetrics {
  const totalNodes = model.nodes.length;
  return {
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
}

function createDashboardStore() {
  const runtime = writable<DashboardRuntimeState>({
    mounted: false,
    frameIndex: playback.length > 0 ? 0 : -1,
    meshSimulationTime: 0,
    meshPopulationDisplayed: 0,
  });

  const eventLog = writable<DashboardEvent[]>(getDashboardEvents());

  let attachCount = 0;
  let fixtureTimer: ReturnType<typeof setInterval> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let walletUnsubscribe: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  let dwellCount = 0;
  let currentWalletMode = false;

  const view = derived(
    [runtime, jobStore, keepCount, completedCount, qualityScore, wallet, eventLog],
    ([$runtime, $job, $keepCount, $completedCount, $qualityScore, $wallet, $events]): DashboardViewModel => {
      const model = getFixtureModel($runtime.frameIndex);
      const meshPopulationCeiling = getMeshPopulationCeiling(model);
      const renderNodes = buildScaledNodes(
        model.nodes,
        model.jobs,
        $runtime.meshPopulationDisplayed,
        meshPopulationCeiling,
        $runtime.meshSimulationTime,
      );
      const activeWorkers = model.workers.filter((worker) => isWorkerActiveState(worker.state));
      const liveJobs = buildLiveJobs($job, $keepCount);
      const runningCount = liveJobs.filter((job) => job.status === 'running').length;
      const doneCount = liveJobs.filter((job) => job.status === 'complete').length;
      const liveResearch = buildResearchMetrics(
        liveJobs,
        model,
        activeWorkers,
        $job,
        $keepCount,
        $completedCount,
        $qualityScore,
      );
      const liveSystem = buildSystemMetrics(model, activeWorkers);
      const idleWorkers = Math.max(0, (model.workers.length || 8) - (activeWorkers.length || 4));
      const researchSummary = getResearchSummary(liveJobs);
      const networkSummary = getNetworkSummary(liveSystem, activeWorkers.length || 4, idleWorkers);
      const protocolSummary = getProtocolSummary();
      const modelsSummary = getModelsSummary();
      const portfolioSummary = getPortfolioSummary();

      return {
        mounted: $runtime.mounted,
        topicSuggestions: TOPIC_SUGGESTIONS,
        model,
        renderNodes,
        activeWorkers,
        totalNodes: model.nodes.length,
        idleWorkers,
        liveJobs,
        runningCount,
        doneCount,
        liveResearch,
        liveSystem,
        researchSummary,
        networkSummary,
        protocolSummary,
        modelsSummary,
        portfolioSummary,
        events: $events,
        modelsTrained: modelsSummary.count * 282,
        isLoggedIn: $wallet.connected,
      };
    },
  );

  function syncWidgetLayout(loggedIn: boolean) {
    widgetStore.loadLayout(loggedIn);
    if (typeof window !== 'undefined') {
      widgetStore.adjustForViewport(window.innerWidth);
    }
  }

  function init() {
    if (typeof window === 'undefined') return;
    attachCount += 1;
    if (attachCount > 1) return;

    if (get(jobStore).phase === 'idle') {
      void jobStore.connectRuntime();
    }

    currentWalletMode = get(wallet).connected;
    syncWidgetLayout(currentWalletMode);

    runtime.update((state) => ({
      ...state,
      mounted: true,
      meshPopulationDisplayed: getFixtureModel(state.frameIndex).nodes.length,
    }));

    walletUnsubscribe = wallet.subscribe(($wallet) => {
      if ($wallet.connected === currentWalletMode) {
        return;
      }
      currentWalletMode = $wallet.connected;
      syncWidgetLayout(currentWalletMode);
    });

    resizeHandler = () => {
      widgetStore.adjustForViewport(window.innerWidth);
    };
    window.addEventListener('resize', resizeHandler, { passive: true });

    fixtureTimer = setInterval(() => {
      runtime.update((state) => {
        if (playback.length <= 1) return state;
        if (state.frameIndex >= playback.length - 1) {
          dwellCount += 1;
          if (dwellCount >= 3) {
            dwellCount = 0;
            return { ...state, frameIndex: 0 };
          }
          return state;
        }

        dwellCount = 0;
        return { ...state, frameIndex: state.frameIndex + 1 };
      });
    }, 2800);

    tickTimer = setInterval(() => {
      runtime.update((state) => {
        const meshSimulationTime = state.meshSimulationTime + 0.5;
        const model = getFixtureModel(state.frameIndex);
        const meshPopulationTarget = getMeshPopulationTarget(model, meshSimulationTime);
        const floor = model.nodes.length;
        const current = Math.max(state.meshPopulationDisplayed, floor);
        let meshPopulationDisplayed = current;

        if (current !== meshPopulationTarget) {
          const step = Math.max(3, Math.ceil(Math.abs(meshPopulationTarget - current) * 0.03));
          meshPopulationDisplayed = current < meshPopulationTarget
            ? Math.min(meshPopulationTarget, current + step)
            : Math.max(meshPopulationTarget, current - step);
        }

        return {
          ...state,
          meshSimulationTime,
          meshPopulationDisplayed,
        };
      });
    }, 500);
  }

  function destroy() {
    if (typeof window === 'undefined') return;
    attachCount = Math.max(0, attachCount - 1);
    if (attachCount > 0) return;

    if (fixtureTimer) {
      clearInterval(fixtureTimer);
      fixtureTimer = null;
    }
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (walletUnsubscribe) {
      walletUnsubscribe();
      walletUnsubscribe = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    dwellCount = 0;
    runtime.update((state) => ({ ...state, mounted: false }));
  }

  function startResearch(topic: string) {
    jobStore.startJob(topic);
    router.navigate('research', { topic });
  }

  return {
    subscribe: view.subscribe,
    init,
    destroy,
    startResearch,
  };
}

export const dashboardStore = createDashboardStore();

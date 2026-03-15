import { get } from 'svelte/store';
import type { ModCategory } from '../data/modifications.ts';

// API layer imports
import {
  normalizeRuntimeApiBase,
  fetchRuntimeMesh,
  sendRuntimeCommand,
  subscribeRuntimeMesh,
  fetchRuntimeJob,
  fetchRuntimeJobs,
  createRuntimeJob,
  sendRuntimeJobCommand,
} from '../api/client.ts';
import {
  mapRuntimeMeshToJob,
  mapRuntimeJobToAutoresearchJob,
  applyRuntimeControllerToJob,
  hasRuntimeMeshData,
} from '../api/meshAdapter.ts';
import { runSetupPhase, runSimulationLoop, type SimulationDeps } from '../services/simulationService.ts';

import type { RuntimeJob, RuntimeJobCommand } from '@mesh/contracts';
import type { AutoresearchJob, Branch } from './jobTypes.ts';
import { createEmptyJob } from './jobTypes.ts';
import { jobState } from './jobState.ts';

// Re-export types for downstream consumers
export type { ExperimentStatus, VerificationState, JobPhase, Experiment, Branch, AutoresearchJob, BranchInfo } from './jobTypes.ts';
export { humanizeModification, createEmptyJob } from './jobTypes.ts';

/* ─── Constants ─── */

const RUNTIME_POLL_BASE_MS = 2500;
const RUNTIME_POLL_MAX_MS = 10000;

/* ─── Store ─── */

function createJobStore() {
  const { subscribe, set, update } = jobState;

  const timers = new Set<ReturnType<typeof setTimeout | typeof setInterval>>();
  let runtimeSession = 0;
  let closeRuntimeStream: (() => void) | null = null;

  function addTimer(t: ReturnType<typeof setTimeout | typeof setInterval>) {
    timers.add(t);
  }

  function clearAllTimers() {
    timers.forEach(t => { clearTimeout(t as any); clearInterval(t as any); });
    timers.clear();
    if (closeRuntimeStream) {
      closeRuntimeStream();
      closeRuntimeStream = null;
    }
  }

  /** Start in demo mode */
  function startDemo(topic = 'Demo Research') {
    startJob(topic);
  }

  /** Start a new autoresearch job (local simulation) */
  function startJob(topic: string, branchCount = 6, itersPerBranch = 10) {
    runtimeSession += 1;
    clearAllTimers();

    const branches: Branch[] = Array.from({ length: branchCount }, (_, i) => ({
      id: i + 1, completed: 0, total: itersPerBranch, bestMetric: Infinity,
    }));

    set({
      topic, phase: 'setup',
      setupMessage: `Initializing autoresearch for "${topic}"...`,
      experiments: [], branches, bestMetric: Infinity,
      totalExperiments: branchCount * itersPerBranch,
      startedAt: Date.now(), elapsedSeconds: 0,
      paused: false, boostedCategories: [], pausedCategories: [],
      baselineMetric: Infinity, sourceMode: 'local', controlsAvailable: true,
      runtimeApiBase: null, runtimeRoot: null, runtimeJobId: null, runtimeStatus: 'offline', runtimeError: null,
    });

    const simDeps: SimulationDeps = { update, getState: () => get(jobState), addTimer, clearAllTimers };
    runSetupPhase(topic, simDeps, () => runSimulationLoop(simDeps));
  }

  async function startRuntimeJob(topic: string, options: {
    runtimeRoot?: string | null;
    apiBase?: string | null;
    totalExperiments?: number | null;
  } = {}): Promise<string | null> {
    runtimeSession += 1;
    clearAllTimers();

    const apiBase = normalizeRuntimeApiBase(options.apiBase);
    const runtimeRoot = options.runtimeRoot?.trim() || null;

    set({
      ...createEmptyJob(),
      topic,
      phase: 'setup',
      setupMessage: `Submitting "${topic}" to runtime API...`,
      sourceMode: 'runtime',
      controlsAvailable: false,
      runtimeApiBase: apiBase,
      runtimeRoot,
      runtimeJobId: null,
      runtimeStatus: 'connecting',
      runtimeError: null,
    });

    try {
      const runtimeJob = await createRuntimeJob({
        apiBase,
        topic,
        source: 'autoresearch',
        totalExperiments: options.totalExperiments ?? null,
      });
      await connectRuntime({
        apiBase,
        runtimeRoot,
        jobId: runtimeJob.id,
        initialJob: runtimeJob,
      });
      return runtimeJob.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        ...createEmptyJob(),
        topic,
        phase: 'setup',
        setupMessage: message,
        sourceMode: 'runtime',
        controlsAvailable: false,
        runtimeApiBase: apiBase,
        runtimeRoot,
        runtimeJobId: null,
        runtimeStatus: 'error',
        runtimeError: message,
      });
      return null;
    }
  }

  /** Connect to runtime mesh API */
  async function connectRuntime(options: {
    runtimeRoot?: string | null;
    apiBase?: string | null;
    jobId?: string | null;
    initialJob?: RuntimeJob | null;
  } = {}): Promise<boolean> {
    runtimeSession += 1;
    const sessionId = runtimeSession;
    clearAllTimers();

    const apiBase = normalizeRuntimeApiBase(options.apiBase);
    const runtimeRoot = options.runtimeRoot?.trim() || null;
    const preferredJobId = options.jobId?.trim() || null;
    let cachedRuntimeJob = options.initialJob ?? null;

    set({
      ...createEmptyJob(),
      topic: 'Connecting runtime...', phase: 'setup',
      setupMessage: preferredJobId
        ? `Connecting runtime job "${preferredJobId}"...`
        : runtimeRoot
          ? `Connecting runtime root "${runtimeRoot}"...`
          : 'Connecting runtime mesh...',
      sourceMode: 'runtime', controlsAvailable: preferredJobId !== null,
      runtimeApiBase: apiBase, runtimeRoot, runtimeJobId: preferredJobId, runtimeStatus: 'connecting', runtimeError: null,
    });

    const applyRuntimeSources = async (mesh: Awaited<ReturnType<typeof fetchRuntimeMesh>> | null): Promise<{ connected: boolean; hash: string }> => {
      if (sessionId !== runtimeSession) {
        return { connected: false, hash: 'session-stale' };
      }

      const runtimeJob = await resolveRuntimeJob();
      if (sessionId !== runtimeSession) {
        return { connected: false, hash: 'session-stale' };
      }

      if (mesh && hasRuntimeMeshData(mesh)) {
        const mapped = mapRuntimeMeshToJob(mesh, apiBase, runtimeRoot, runtimeJob);
        set(mapped);
        return {
          connected: true,
          hash: `mesh:${mesh.totals.results}:${mesh.totals.bestMetric ?? 'na'}:${mesh.controller?.lastCommandAt ?? ''}:${runtimeJob?.updatedAt ?? ''}`,
        };
      }

      if (runtimeJob) {
        set(mapRuntimeJobToAutoresearchJob(runtimeJob, apiBase, runtimeRoot));
        return {
          connected: true,
          hash: `job:${runtimeJob.id}:${runtimeJob.status}:${runtimeJob.updatedAt}:${runtimeJob.progress.completed}:${runtimeJob.bestMetric ?? 'na'}`,
        };
      }

      set({
        ...createEmptyJob(),
        topic: preferredJobId ? 'Waiting for runtime worker...' : 'Runtime idle',
        phase: preferredJobId ? 'setup' : 'idle',
        setupMessage: preferredJobId ? 'Runtime job created. Waiting for runtime worker assignment...' : '',
        sourceMode: 'runtime',
        controlsAvailable: preferredJobId !== null,
        runtimeApiBase: apiBase,
        runtimeRoot,
        runtimeJobId: preferredJobId,
        runtimeStatus: 'offline',
        runtimeError: null,
      });
      return { connected: false, hash: `runtime-empty:${preferredJobId ?? 'latest'}` };
    };

    async function resolveRuntimeJob(): Promise<RuntimeJob | null> {
      if (preferredJobId) {
        if (cachedRuntimeJob?.id === preferredJobId) {
          return cachedRuntimeJob;
        }
        try {
          cachedRuntimeJob = await fetchRuntimeJob({ apiBase, jobId: preferredJobId });
        } catch {
          cachedRuntimeJob = null;
        }
        return cachedRuntimeJob;
      }

      try {
        const jobs = await fetchRuntimeJobs({ apiBase });
        cachedRuntimeJob = jobs[0] ?? null;
      } catch {
        // Keep the last known runtime job when the runtime API is temporarily unavailable.
      }
      return cachedRuntimeJob;
    }

    const pull = async (providedMesh: Awaited<ReturnType<typeof fetchRuntimeMesh>> | null = null): Promise<{ connected: boolean; hash: string }> => {
      let mesh = providedMesh;
      let meshError: unknown = null;

      if (!mesh) {
        try {
          mesh = await fetchRuntimeMesh({ apiBase, runtimeRoot });
        } catch (error) {
          meshError = error;
        }
      }

      if (mesh) {
        return applyRuntimeSources(mesh);
      }

      const runtimeJob = await resolveRuntimeJob();
      if (runtimeJob) {
        set(mapRuntimeJobToAutoresearchJob(runtimeJob, apiBase, runtimeRoot));
        return {
          connected: true,
          hash: `job:${runtimeJob.id}:${runtimeJob.status}:${runtimeJob.updatedAt}:${runtimeJob.progress.completed}:${runtimeJob.bestMetric ?? 'na'}`,
        };
      }

      if (sessionId !== runtimeSession) {
        return { connected: false, hash: 'session-stale' };
      }

      const message = meshError instanceof Error ? meshError.message : meshError ? String(meshError) : null;
      set({
        ...createEmptyJob(),
        topic: message ? 'Runtime unavailable' : 'Runtime idle',
        phase: message ? 'setup' : 'idle',
        setupMessage: message ?? '',
        sourceMode: 'runtime',
        controlsAvailable: preferredJobId !== null,
        runtimeApiBase: apiBase,
        runtimeRoot,
        runtimeJobId: preferredJobId,
        runtimeStatus: message ? 'error' : 'offline',
        runtimeError: message,
      });
      return { connected: false, hash: `runtime-unavailable:${message ?? 'idle'}` };
    };

    const initial = await pull();

    let pollInterval = RUNTIME_POLL_BASE_MS;
    let lastHash = initial.hash;
    let fallbackPollingStarted = false;

    const startPolling = () => {
      if (fallbackPollingStarted || sessionId !== runtimeSession) return;
      fallbackPollingStarted = true;

      const schedulePoll = () => {
        const timer = setTimeout(async () => {
          timers.delete(timer);
          if (sessionId !== runtimeSession) return;
          const prevHash = lastHash;
          const next = await pull();
          if (next.hash === prevHash && next.hash === lastHash) {
            pollInterval = Math.min(pollInterval * 1.5, RUNTIME_POLL_MAX_MS);
          } else {
            pollInterval = RUNTIME_POLL_BASE_MS;
          }
          lastHash = next.hash;
          if (sessionId === runtimeSession) schedulePoll();
        }, pollInterval);
        addTimer(timer);
      };

      schedulePoll();
    };

    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      closeRuntimeStream = subscribeRuntimeMesh({
        apiBase,
        runtimeRoot,
        onSnapshot: (mesh) => {
          void pull(mesh).then((next) => {
            if (sessionId !== runtimeSession) return;
            lastHash = next.hash;
          });
          pollInterval = RUNTIME_POLL_BASE_MS;
        },
        onError: () => {
          if (sessionId !== runtimeSession || fallbackPollingStarted) return;
          if (closeRuntimeStream) {
            closeRuntimeStream();
            closeRuntimeStream = null;
          }
          update((state) => state.sourceMode === 'runtime'
            ? { ...state, runtimeStatus: 'connecting', runtimeError: null }
            : state);
          startPolling();
        },
      });
    } else {
      startPolling();
    }

    return initial.connected;
  }

  /** Send command to runtime */
  async function issueRuntimeCommand(command: RuntimeJobCommand) {
    const current = get(jobState);
    if (current.sourceMode !== 'runtime' || !current.controlsAvailable || !current.runtimeApiBase) return;

    update((state) => ({ ...state, runtimeStatus: 'connecting', runtimeError: null }));

    try {
      if (current.runtimeJobId && current.experiments.length === 0) {
        const runtimeJob = await sendRuntimeJobCommand({
          apiBase: current.runtimeApiBase,
          jobId: current.runtimeJobId,
          command,
        });
        set(mapRuntimeJobToAutoresearchJob(runtimeJob, current.runtimeApiBase, current.runtimeRoot));
        return;
      }

      const controller = await sendRuntimeCommand({
        apiBase: current.runtimeApiBase, runtimeRoot: current.runtimeRoot, command,
      });
      update((state) => applyRuntimeControllerToJob({ ...state, runtimeError: null }, controller));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      update((state) => ({ ...state, runtimeStatus: 'error', runtimeError: message }));
    }
  }

  function reset() {
    runtimeSession += 1;
    clearAllTimers();
    set(createEmptyJob());
  }

  function stopJob() {
    const current = get(jobState);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({ type: 'stop' });
      return;
    }
    reset();
  }

  function togglePause() {
    const current = get(jobState);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({ type: current.paused ? 'resume' : 'pause' });
      return;
    }
    update(s => ({ ...s, paused: !s.paused }));
  }

  function toggleCategoryBoost(cat: ModCategory) {
    const current = get(jobState);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({
        type: current.boostedCategories.includes(cat) ? 'unboost_category' : 'boost_category',
        category: cat,
      });
      return;
    }
    update(s => {
      if (s.boostedCategories.includes(cat)) {
        return { ...s, boostedCategories: s.boostedCategories.filter(c => c !== cat) };
      }
      return {
        ...s,
        boostedCategories: [...s.boostedCategories, cat],
        pausedCategories: s.pausedCategories.filter(c => c !== cat),
      };
    });
  }

  function toggleCategoryPause(cat: ModCategory) {
    const current = get(jobState);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({
        type: current.pausedCategories.includes(cat) ? 'resume_category' : 'pause_category',
        category: cat,
      });
      return;
    }
    update(s => {
      if (s.pausedCategories.includes(cat)) {
        return { ...s, pausedCategories: s.pausedCategories.filter(c => c !== cat) };
      }
      return {
        ...s,
        pausedCategories: [...s.pausedCategories, cat],
        boostedCategories: s.boostedCategories.filter(c => c !== cat),
      };
    });
  }

  return {
    subscribe,
    startJob,
    startDemo,
    startRuntimeJob,
    connectRuntime,
    reset,
    stopJob,
    togglePause,
    toggleCategoryBoost,
    toggleCategoryPause,
  };
}

export const jobStore = createJobStore();

// Re-export derived stores so existing import paths continue to work
export {
  completedCount, keepCount, discardCount, crashCount, trainingCount,
  activeNodeCount, verificationCounts, metricHistory, qualityScore,
  statusMessage, latestFinding, eventLog, recentExperiments, trainingExperiment,
  scatterData, heatmapData, experimentTree, branchSummary,
  improvementDelta, bestBranch, isPaused,
  avgDuration, totalGpuTime, bestFrontier, sparkPoints,
} from './jobDerived.ts';

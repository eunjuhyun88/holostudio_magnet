import { writable, get } from 'svelte/store';
import type { ModCategory } from '../data/modifications.ts';

// API layer imports
import { normalizeRuntimeApiBase, fetchRuntimeMesh, sendRuntimeCommand, subscribeRuntimeMesh } from '../api/client.ts';
import { mapRuntimeMeshToJob, applyRuntimeControllerToJob } from '../api/meshAdapter.ts';
import { runSetupPhase, runSimulationLoop, type SimulationDeps } from '../services/simulationService.ts';

import type { RuntimeJobCommand } from '@mesh/contracts';
import type { AutoresearchJob, Branch } from './jobTypes.ts';
import { createEmptyJob } from './jobTypes.ts';

// Re-export types for downstream consumers
export type { ExperimentStatus, VerificationState, JobPhase, Experiment, Branch, AutoresearchJob, BranchInfo } from './jobTypes.ts';
export { humanizeModification, createEmptyJob } from './jobTypes.ts';

/* ─── Constants ─── */

const RUNTIME_POLL_BASE_MS = 2500;
const RUNTIME_POLL_MAX_MS = 10000;

/* ─── Store ─── */

function createJobStore() {
  const store = writable<AutoresearchJob>(createEmptyJob());
  const { subscribe, set, update } = store;

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
      runtimeApiBase: null, runtimeRoot: null, runtimeStatus: 'offline', runtimeError: null,
    });

    const simDeps: SimulationDeps = { update, getState: () => get(store), addTimer, clearAllTimers };
    runSetupPhase(topic, simDeps, () => runSimulationLoop(simDeps));
  }

  /** Connect to runtime mesh API */
  async function connectRuntime(options: {
    runtimeRoot?: string | null;
    apiBase?: string | null;
  } = {}): Promise<boolean> {
    runtimeSession += 1;
    const sessionId = runtimeSession;
    clearAllTimers();

    const apiBase = normalizeRuntimeApiBase(options.apiBase);
    const runtimeRoot = options.runtimeRoot?.trim() || null;

    set({
      ...createEmptyJob(),
      topic: 'Connecting runtime...', phase: 'setup',
      setupMessage: runtimeRoot ? `Connecting runtime root "${runtimeRoot}"...` : 'Connecting runtime mesh...',
      sourceMode: 'runtime', controlsAvailable: false,
      runtimeApiBase: apiBase, runtimeRoot, runtimeStatus: 'connecting', runtimeError: null,
    });

    const applyMesh = (mesh: Awaited<ReturnType<typeof fetchRuntimeMesh>>): boolean => {
      if (sessionId !== runtimeSession) return false;

      const hasRuntimeData = mesh.workspaces.length > 0 || mesh.totals.results > 0 || mesh.controller?.reachable;
      if (!hasRuntimeData) {
        set(createEmptyJob());
        return false;
      }

      set(mapRuntimeMeshToJob(mesh, apiBase, runtimeRoot));
      return true;
    };

    const pull = async (): Promise<boolean> => {
      try {
        const mesh = await fetchRuntimeMesh({ apiBase, runtimeRoot });
        return applyMesh(mesh);
      } catch (error) {
        if (sessionId !== runtimeSession) return false;
        const message = error instanceof Error ? error.message : String(error);
        set({
          ...createEmptyJob(), topic: 'Runtime unavailable', phase: 'idle', setupMessage: '',
          sourceMode: 'runtime', controlsAvailable: false, runtimeApiBase: apiBase,
          runtimeRoot, runtimeStatus: 'error', runtimeError: message,
        });
        return false;
      }
    };

    const connected = await pull();
    if (!connected) return false;

    let pollInterval = RUNTIME_POLL_BASE_MS;
    let lastHash = '';
    let fallbackPollingStarted = false;

    const startPolling = () => {
      if (fallbackPollingStarted || sessionId !== runtimeSession) return;
      fallbackPollingStarted = true;

      const schedulePoll = () => {
        const timer = setTimeout(async () => {
          timers.delete(timer);
          if (sessionId !== runtimeSession) return;
          const prevState = get(store);
          const prevHash = `${prevState.experiments.length}:${prevState.bestMetric}`;
          await pull();
          const nextState = get(store);
          const nextHash = `${nextState.experiments.length}:${nextState.bestMetric}`;
          if (nextHash === prevHash && nextHash === lastHash) {
            pollInterval = Math.min(pollInterval * 1.5, RUNTIME_POLL_MAX_MS);
          } else {
            pollInterval = RUNTIME_POLL_BASE_MS;
          }
          lastHash = nextHash;
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
          if (!applyMesh(mesh)) return;
          pollInterval = RUNTIME_POLL_BASE_MS;
          lastHash = `${mesh.totals.results}:${mesh.totals.bestMetric ?? 'na'}:${mesh.controller?.lastCommandAt ?? ''}`;
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

    return true;
  }

  /** Send command to runtime */
  async function issueRuntimeCommand(command: RuntimeJobCommand) {
    const current = get(store);
    if (current.sourceMode !== 'runtime' || !current.controlsAvailable || !current.runtimeApiBase) return;

    update((state) => ({ ...state, runtimeStatus: 'connecting', runtimeError: null }));

    try {
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
    const current = get(store);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({ type: 'stop' });
      return;
    }
    reset();
  }

  function togglePause() {
    const current = get(store);
    if (current.sourceMode === 'runtime') {
      if (!current.controlsAvailable) return;
      void issueRuntimeCommand({ type: current.paused ? 'resume' : 'pause' });
      return;
    }
    update(s => ({ ...s, paused: !s.paused }));
  }

  function toggleCategoryBoost(cat: ModCategory) {
    const current = get(store);
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
    const current = get(store);
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

  return { subscribe, startJob, startDemo, connectRuntime, reset, stopJob, togglePause, toggleCategoryBoost, toggleCategoryPause };
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

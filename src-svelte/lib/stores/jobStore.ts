import { writable, derived, get } from 'svelte/store';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  BRANCH_STRATEGIES,
  resolveExperimentCategory,
  type ModCategory,
} from '../data/modifications.ts';
import { HUMAN_READABLE } from '../data/modifications.ts';

// API layer imports
import { normalizeRuntimeApiBase, fetchRuntimeMesh, sendRuntimeCommand, subscribeRuntimeMesh } from '../api/client.ts';
import { mapRuntimeMeshToJob, applyRuntimeControllerToJob } from '../api/meshAdapter.ts';
import { runSetupPhase, runSimulationLoop, type SimulationDeps } from '../services/simulationService.ts';
import { connectionMode, apiBase } from './connectionStore.ts';

import type { RuntimeJobCommand } from '@mesh/contracts';

/* ─── Constants ─── */

const RUNTIME_POLL_BASE_MS = 2500;
const RUNTIME_POLL_MAX_MS = 10000;

/* ─── Types ─── */

export type ExperimentStatus = 'training' | 'evaluating' | 'keep' | 'discard' | 'crash';
export type VerificationState = 'pending' | 'committed' | 'revealed' | 'verified' | 'spot-checked';
export type JobPhase = 'idle' | 'setup' | 'running' | 'complete';

export interface Experiment {
  id: number;
  parentId: number | null;
  status: ExperimentStatus;
  verification: VerificationState;
  modification: string;
  metric: number;
  delta: number;
  nodeId: string;
  gpuNodes: string[];
  tier: 1 | 2 | 4 | 8;
  branchId: number;
  duration: number;
  progress: number;
  timestamp: number;
}

export interface Branch {
  id: number;
  completed: number;
  total: number;
  bestMetric: number;
}

export interface AutoresearchJob {
  topic: string;
  phase: JobPhase;
  setupMessage: string;
  experiments: Experiment[];
  branches: Branch[];
  bestMetric: number;
  totalExperiments: number;
  startedAt: number;
  elapsedSeconds: number;
  paused: boolean;
  boostedCategories: ModCategory[];
  pausedCategories: ModCategory[];
  baselineMetric: number;
  sourceMode: 'local' | 'runtime';
  controlsAvailable: boolean;
  runtimeApiBase: string | null;
  runtimeRoot: string | null;
  runtimeStatus: 'offline' | 'connecting' | 'streaming' | 'error';
  runtimeError: string | null;
}

/* ─── Default State ─── */

function createEmptyJob(): AutoresearchJob {
  return {
    topic: '',
    phase: 'idle',
    setupMessage: '',
    experiments: [],
    branches: [],
    bestMetric: Infinity,
    totalExperiments: 60,
    startedAt: 0,
    elapsedSeconds: 0,
    paused: false,
    boostedCategories: [],
    pausedCategories: [],
    baselineMetric: Infinity,
    sourceMode: 'local',
    controlsAvailable: true,
    runtimeApiBase: null,
    runtimeRoot: null,
    runtimeStatus: 'offline',
    runtimeError: null,
  };
}

/* ─── Helpers ─── */

export function humanizeModification(mod: string): string {
  return HUMAN_READABLE[mod] || mod;
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

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

  /**
   * Start in demo mode — runs local simulation without API.
   * Shorthand for startJob with default params.
   */
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
      if (fallbackPollingStarted || sessionId !== runtimeSession) {
        return;
      }
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
          if (!applyMesh(mesh)) {
            return;
          }
          pollInterval = RUNTIME_POLL_BASE_MS;
          lastHash = `${mesh.totals.results}:${mesh.totals.bestMetric ?? 'na'}:${mesh.controller?.lastCommandAt ?? ''}`;
        },
        onError: () => {
          if (sessionId !== runtimeSession || fallbackPollingStarted) {
            return;
          }
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

/* ─── Derived stores ─── */

export const jobStore = createJobStore();

/** Single-pass counts */
const jobCounts = derived(jobStore, $j => {
  let keeps = 0, discards = 0, crashes = 0, training = 0;
  let vPending = 0, vCommitted = 0, vRevealed = 0, vVerified = 0, vSpotChecked = 0;
  const nodeIds = new Set<string>();
  for (const e of $j.experiments) {
    if (e.status === 'keep') keeps++;
    else if (e.status === 'discard') discards++;
    else if (e.status === 'crash') crashes++;
    else if (e.status === 'training') training++;
    nodeIds.add(e.nodeId);
    if (e.verification === 'pending') vPending++;
    else if (e.verification === 'committed') vCommitted++;
    else if (e.verification === 'revealed') vRevealed++;
    else if (e.verification === 'verified') vVerified++;
    else if (e.verification === 'spot-checked') vSpotChecked++;
  }
  return {
    completed: keeps + discards + crashes, keeps, discards, crashes, training,
    activeNodeCount: nodeIds.size,
    verification: { pending: vPending, committed: vCommitted, revealed: vRevealed, verified: vVerified, spotChecked: vSpotChecked },
  };
});

export const completedCount = derived(jobCounts, $c => $c.completed);
export const keepCount = derived(jobCounts, $c => $c.keeps);
export const discardCount = derived(jobCounts, $c => $c.discards);
export const crashCount = derived(jobCounts, $c => $c.crashes);
export const trainingCount = derived(jobCounts, $c => $c.training);
export const activeNodeCount = derived(jobCounts, $c => $c.activeNodeCount);

/** Commit-Reveal verification pipeline counts */
export const verificationCounts = derived(jobCounts, $c => $c.verification);

export const metricHistory = derived(jobStore, $j => {
  const filtered = $j.experiments.filter(e => e.status === 'keep' || e.status === 'discard');
  const reversed = [];
  for (let i = filtered.length - 1; i >= 0; i--) {
    reversed.push({ x: reversed.length + 1, y: filtered[i].metric, status: filtered[i].status });
    if (reversed.length >= 200) break;
  }
  return reversed;
});

export const qualityScore = derived(jobCounts, $c => {
  if ($c.completed === 0) return 0;
  return Math.round(($c.keeps / $c.completed) * 100);
});

export const statusMessage = derived([jobStore, jobCounts], ([$j, $c]) => {
  switch ($j.phase) {
    case 'idle': return '';
    case 'setup': return $j.setupMessage || 'Setting up research pipeline...';
    case 'running':
      if ($j.sourceMode === 'runtime') {
        return $j.setupMessage || `Runtime mesh tracking ${$c.completed} result(s)`;
      }
      return `Testing ${$c.completed} of ${$j.totalExperiments} approaches`;
    case 'complete': return 'Your model is ready!';
    default: return '';
  }
});

export const latestFinding = derived(jobStore, $j => {
  const lastKeep = $j.experiments.find(e => e.status === 'keep');
  if (!lastKeep) return null;
  return {
    modification: lastKeep.modification,
    humanReadable: humanizeModification(lastKeep.modification),
    delta: lastKeep.delta,
    metric: lastKeep.metric,
  };
});

export const eventLog = derived(jobStore, $j => {
  const evts: { time: string; type: string; message: string }[] = [];
  if ($j.startedAt) {
    evts.push({ time: formatLogTime($j.startedAt), type: 'SYSTEM', message: 'autoresearch init' });
    evts.push({ time: formatLogTime($j.startedAt), type: 'SUBMIT', message: `topic="${$j.topic}"` });
  }
  for (const exp of $j.experiments) {
    if (exp.status !== 'training') {
      evts.push({
        time: formatLogTime(exp.timestamp),
        type: exp.status === 'keep' ? 'KEEP' : exp.status === 'crash' ? 'CRASH' : 'DISCARD',
        message: `#${exp.id} ${exp.modification} → ${exp.status}${exp.metric > 0 ? ` (${exp.metric.toFixed(3)})` : ''}`
      });
    }
  }
  return evts;
});

export const recentExperiments = derived(jobStore, $j => {
  const result: Experiment[] = [];
  for (const e of $j.experiments) {
    if (e.status !== 'training') {
      result.push(e);
      if (result.length >= 10) break;
    }
  }
  return result;
});

export const trainingExperiment = derived(jobStore, $j =>
  $j.experiments.find(e => e.status === 'training') ?? null
);

/* ─── Visualization derived stores ─── */

/** Scatter plot data: category × metric */
export const scatterData = derived(jobStore, $j => {
  return $j.experiments
    .filter(e => e.status === 'keep' || e.status === 'discard')
    .map(e => ({
      id: e.id,
      modification: e.modification,
      category: resolveExperimentCategory(e.modification),
      metric: e.metric,
      status: e.status,
      branchId: e.branchId,
    }));
});

/** Heatmap data: per-category success rates */
export const heatmapData = derived(jobStore, $j => {
  const cats = Object.keys(CATEGORY_LABELS) as ModCategory[];
  const grid: Record<string, { total: number; keeps: number; avgMetric: number; metrics: number[] }> = {};
  for (const cat of cats) {
    grid[cat] = { total: 0, keeps: 0, avgMetric: 0, metrics: [] };
  }
  for (const e of $j.experiments) {
    if (e.status === 'training') continue;
    const cat = resolveExperimentCategory(e.modification);
    grid[cat].total++;
    if (e.status === 'keep') {
      grid[cat].keeps++;
      grid[cat].metrics.push(e.metric);
    }
  }
  for (const cat of cats) {
    const m = grid[cat].metrics;
    grid[cat].avgMetric = m.length > 0 ? m.reduce((a, b) => a + b, 0) / m.length : 0;
  }
  return grid;
});

/** Experiment tree/DAG data */
export const experimentTree = derived(jobStore, $j => {
  return $j.experiments
    .filter(e => e.status !== 'training')
    .map(e => ({
      id: e.id,
      parentId: e.parentId,
      status: e.status,
      verification: e.verification,
      metric: e.metric,
      modification: e.modification,
      branchId: e.branchId,
      tier: e.tier,
    }))
    .reverse();
});

/** Branch summary — groups experiments by modification category */
export interface BranchInfo {
  category: ModCategory;
  label: string;
  strategy: string;
  total: number;
  keeps: number;
  crashes: number;
  bestMetric: number;
  hitRate: number;
  active: boolean;
  boosted: boolean;
  paused: boolean;
}

export const branchSummary = derived(jobStore, $j => {
  const map = new Map<ModCategory, { total: number; keeps: number; crashes: number; best: number; active: boolean }>();

  for (const e of $j.experiments) {
    const cat = resolveExperimentCategory(e.modification);
    let entry = map.get(cat);
    if (!entry) { entry = { total: 0, keeps: 0, crashes: 0, best: Infinity, active: false }; map.set(cat, entry); }

    if (e.status === 'training') { entry.active = true; continue; }
    entry.total++;
    if (e.status === 'keep') { entry.keeps++; if (e.metric < entry.best) entry.best = e.metric; }
    if (e.status === 'crash') entry.crashes++;
    if (e.status === 'discard' && e.metric < entry.best) entry.best = e.metric;
  }

  const branches: BranchInfo[] = [];
  for (const [cat, d] of map) {
    branches.push({
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      strategy: BRANCH_STRATEGIES[cat] ?? '',
      total: d.total, keeps: d.keeps, crashes: d.crashes,
      bestMetric: d.best,
      hitRate: d.total > 0 ? Math.round((d.keeps / d.total) * 100) : 0,
      active: d.active,
      boosted: $j.boostedCategories.includes(cat),
      paused: $j.pausedCategories.includes(cat),
    });
  }

  branches.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.bestMetric - b.bestMetric;
  });

  return branches;
});

/* ─── Intervention derived stores ─── */

export const improvementDelta = derived(jobStore, $j => {
  if ($j.baselineMetric === Infinity || $j.bestMetric === Infinity) return null;
  const pct = (($j.baselineMetric - $j.bestMetric) / $j.baselineMetric) * 100;
  return {
    raw: Math.round(($j.baselineMetric - $j.bestMetric) * 1000) / 1000,
    percent: Math.round(pct * 10) / 10,
    baseline: $j.baselineMetric,
    current: $j.bestMetric,
  };
});

export const bestBranch = derived(jobStore, $j => {
  if ($j.bestMetric === Infinity) return null;
  const bestExp = $j.experiments.find(e => e.status === 'keep' && e.metric === $j.bestMetric);
  if (!bestExp) return null;
  const cat = resolveExperimentCategory(bestExp.modification);
  return {
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    color: CATEGORY_COLORS[cat] ?? '#9a9590',
    experimentId: bestExp.id,
    modification: bestExp.modification,
  };
});

export const isPaused = derived(jobStore, $j => $j.paused);

/* ─── Page-level derived stores (moved from AutoresearchPage to avoid per-component O(n) scans) ─── */

/** Average duration of completed experiments */
export const avgDuration = derived(jobStore, $j => {
  let sum = 0, count = 0;
  for (const e of $j.experiments) {
    if (e.status !== 'training' && e.duration > 0) { sum += e.duration; count++; }
  }
  return count > 0 ? Math.round(sum / count) : 0;
});

/** Total GPU time formatted */
export const totalGpuTime = derived(jobStore, $j => {
  let secs = 0;
  for (const e of $j.experiments) { secs += e.duration * e.tier; }
  if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
  if (secs >= 60) return `${Math.round(secs / 60)}m`;
  return `${secs}s`;
});

/** Best-so-far frontier (monotonically decreasing keep metrics) */
export const bestFrontier = derived(jobStore, $j => {
  const frontier: number[] = [];
  let best = Infinity;
  for (let i = $j.experiments.length - 1; i >= 0; i--) {
    const e = $j.experiments[i];
    if (e.status === 'keep' && e.metric < best) { best = e.metric; frontier.push(best); }
  }
  return frontier;
});

/** SVG sparkline points string from bestFrontier */
export const sparkPoints = derived(bestFrontier, $f => {
  if ($f.length < 2) return '';
  const min = Math.min(...$f);
  const max = Math.max(...$f);
  const range = max - min || 0.001;
  return $f.map((v, i) => {
    const x = (i / ($f.length - 1)) * 120;
    const y = 18 - ((v - min) / range) * 16;
    return `${x},${y}`;
  }).join(' ');
});

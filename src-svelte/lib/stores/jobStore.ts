import { writable, derived, get } from 'svelte/store';
import { MODIFICATIONS, HUMAN_READABLE, MOD_CATEGORY, CATEGORY_LABELS, CATEGORY_COLORS, BRANCH_STRATEGIES, type ModCategory } from '../data/modifications.ts';

/* ─── Types ─── */

export type ExperimentStatus = 'training' | 'evaluating' | 'keep' | 'discard' | 'crash';
export type JobPhase = 'idle' | 'setup' | 'running' | 'complete';

export interface Experiment {
  id: number;
  parentId: number | null;
  status: ExperimentStatus;
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
  };
}

/* ─── Helpers ─── */

function randomHex(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** Weighted modification selection — 3-layer intelligence */
function selectModification(
  experiments: Experiment[],
  boosted: ModCategory[],
  paused: ModCategory[],
): string {
  // 1. Filter out paused categories
  const pool = MODIFICATIONS.filter(mod => {
    const cat = MOD_CATEGORY[mod] ?? 'baseline';
    return !paused.includes(cat);
  });
  if (pool.length === 0) return MODIFICATIONS[0]; // fallback

  // 2. Compute per-category keep rates from history
  const catStats = new Map<ModCategory, { total: number; keeps: number }>();
  for (const e of experiments) {
    if (e.status === 'training') continue;
    const cat = (MOD_CATEGORY[e.modification] ?? 'baseline') as ModCategory;
    if (!catStats.has(cat)) catStats.set(cat, { total: 0, keeps: 0 });
    const s = catStats.get(cat)!;
    s.total++;
    if (e.status === 'keep') s.keeps++;
  }

  // 3. Assign weights
  const weights = pool.map(mod => {
    const cat = (MOD_CATEGORY[mod] ?? 'baseline') as ModCategory;
    let weight = 1.0;
    // History-based: higher keep rate → more weight
    const stats = catStats.get(cat);
    if (stats && stats.total >= 3) {
      const keepRate = stats.keeps / stats.total;
      weight *= (0.5 + keepRate * 1.5);
    }
    // Boost multiplier
    if (boosted.includes(cat)) weight *= 2.0;
    // Exploration bonus for under-explored
    if (!stats || stats.total < 2) weight *= 1.3;
    return weight;
  });

  // 4. Weighted random selection
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function generateExperiment(
  id: number, branchId: number, currentBest: number,
  experiments: Experiment[],
  boosted: ModCategory[], paused: ModCategory[],
): Experiment {
  const rand = Math.random();
  let status: ExperimentStatus;
  let metric: number;

  if (rand < 0.03) {
    status = 'crash';
    metric = 0;
  } else if (rand < 0.35) {
    status = 'keep';
    const base = currentBest === Infinity ? 1.45 : currentBest;
    metric = Math.max(0.8, base - Math.random() * 0.015 - 0.001);
  } else {
    status = 'discard';
    const base = currentBest === Infinity ? 1.45 : currentBest;
    metric = base + Math.random() * 0.05;
  }

  const delta = currentBest === Infinity ? 0 : currentBest - metric;
  const mod = selectModification(experiments, boosted, paused);

  // Find parent: most recent keep on same branch
  const branchKeeps = experiments.filter(e => e.branchId === branchId && e.status === 'keep');
  const parentId = branchKeeps.length > 0 ? branchKeeps[0].id : null;

  // Determine tier based on parent
  let tier: 1 | 2 | 4 | 8 = 1;
  if (parentId !== null) {
    const parent = experiments.find(e => e.id === parentId);
    if (parent && parent.tier < 8 && status === 'keep' && delta > 0.005) {
      tier = Math.min(8, parent.tier * 2) as 1 | 2 | 4 | 8;
    } else if (parent) {
      tier = parent.tier;
    }
  }

  const mainNode = `node-${randomHex(4)}`;
  const gpuNodes = Array.from({ length: tier }, (_, i) => i === 0 ? mainNode : `node-${randomHex(4)}`);

  return {
    id,
    parentId,
    status,
    modification: mod,
    metric: Math.round(metric * 1000) / 1000,
    delta: Math.round(delta * 1000) / 1000,
    nodeId: mainNode,
    gpuNodes,
    tier,
    branchId,
    duration: Math.round(280 + Math.random() * 40),
    progress: 100,
    timestamp: Date.now(),
  };
}

export function humanizeModification(mod: string): string {
  return HUMAN_READABLE[mod] || mod;
}

/* ─── Store ─── */

function createJobStore() {
  const store = writable<AutoresearchJob>(createEmptyJob());
  const { subscribe, set, update } = store;

  let timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];

  function addTimer(t: ReturnType<typeof setTimeout | typeof setInterval>) {
    timers.push(t);
  }

  function clearAllTimers() {
    timers.forEach(t => { clearTimeout(t as any); clearInterval(t as any); });
    timers = [];
  }

  /** Start a new autoresearch job */
  function startJob(topic: string, branchCount = 6, itersPerBranch = 10) {
    clearAllTimers();

    const branches: Branch[] = Array.from({ length: branchCount }, (_, i) => ({
      id: i + 1,
      completed: 0,
      total: itersPerBranch,
      bestMetric: Infinity,
    }));

    set({
      topic,
      phase: 'setup',
      setupMessage: `Initializing autoresearch for "${topic}"...`,
      experiments: [],
      branches,
      bestMetric: Infinity,
      totalExperiments: branchCount * itersPerBranch,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      paused: false,
      boostedCategories: [],
      pausedCategories: [],
      baselineMetric: Infinity,
    });

    simulateSetup(topic);
  }

  /** Setup phase — fast streaming messages */
  function simulateSetup(topic: string) {
    const messages = [
      `Analyzing research domain: "${topic}"...`,
      'Generating program.md with Claude...',
      'Configuring train.py template...',
      'Setting up evaluation pipeline...',
      'Distributing to compute nodes...',
      'Starting first experiments...',
    ];
    let idx = 0;

    const interval = setInterval(() => {
      if (idx >= messages.length) {
        clearInterval(interval);
        update(s => ({ ...s, phase: 'running', setupMessage: '' }));
        startSimulation();
        return;
      }
      update(s => ({ ...s, setupMessage: messages[idx] }));
      idx++;
    }, 350);
    addTimer(interval);
  }

  /** Main simulation loop — fast experiment generation */
  function startSimulation() {
    const clock = setInterval(() => {
      update(s => ({ ...s, elapsedSeconds: s.elapsedSeconds + 3 }));
    }, 1000);
    addTimer(clock);

    let nextId = 1;
    let trainingId: number | null = null;

    const firstNode = `node-${randomHex(4)}`;
    const firstExp: Experiment = {
      id: nextId++,
      parentId: null,
      status: 'training',
      modification: 'baseline model (initial run)',
      metric: 0,
      delta: 0,
      nodeId: firstNode,
      gpuNodes: [firstNode],
      tier: 1,
      branchId: 1,
      duration: 0,
      progress: 0,
      timestamp: Date.now(),
    };
    trainingId = firstExp.id;
    update(s => ({ ...s, experiments: [firstExp] }));

    const progressTick = setInterval(() => {
      if (trainingId === null) return;
      update(s => {
        const exps = s.experiments.map(e => {
          if (e.id === trainingId && e.status === 'training') {
            const newProgress = Math.min(100, e.progress + 12 + Math.random() * 15);
            if (newProgress >= 100) {
              const metric = 1.4 + Math.random() * 0.3;
              trainingId = null;
              return {
                ...e,
                status: 'keep' as ExperimentStatus,
                progress: 100,
                metric: Math.round(metric * 1000) / 1000,
                delta: 0,
                duration: Math.round(280 + Math.random() * 40),
              };
            }
            return { ...e, progress: newProgress };
          }
          return e;
        });
        const keeps = exps.filter(e => e.status === 'keep');
        const best = keeps.length > 0 ? Math.min(...keeps.map(k => k.metric)) : s.bestMetric;
        const newBaseline = s.baselineMetric === Infinity && keeps.length > 0
          ? keeps[keeps.length - 1].metric : s.baselineMetric;
        return { ...s, experiments: exps, bestMetric: best === Infinity ? s.bestMetric : best, baselineMetric: newBaseline };
      });
    }, 200);
    addTimer(progressTick);

    function scheduleNext() {
      const delay = 500 + Math.random() * 700;
      const timer = setTimeout(() => {
        const state = get(store);
        if (state.phase !== 'running') return;

        // Global pause — keep looping but skip experiment generation
        if (state.paused) {
          scheduleNext();
          return;
        }

        const doneCount = state.experiments.filter(
          e => e.status === 'keep' || e.status === 'discard' || e.status === 'crash'
        ).length;

        if (doneCount >= state.totalExperiments) {
          update(s => ({ ...s, phase: 'complete' }));
          clearAllTimers();
          return;
        }

        const available = state.branches.filter(b => b.completed < b.total);
        if (available.length === 0) {
          update(s => ({ ...s, phase: 'complete' }));
          clearAllTimers();
          return;
        }

        const branch = available[Math.floor(Math.random() * available.length)];

        if (trainingId === null && Math.random() < 0.25) {
          const trainNode = `node-${randomHex(4)}`;
          const trainExp: Experiment = {
            id: nextId++,
            parentId: null,
            status: 'training',
            modification: selectModification(state.experiments, state.boostedCategories, state.pausedCategories),
            metric: 0,
            delta: 0,
            nodeId: trainNode,
            gpuNodes: [trainNode],
            tier: 1,
            branchId: branch.id,
            duration: 0,
            progress: 0,
            timestamp: Date.now(),
          };
          trainingId = trainExp.id;
          update(s => ({ ...s, experiments: [trainExp, ...s.experiments] }));
          scheduleNext();
          return;
        }

        const newExp = generateExperiment(
          nextId++, branch.id, state.bestMetric, state.experiments,
          state.boostedCategories, state.pausedCategories,
        );

        update(s => {
          const exps = [newExp, ...s.experiments];
          const updatedBranches = s.branches.map(b => {
            if (b.id !== branch.id) return b;
            const newBest = newExp.status === 'keep' && newExp.metric < b.bestMetric
              ? newExp.metric : b.bestMetric;
            return { ...b, completed: b.completed + 1, bestMetric: newBest };
          });
          const newBest = newExp.status === 'keep' && newExp.metric < s.bestMetric
            ? newExp.metric : s.bestMetric;
          return { ...s, experiments: exps, branches: updatedBranches, bestMetric: newBest };
        });

        scheduleNext();
      }, delay);
      addTimer(timer);
    }

    const kickoff = setTimeout(() => scheduleNext(), 1200);
    addTimer(kickoff);
  }

  function reset() {
    clearAllTimers();
    set(createEmptyJob());
  }

  function togglePause() {
    update(s => ({ ...s, paused: !s.paused }));
  }

  function toggleCategoryBoost(cat: ModCategory) {
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

  return { subscribe, startJob, reset, togglePause, toggleCategoryBoost, toggleCategoryPause };
}

/* ─── Derived stores ─── */

export const jobStore = createJobStore();

/** Single-pass counts — avoids multiple independent filters per update */
const jobCounts = derived(jobStore, $j => {
  let keeps = 0, discards = 0, crashes = 0, training = 0;
  const nodeIds = new Set<string>();
  for (const e of $j.experiments) {
    if (e.status === 'keep') keeps++;
    else if (e.status === 'discard') discards++;
    else if (e.status === 'crash') crashes++;
    else if (e.status === 'training') training++;
    nodeIds.add(e.nodeId);
  }
  return { completed: keeps + discards + crashes, keeps, discards, crashes, training, activeNodeCount: nodeIds.size };
});

export const completedCount = derived(jobCounts, $c => $c.completed);
export const keepCount = derived(jobCounts, $c => $c.keeps);
export const discardCount = derived(jobCounts, $c => $c.discards);
export const crashCount = derived(jobCounts, $c => $c.crashes);
export const trainingCount = derived(jobCounts, $c => $c.training);
export const activeNodeCount = derived(jobCounts, $c => $c.activeNodeCount);

export const metricHistory = derived(jobStore, $j => {
  const filtered = $j.experiments.filter(e => e.status === 'keep' || e.status === 'discard');
  const reversed = [];
  for (let i = filtered.length - 1; i >= 0; i--) {
    reversed.push({ x: reversed.length + 1, y: filtered[i].metric, status: filtered[i].status });
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
    case 'running': return `Testing ${$c.completed} of ${$j.totalExperiments} approaches`;
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

/* ─── Phase 1B: New derived stores ─── */

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

/* ─── Phase 3C: Visualization derived stores ─── */

/** Scatter plot data: category × metric */
export const scatterData = derived(jobStore, $j => {
  return $j.experiments
    .filter(e => e.status === 'keep' || e.status === 'discard')
    .map(e => ({
      id: e.id,
      modification: e.modification,
      category: (MOD_CATEGORY[e.modification] ?? 'baseline') as ModCategory,
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
    const cat = MOD_CATEGORY[e.modification] ?? 'baseline';
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
    const cat = MOD_CATEGORY[e.modification] ?? 'baseline';
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
      total: d.total,
      keeps: d.keeps,
      crashes: d.crashes,
      bestMetric: d.best,
      hitRate: d.total > 0 ? Math.round((d.keeps / d.total) * 100) : 0,
      active: d.active,
      boosted: $j.boostedCategories.includes(cat),
      paused: $j.pausedCategories.includes(cat),
    });
  }

  // Sort: active first, then by best metric
  branches.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.bestMetric - b.bestMetric;
  });

  return branches;
});

/* ─── Intervention derived stores ─── */

/** Improvement from baseline: % decrease in val_bpb since first keep */
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

/** Which category produced the current best result */
export const bestBranch = derived(jobStore, $j => {
  if ($j.bestMetric === Infinity) return null;
  const bestExp = $j.experiments.find(e => e.status === 'keep' && e.metric === $j.bestMetric);
  if (!bestExp) return null;
  const cat = (MOD_CATEGORY[bestExp.modification] ?? 'baseline') as ModCategory;
  return {
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    color: CATEGORY_COLORS[cat] ?? '#9a9590',
    experimentId: bestExp.id,
    modification: bestExp.modification,
  };
});

/** Global pause state */
export const isPaused = derived(jobStore, $j => $j.paused);

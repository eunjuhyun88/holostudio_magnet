import { derived } from 'svelte/store';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  BRANCH_STRATEGIES,
  resolveExperimentCategory,
  type ModCategory,
} from '../data/modifications.ts';
import { humanizeModification, formatLogTime } from './jobTypes.ts';
import type { Experiment, BranchInfo } from './jobTypes.ts';
import { jobState } from './jobState.ts';

/* ─── Single-pass counts ─── */

const jobCounts = derived(jobState, $j => {
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

/** Job progress as a percentage (0–100), derived from completed experiments / total */
export const jobProgress = derived([jobCounts, jobState], ([$c, $j]) => {
  if ($j.totalExperiments <= 0) return 0;
  return Math.min(100, Math.round(($c.completed / $j.totalExperiments) * 100));
});

/** Commit-Reveal verification pipeline counts */
export const verificationCounts = derived(jobCounts, $c => $c.verification);

export const metricHistory = derived(jobState, $j => {
  const filtered = $j.experiments.filter(e => e.status === 'keep' || e.status === 'discard');
  const reversed: { x: number; y: number; status: string }[] = [];
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

export const statusMessage = derived([jobState, jobCounts], ([$j, $c]) => {
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

export const latestFinding = derived(jobState, $j => {
  const lastKeep = $j.experiments.find(e => e.status === 'keep');
  if (!lastKeep) return null;
  return {
    modification: lastKeep.modification,
    humanReadable: humanizeModification(lastKeep.modification),
    delta: lastKeep.delta,
    metric: lastKeep.metric,
  };
});

let _prevEventLogLen = -1;
let _prevEventLog: any[] = [];
export const eventLog = derived(jobState, $j => {
  if ($j.experiments.length === _prevEventLogLen) return _prevEventLog;
  _prevEventLogLen = $j.experiments.length;
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
  _prevEventLog = evts;
  return evts;
});

export const recentExperiments = derived(jobState, $j => {
  const result: Experiment[] = [];
  for (const e of $j.experiments) {
    if (e.status !== 'training') {
      result.push(e);
      if (result.length >= 10) break;
    }
  }
  return result;
});

export const trainingExperiment = derived(jobState, $j =>
  $j.experiments.find(e => e.status === 'training') ?? null
);

/* ─── Visualization derived stores ─── */

/** Scatter plot data: category × metric — memoized by experiment count */
let _prevScatterLen = -1;
let _prevScatter: any[] = [];
export const scatterData = derived(jobState, $j => {
  if ($j.experiments.length === _prevScatterLen) return _prevScatter;
  _prevScatterLen = $j.experiments.length;
  _prevScatter = $j.experiments
    .filter(e => e.status === 'keep' || e.status === 'discard')
    .map(e => ({
      id: e.id,
      modification: e.modification,
      category: resolveExperimentCategory(e.modification),
      metric: e.metric,
      status: e.status,
      branchId: e.branchId,
    }));
  return _prevScatter;
});

/** Heatmap data: per-category success rates — memoized by experiment count */
let _prevHeatmapLen = -1;
let _prevHeatmap: any = {};
export const heatmapData = derived(jobState, $j => {
  if ($j.experiments.length === _prevHeatmapLen) return _prevHeatmap;
  _prevHeatmapLen = $j.experiments.length;
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
  _prevHeatmap = grid;
  return grid;
});

/** Experiment tree/DAG data — memoized by experiment count */
let _prevTreeLen = -1;
let _prevTree: any[] = [];
export const experimentTree = derived(jobState, $j => {
  if ($j.experiments.length === _prevTreeLen) return _prevTree;
  _prevTreeLen = $j.experiments.length;
  _prevTree = $j.experiments
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
  return _prevTree;
});

/** Branch summary — groups experiments by modification category */
export const branchSummary = derived(jobState, $j => {
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

export const improvementDelta = derived(jobState, $j => {
  if ($j.baselineMetric === Infinity || $j.bestMetric === Infinity) return null;
  const pct = (($j.baselineMetric - $j.bestMetric) / $j.baselineMetric) * 100;
  return {
    raw: Math.round(($j.baselineMetric - $j.bestMetric) * 1000) / 1000,
    percent: Math.round(pct * 10) / 10,
    baseline: $j.baselineMetric,
    current: $j.bestMetric,
  };
});

export const bestBranch = derived(jobState, $j => {
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

export const isPaused = derived(jobState, $j => $j.paused);

/* ─── Page-level derived stores ─── */

/** Average duration of completed experiments */
export const avgDuration = derived(jobState, $j => {
  let sum = 0, count = 0;
  for (const e of $j.experiments) {
    if (e.status !== 'training' && e.duration > 0) { sum += e.duration; count++; }
  }
  return count > 0 ? Math.round(sum / count) : 0;
});

/** Total GPU time formatted */
export const totalGpuTime = derived(jobState, $j => {
  let secs = 0;
  for (const e of $j.experiments) { secs += e.duration * e.tier; }
  if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
  if (secs >= 60) return `${Math.round(secs / 60)}m`;
  return `${secs}s`;
});

/** Best-so-far frontier (monotonically decreasing keep metrics) — memoized by length+last */
let _prevFrontier: number[] = [];
export const bestFrontier = derived(jobState, $j => {
  const frontier: number[] = [];
  let best = Infinity;
  for (let i = $j.experiments.length - 1; i >= 0; i--) {
    const e = $j.experiments[i];
    if (e.status === 'keep' && e.metric < best) { best = e.metric; frontier.push(best); }
  }
  if (frontier.length === _prevFrontier.length && frontier[frontier.length - 1] === _prevFrontier[_prevFrontier.length - 1]) {
    return _prevFrontier;
  }
  _prevFrontier = frontier;
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

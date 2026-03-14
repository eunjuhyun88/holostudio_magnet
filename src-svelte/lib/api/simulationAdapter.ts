import {
  MODIFICATIONS,
  resolveExperimentCategory,
  type ModCategory,
} from '../data/modifications.ts';
import type { Experiment, ExperimentStatus, VerificationState } from '../stores/jobStore.ts';

/* ─── Helpers ─── */

function randomHex(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/* ─── Weighted Modification Selection (3-layer intelligence) ─── */

export function selectModification(
  experiments: Experiment[],
  boosted: ModCategory[],
  paused: ModCategory[],
): string {
  // 1. Filter out paused categories
  const pool = MODIFICATIONS.filter(mod => {
    const cat = resolveExperimentCategory(mod);
    return !paused.includes(cat);
  });
  if (pool.length === 0) return MODIFICATIONS[0]; // fallback

  // 2. Compute per-category keep rates from history
  const catStats = new Map<ModCategory, { total: number; keeps: number }>();
  for (const e of experiments) {
    if (e.status === 'training') continue;
    const cat = resolveExperimentCategory(e.modification);
    if (!catStats.has(cat)) catStats.set(cat, { total: 0, keeps: 0 });
    const s = catStats.get(cat)!;
    s.total++;
    if (e.status === 'keep') s.keeps++;
  }

  // 3. Assign weights
  const weights = pool.map(mod => {
    const cat = resolveExperimentCategory(mod);
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

/* ─── Experiment Generation ─── */

export function generateExperiment(
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
    verification: 'pending' as VerificationState,
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

/* ─── Create Training Experiment ─── */

export function createTrainingExperiment(
  id: number, branchId: number,
  modification: string,
): Experiment {
  const mainNode = `node-${randomHex(4)}`;
  return {
    id,
    parentId: null,
    status: 'training' as ExperimentStatus,
    verification: 'pending' as VerificationState,
    modification,
    metric: 0,
    delta: 0,
    nodeId: mainNode,
    gpuNodes: [mainNode],
    tier: 1,
    branchId,
    duration: 0,
    progress: 0,
    timestamp: Date.now(),
  };
}

import { writable, derived } from 'svelte/store';

// ── Types from shared contracts (re-exported for backward compat) ──
export type { RewardPool, RewardSource, RewardEntry, RewardSummary } from '@mesh/contracts';

import type { RewardEntry } from '@mesh/contracts';

// ── Simulated reward history ──

function generateRewardHistory(): RewardEntry[] {
  const now = Date.now();
  const entries: RewardEntry[] = [];
  const day = 86400000;

  const templates: Array<Omit<RewardEntry, 'id' | 'timestamp'>> = [
    { source: 'pool_b_compute', amount: 0.95, pool: 'B', jobId: 'job-2891', nodeId: 'seoul-4090', description: 'Job #2891 completed — GPU compute reward' },
    { source: 'pool_b_compute', amount: 0.82, pool: 'B', jobId: 'job-2891', nodeId: 'tokyo-4090', description: 'Job #2891 completed — GPU compute reward' },
    { source: 'pool_a_creator', amount: 0.48, pool: 'A', modelId: 'crypto-24h-v3', description: 'Model usage revenue — creator 60%' },
    { source: 'pool_b_compute', amount: 1.20, pool: 'B', jobId: 'job-2887', nodeId: 'seoul-4090', description: 'Job #2887 completed — GPU compute reward' },
    { source: 'pool_a_creator', amount: 0.12, pool: 'A', modelId: 'defi-risk-v1', description: 'Model usage revenue — creator 60%' },
    { source: 'pool_b_compute', amount: 0.63, pool: 'B', jobId: 'job-2891', nodeId: 'berlin-a100', description: 'Job #2891 completed — GPU compute reward' },
    { source: 'ppap_fee', amount: -3.0, pool: 'A', description: 'PPAP batch fee — Treasury 70% / Burn 30%' },
    { source: 'pool_a_creator', amount: 0.24, pool: 'A', modelId: 'crypto-24h-v3', description: 'Model usage revenue — creator 60%' },
    { source: 'pool_b_compute', amount: 0.45, pool: 'B', jobId: 'job-2885', nodeId: 'singapore-4080', description: 'Inference serving — GPU compute' },
    { source: 'challenge_reward', amount: 50.0, pool: 'B', description: 'Valid challenge reward — deposit returned + bonus' },
    { source: 'pool_b_compute', amount: 0.78, pool: 'B', jobId: 'job-2882', nodeId: 'seoul-4090', description: 'Job #2882 completed — GPU compute reward' },
    { source: 'pool_a_creator', amount: 0.36, pool: 'A', modelId: 'crypto-24h-v2', description: 'Model usage revenue — creator 60%' },
    { source: 'pool_b_compute', amount: 1.05, pool: 'B', jobId: 'job-2880', nodeId: 'dubai-h100', description: 'Job #2880 completed — GPU compute reward' },
    { source: 'pool_a_creator', amount: 0.08, pool: 'A', modelId: 'nlp-sentiment-v1', description: 'Model usage revenue — creator 60%' },
    { source: 'ppap_fee', amount: -3.0, pool: 'A', description: 'PPAP batch fee — Treasury 70% / Burn 30%' },
  ];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const ts = new Date(now - i * day * 0.15 - Math.random() * day * 0.1);
    entries.push({
      id: `rwd-${i.toString().padStart(4, '0')}`,
      timestamp: ts.toISOString(),
      ...t,
    });
  }

  return entries;
}

// ── Store ──

function createRewardStore() {
  const entries = generateRewardHistory();
  const { subscribe, update } = writable<RewardEntry[]>(entries);

  return {
    subscribe,
    addEntry(entry: Omit<RewardEntry, 'id' | 'timestamp'>) {
      update(list => [{
        id: `rwd-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...entry,
      }, ...list].slice(0, 200));
    },
  };
}

export const rewardStore = createRewardStore();

// ── Derived stores ──

export const rewardSummary = derived(rewardStore, ($rewards) => {
  const now = Date.now();
  const day = 86400000;
  const positiveEntries = $rewards.filter(r => r.amount > 0);

  // Single-pass aggregation
  let poolB = 0, poolA = 0, challenge = 0, todaySum = 0, weekSum = 0;
  for (const r of positiveEntries) {
    if (r.pool === 'B') poolB += r.amount;
    if (r.pool === 'A') poolA += r.amount;
    if (r.source === 'challenge_reward') challenge += r.amount;
    const age = now - new Date(r.timestamp).getTime();
    if (age < day) todaySum += r.amount;
    if (age < 7 * day) weekSum += r.amount;
  }
  const total = poolB + poolA;

  return {
    total: +total.toFixed(2),
    today: +todaySum.toFixed(2),
    sevenDay: +weekSum.toFixed(2),
    poolB: +poolB.toFixed(2),
    poolA: +poolA.toFixed(2),
    challenge: +challenge.toFixed(2),
    poolBPct: total > 0 ? Math.round((poolB / total) * 100) : 0,
    poolAPct: total > 0 ? Math.round((poolA / total) * 100) : 0,
    challengePct: total > 0 ? Math.round((challenge / total) * 100) : 0,
  };
});

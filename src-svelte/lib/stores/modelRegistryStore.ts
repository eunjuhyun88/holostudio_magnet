import { writable, derived } from 'svelte/store';

// ── Types from shared contracts ──
export type {
  ModelState,
  VTRGrade,
  VTRRecord,
  ModelMetrics,
  ModelUsage,
  PoolADistribution,
  ModelRecord,
} from '@mesh/contracts';

import type { ModelRecord, ModelState } from '@mesh/contracts';

// ── Simulated model data ──

function generateModels(): ModelRecord[] {
  const now = Date.now();
  const day = 86400000;

  return [
    {
      id: 'model-crypto-24h-v3',
      slug: 'crypto-24h-v3',
      name: 'Crypto 24h Prediction v3',
      state: 'NETWORK_ACTIVE',
      originJobId: 'job-2878',
      vtr: {
        grade: 'DETERMINISTIC',
        trainingSeed: 42,
        baseModelId: 'transformer-base-v3',
        ckptHash: '0xab3f...c912',
        ppapRootRef: 'ppap-batch-0035',
      },
      metrics: { best: 0.891, experiments: 8, kept: 3 },
      usage: {
        totalCalls: 12480,
        totalRevenue: 4.82,
        dailyCalls: [1840, 1720, 1650, 1890, 2010, 1780, 1590],
      },
      poolA: { creator: 2.89, notary: 0.72, treasury: 0.72, burn: 0.48 },
      createdAt: new Date(now - 14 * day).toISOString(),
      updatedAt: new Date(now - 0.5 * day).toISOString(),
    },
    {
      id: 'model-defi-risk-v1',
      slug: 'defi-risk-v1',
      name: 'DeFi Risk Scoring v1',
      state: 'NETWORK_ACTIVE',
      originJobId: 'job-2887',
      vtr: {
        grade: 'DETERMINISTIC',
        trainingSeed: 77,
        baseModelId: 'gbm-risk-v1',
        ckptHash: '0x7d21...e4a8',
        ppapRootRef: 'ppap-batch-0039',
      },
      metrics: { best: 0.931, experiments: 5, kept: 3 },
      usage: {
        totalCalls: 3240,
        totalRevenue: 1.08,
        dailyCalls: [420, 380, 510, 490, 460, 520, 460],
      },
      poolA: { creator: 0.65, notary: 0.16, treasury: 0.16, burn: 0.11 },
      createdAt: new Date(now - 5 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
    },
    {
      id: 'model-crypto-24h-v2',
      slug: 'crypto-24h-v2',
      name: 'Crypto 24h Prediction v2',
      state: 'DEPRECATED',
      originJobId: 'job-2860',
      vtr: {
        grade: 'DETERMINISTIC',
        trainingSeed: 42,
        baseModelId: 'transformer-base-v2',
        ckptHash: '0x1f89...b3c7',
        ppapRootRef: 'ppap-batch-0028',
      },
      metrics: { best: 0.843, experiments: 6, kept: 2 },
      usage: {
        totalCalls: 28900,
        totalRevenue: 8.24,
        dailyCalls: [40, 25, 18, 12, 8, 5, 3],
      },
      poolA: { creator: 4.94, notary: 1.24, treasury: 1.24, burn: 0.82 },
      createdAt: new Date(now - 30 * day).toISOString(),
      updatedAt: new Date(now - 7 * day).toISOString(),
    },
    {
      id: 'model-eth-gas-v2',
      slug: 'eth-gas-v2',
      name: 'ETH Gas Prediction v2',
      state: 'PRIVATE_ACTIVE',
      originJobId: 'job-2882',
      vtr: {
        grade: 'SELF_ATTESTED',
        baseModelId: 'lstm-gas-v2',
        ckptHash: '0x5e42...a1d9',
        ppapRootRef: 'ppap-batch-0037',
      },
      metrics: { best: 0.834, experiments: 3, kept: 2 },
      usage: {
        totalCalls: 890,
        totalRevenue: 0.36,
        dailyCalls: [120, 140, 130, 125, 110, 135, 130],
      },
      poolA: { creator: 0.22, notary: 0.05, treasury: 0.05, burn: 0.04 },
      createdAt: new Date(now - 8 * day).toISOString(),
      updatedAt: new Date(now - 2 * day).toISOString(),
    },
    {
      id: 'model-nlp-sentiment-v1',
      slug: 'nlp-sentiment-v1',
      name: 'NLP Sentiment Analysis v1',
      state: 'DRAFT',
      originJobId: 'job-2880',
      vtr: {
        grade: 'SELF_ATTESTED',
        baseModelId: 'bert-sentiment-v1',
        ckptHash: '0x...',
        ppapRootRef: 'ppap-batch-0036',
      },
      metrics: { best: 0.922, experiments: 4, kept: 3 },
      usage: {
        totalCalls: 0,
        totalRevenue: 0,
        dailyCalls: [0, 0, 0, 0, 0, 0, 0],
      },
      poolA: { creator: 0, notary: 0, treasury: 0, burn: 0 },
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 6 * 3600000).toISOString(),
    },
  ];
}

// ── Store ──

function createModelRegistry() {
  const models = generateModels();
  const { subscribe, update } = writable<ModelRecord[]>(models);

  return {
    subscribe,
    addModel(model: Omit<ModelRecord, 'id' | 'createdAt' | 'updatedAt'>) {
      update(list => [{
        id: `model-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...model,
      }, ...list]);
    },
    updateState(modelId: string, state: ModelState) {
      update(list => list.map(m =>
        m.id === modelId ? { ...m, state, updatedAt: new Date().toISOString() } : m
      ));
    },
    recordUsage(modelId: string, calls: number, revenue: number) {
      update(list => list.map(m => {
        if (m.id !== modelId) return m;
        const poolTotal = revenue;
        return {
          ...m,
          usage: {
            ...m.usage,
            totalCalls: m.usage.totalCalls + calls,
            totalRevenue: +(m.usage.totalRevenue + revenue).toFixed(4),
          },
          poolA: {
            creator: +(m.poolA.creator + poolTotal * 0.60).toFixed(4),
            notary: +(m.poolA.notary + poolTotal * 0.15).toFixed(4),
            treasury: +(m.poolA.treasury + poolTotal * 0.15).toFixed(4),
            burn: +(m.poolA.burn + poolTotal * 0.10).toFixed(4),
          },
          updatedAt: new Date().toISOString(),
        };
      }));
    },
  };
}

export const modelRegistryStore = createModelRegistry();

// ── Derived stores ──

export const myModels = derived(modelRegistryStore, ($models) =>
  $models.filter(m => m.state !== 'DEPRECATED')
);

export const activeModels = derived(modelRegistryStore, ($models) =>
  $models.filter(m => ['NETWORK_ACTIVE', 'PRIVATE_ACTIVE'].includes(m.state))
);

export const modelStats = derived(modelRegistryStore, ($models) => {
  const active = $models.filter(m => ['NETWORK_ACTIVE', 'PRIVATE_ACTIVE'].includes(m.state));
  const totalRevenue = $models.reduce((s, m) => s + m.usage.totalRevenue, 0);
  const totalCalls = $models.reduce((s, m) => s + m.usage.totalCalls, 0);
  const bestMetric = Math.max(...$models.map(m => m.metrics.best), 0);

  return {
    total: $models.length,
    active: active.length,
    networkActive: $models.filter(m => m.state === 'NETWORK_ACTIVE').length,
    privateActive: $models.filter(m => m.state === 'PRIVATE_ACTIVE').length,
    draft: $models.filter(m => m.state === 'DRAFT').length,
    deprecated: $models.filter(m => m.state === 'DEPRECATED').length,
    totalRevenue: +totalRevenue.toFixed(2),
    totalCalls,
    bestMetric: +bestMetric.toFixed(3),
  };
});

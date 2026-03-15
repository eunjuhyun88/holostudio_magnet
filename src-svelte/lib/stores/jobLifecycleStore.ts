import { writable, derived } from 'svelte/store';

// ── Types aligned with State Machine spec ──

export type JobState =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'OPEN'
  | 'EXECUTING'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type JobType = 'TRAINING' | 'INFERENCE';

export interface Experiment {
  id: string;
  runIndex: number;
  metric: number;
  kept: boolean;
  timestamp: string;
}

export interface CostBreakdown {
  total: number;
  perRun: number;
  poolB: number;    // 95% to GPU nodes
  treasury: number; // 5% to treasury
}

export interface JobLifecycle {
  id: string;
  state: JobState;
  type: JobType;
  topic: string;
  baseModel: string;
  datasetRef: string;
  budget: number;
  budgetRemaining: number;
  deadline: number;       // hours
  minTier: 1 | 2 | 3;
  claimedNodes: string[];
  experiments: Experiment[];
  vtrState?: 'DRAFT' | 'SUBMITTED' | 'DETERMINISTIC' | 'SELF_ATTESTED';
  modelNftId?: string;
  costBreakdown: CostBreakdown;
  createdAt: string;
  updatedAt: string;
}

// ── Simulated job data ──

function generateJobs(): JobLifecycle[] {
  const now = Date.now();
  const hour = 3600000;
  const day = 86400000;

  return [
    {
      id: 'job-2891',
      state: 'EXECUTING',
      type: 'TRAINING',
      topic: 'BTC/USDT 24h prediction',
      baseModel: 'transformer-base-v3',
      datasetRef: 'ppap-batch-0042',
      budget: 12.0,
      budgetRemaining: 7.35,
      deadline: 48,
      minTier: 2,
      claimedNodes: ['seoul-4090', 'tokyo-4090', 'berlin-a100'],
      experiments: [
        { id: 'exp-001', runIndex: 1, metric: 0.847, kept: true, timestamp: new Date(now - 6 * hour).toISOString() },
        { id: 'exp-002', runIndex: 2, metric: 0.831, kept: false, timestamp: new Date(now - 4 * hour).toISOString() },
        { id: 'exp-003', runIndex: 3, metric: 0.862, kept: true, timestamp: new Date(now - 2 * hour).toISOString() },
      ],
      vtrState: 'DRAFT',
      costBreakdown: { total: 4.65, perRun: 1.55, poolB: 4.42, treasury: 0.23 },
      createdAt: new Date(now - 1.2 * day).toISOString(),
      updatedAt: new Date(now - 2 * hour).toISOString(),
    },
    {
      id: 'job-2887',
      state: 'COMPLETED',
      type: 'TRAINING',
      topic: 'DeFi risk scoring',
      baseModel: 'gbm-risk-v1',
      datasetRef: 'ppap-batch-0039',
      budget: 8.0,
      budgetRemaining: 0,
      deadline: 72,
      minTier: 1,
      claimedNodes: ['seoul-4090'],
      experiments: [
        { id: 'exp-010', runIndex: 1, metric: 0.912, kept: true, timestamp: new Date(now - 3 * day).toISOString() },
        { id: 'exp-011', runIndex: 2, metric: 0.908, kept: false, timestamp: new Date(now - 2.5 * day).toISOString() },
        { id: 'exp-012', runIndex: 3, metric: 0.924, kept: true, timestamp: new Date(now - 2 * day).toISOString() },
        { id: 'exp-013', runIndex: 4, metric: 0.919, kept: false, timestamp: new Date(now - 1.8 * day).toISOString() },
        { id: 'exp-014', runIndex: 5, metric: 0.931, kept: true, timestamp: new Date(now - 1.5 * day).toISOString() },
      ],
      vtrState: 'DETERMINISTIC',
      modelNftId: 'model-defi-risk-v1',
      costBreakdown: { total: 8.0, perRun: 1.6, poolB: 7.6, treasury: 0.4 },
      createdAt: new Date(now - 4 * day).toISOString(),
      updatedAt: new Date(now - 1.5 * day).toISOString(),
    },
    {
      id: 'job-2885',
      state: 'OPEN',
      type: 'INFERENCE',
      topic: 'Crypto-24h inference serving',
      baseModel: 'crypto-24h-v3',
      datasetRef: '',
      budget: 5.0,
      budgetRemaining: 5.0,
      deadline: 24,
      minTier: 1,
      claimedNodes: [],
      experiments: [],
      costBreakdown: { total: 0, perRun: 0.45, poolB: 0, treasury: 0 },
      createdAt: new Date(now - 0.5 * day).toISOString(),
      updatedAt: new Date(now - 0.5 * day).toISOString(),
    },
    {
      id: 'job-2882',
      state: 'COMPLETED',
      type: 'TRAINING',
      topic: 'ETH gas prediction',
      baseModel: 'lstm-gas-v2',
      datasetRef: 'ppap-batch-0037',
      budget: 6.0,
      budgetRemaining: 0,
      deadline: 36,
      minTier: 2,
      claimedNodes: ['seoul-4090', 'dubai-h100'],
      experiments: [
        { id: 'exp-020', runIndex: 1, metric: 0.789, kept: false, timestamp: new Date(now - 5 * day).toISOString() },
        { id: 'exp-021', runIndex: 2, metric: 0.812, kept: true, timestamp: new Date(now - 4.5 * day).toISOString() },
        { id: 'exp-022', runIndex: 3, metric: 0.834, kept: true, timestamp: new Date(now - 4 * day).toISOString() },
      ],
      vtrState: 'SELF_ATTESTED',
      modelNftId: 'model-eth-gas-v2',
      costBreakdown: { total: 6.0, perRun: 2.0, poolB: 5.7, treasury: 0.3 },
      createdAt: new Date(now - 6 * day).toISOString(),
      updatedAt: new Date(now - 4 * day).toISOString(),
    },
    {
      id: 'job-2880',
      state: 'EVALUATING',
      type: 'TRAINING',
      topic: 'NLP sentiment analysis',
      baseModel: 'bert-sentiment-v1',
      datasetRef: 'ppap-batch-0036',
      budget: 10.0,
      budgetRemaining: 2.15,
      deadline: 48,
      minTier: 3,
      claimedNodes: ['dubai-h100'],
      experiments: [
        { id: 'exp-030', runIndex: 1, metric: 0.901, kept: true, timestamp: new Date(now - 1 * day).toISOString() },
        { id: 'exp-031', runIndex: 2, metric: 0.889, kept: false, timestamp: new Date(now - 18 * hour).toISOString() },
        { id: 'exp-032', runIndex: 3, metric: 0.915, kept: true, timestamp: new Date(now - 12 * hour).toISOString() },
        { id: 'exp-033', runIndex: 4, metric: 0.922, kept: true, timestamp: new Date(now - 6 * hour).toISOString() },
      ],
      vtrState: 'SUBMITTED',
      costBreakdown: { total: 7.85, perRun: 1.96, poolB: 7.46, treasury: 0.39 },
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 6 * hour).toISOString(),
    },
  ];
}

// ── Store ──

function createJobStore() {
  const jobs = generateJobs();
  const { subscribe, update } = writable<JobLifecycle[]>(jobs);

  return {
    subscribe,
    addJob(job: Omit<JobLifecycle, 'id' | 'createdAt' | 'updatedAt'>) {
      update(list => [{
        id: `job-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...job,
      }, ...list]);
    },
    updateState(jobId: string, state: JobState) {
      update(list => list.map(j =>
        j.id === jobId ? { ...j, state, updatedAt: new Date().toISOString() } : j
      ));
    },
    addExperiment(jobId: string, exp: Omit<Experiment, 'id'>) {
      update(list => list.map(j =>
        j.id === jobId ? {
          ...j,
          experiments: [...j.experiments, { id: `exp-${Date.now()}`, ...exp }],
          updatedAt: new Date().toISOString(),
        } : j
      ));
    },
  };
}

export const jobLifecycleStore = createJobStore();

// ── Derived stores ──

export const activeJobs = derived(jobLifecycleStore, ($jobs) =>
  $jobs.filter(j => ['OPEN', 'EXECUTING', 'EVALUATING'].includes(j.state))
);

export const completedJobs = derived(jobLifecycleStore, ($jobs) =>
  $jobs.filter(j => j.state === 'COMPLETED')
);

export const jobStats = derived(jobLifecycleStore, ($jobs) => {
  const active = $jobs.filter(j => ['OPEN', 'EXECUTING', 'EVALUATING'].includes(j.state));
  const completed = $jobs.filter(j => j.state === 'COMPLETED');
  const totalSpent = $jobs.reduce((s, j) => s + j.costBreakdown.total, 0);
  const totalExperiments = $jobs.reduce((s, j) => s + j.experiments.length, 0);
  const bestMetric = Math.max(...$jobs.flatMap(j => j.experiments.map(e => e.metric)), 0);

  return {
    total: $jobs.length,
    active: active.length,
    completed: completed.length,
    totalSpent: +totalSpent.toFixed(2),
    totalExperiments,
    bestMetric: +bestMetric.toFixed(3),
    training: $jobs.filter(j => j.type === 'TRAINING').length,
    inference: $jobs.filter(j => j.type === 'INFERENCE').length,
  };
});

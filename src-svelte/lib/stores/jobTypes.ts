import { HUMAN_READABLE } from '../data/modifications.ts';
import type { ModCategory } from '../data/modifications.ts';

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
  runtimeJobId: string | null;
  runtimeStatus: 'offline' | 'connecting' | 'streaming' | 'error';
  runtimeError: string | null;
}

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

/* ─── Default State ─── */

export function createEmptyJob(): AutoresearchJob {
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
    runtimeJobId: null,
    runtimeStatus: 'offline',
    runtimeError: null,
  };
}

/* ─── Helpers ─── */

export function humanizeModification(mod: string): string {
  return HUMAN_READABLE[mod] || mod;
}

export function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

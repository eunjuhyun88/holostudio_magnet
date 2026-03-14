/**
 * services/types.ts — Shared response types for the service layer.
 *
 * These types define the contract between the UI and the data layer.
 * Currently backed by fixture data; designed so each function can later
 * be swapped to `fetch('/api/...')` without changing the consumers.
 */

// ── Research ──

export interface ResearchSummary {
  runningJobs: number;
  queuedJobs: number;
  completedJobs: number;
  totalFindings: number;
  hitRate: number;
  /** Human-readable best metric, e.g. "1.231 bpb" */
  bestMetric: string;
}

// ── Network / System ──

export interface NetworkSummary {
  nodes: number;
  gpuCount: number;
  activeWorkers: number;
  idleWorkers: number;
  cpuUsage: number;
  memUsedGb: number;
  memTotalGb: number;
  vramUsedGb: number;
  vramTotalGb: number;
}

// ── Protocol / Token ──

export interface ProtocolSummary {
  tvl: string;
  burned: string;
  bonds: string;
  trustScore: number;
  mauPercent: number;
}

// ── Models ──

export interface ModelSummaryItem {
  name: string;
  metric: string;
  type: string;
  downloads: number;
}

export interface ModelsSummary {
  count: number;
  topMetric: string;
  models: ModelSummaryItem[];
}

// ── Portfolio (requires login) ──

export interface BondItem {
  name: string;
  tier: string;
  amount: string;
}

export interface PortfolioSummary {
  bondCount: number;
  totalStaked: string;
  modelCount: number;
  bonds: BondItem[];
}

// ── Dashboard Events ──

export interface DashboardEvent {
  id: string;
  timestamp: number;
  type: 'SYS' | 'NET' | 'JOB' | 'EXP' | 'WARN';
  message: string;
}

// ── Aggregated dashboard ──

export interface DashboardData {
  research: ResearchSummary;
  network: NetworkSummary;
  protocol: ProtocolSummary;
  models: ModelsSummary;
  portfolio: PortfolioSummary;
}

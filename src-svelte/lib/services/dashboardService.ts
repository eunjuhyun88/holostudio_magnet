/**
 * dashboardService.ts — Dashboard data aggregation service.
 *
 * Provides a single point of access for all data consumed by
 * DashboardPage, InfoBar, and AppDock. Currently backed by fixture
 * data and Svelte store snapshots; designed for drop-in API replacement.
 *
 * Future: each `get*` function becomes `async` and calls `fetch(...)`.
 */

import {
  DEMO_RESEARCH_METRICS,
  type DashboardJob,
  type SystemMetrics,
} from "../data/dashboardFixture.ts";

import type {
  ResearchSummary,
  NetworkSummary,
  ProtocolSummary,
  ModelsSummary,
  ModelSummaryItem,
  PortfolioSummary,
  BondItem,
  DashboardData,
  DashboardEvent,
} from "./types.ts";

// ── Static fixture data (will become API responses) ──

const FIXTURE_MODELS: ModelSummaryItem[] = [
  { name: "Crypto Market 24h", metric: "1.231 bpb", type: "Transformer", downloads: 1_243 },
  { name: "Token Sentiment",   metric: "91.2% F1",  type: "BERT-tiny",   downloads: 3_420 },
  { name: "MEV Detection",     metric: "96.8% AUC", type: "LightGBM",    downloads: 2_180 },
];

const FIXTURE_PROTOCOL: ProtocolSummary = {
  tvl: "$12.4M",
  burned: "847K",
  bonds: "2,341",
  trustScore: 847,
  mauPercent: 62,
};

const FIXTURE_BONDS: BondItem[] = [
  { name: "seoul-4090", tier: "Standard", amount: "2,000" },
  { name: "berlin-a100", tier: "Enterprise", amount: "10,000" },
  { name: "tokyo-h100", tier: "Lite", amount: "500" },
];

const FIXTURE_PORTFOLIO: PortfolioSummary = {
  bondCount: 3,
  totalStaked: "4,500 HOOT",
  modelCount: 2,
  bonds: FIXTURE_BONDS,
};

const DEMO_EVENTS: DashboardEvent[] = [
  { id: "ev-1", timestamp: Date.now() - 120_000, type: "SYS", message: "Dashboard initialized" },
  { id: "ev-2", timestamp: Date.now() - 90_000,  type: "NET", message: "Mesh connected — 8 nodes online" },
  { id: "ev-3", timestamp: Date.now() - 60_000,  type: "JOB", message: "ETH price prediction started" },
  { id: "ev-4", timestamp: Date.now() - 30_000,  type: "EXP", message: "Experiment #12 completed — 1.231 bpb" },
  { id: "ev-5", timestamp: Date.now() - 10_000,  type: "SYS", message: "Worker seoul-4090 heartbeat OK" },
];

// ── Service functions ──

/**
 * Build research summary from a live job list.
 * Accepts the job list so callers can pass the merged jobStore + fixture list.
 */
export function getResearchSummary(jobs: DashboardJob[]): ResearchSummary {
  const running = jobs.filter(j => j.status === "running");
  const queued  = jobs.filter(j => j.status === "queued");
  const done    = jobs.filter(j => j.status === "complete");
  const totalFindings = jobs.reduce((s, j) => s + j.findings, 0);
  const bestJob = [...running, ...done].sort((a, b) => b.metric - a.metric)[0];

  return {
    runningJobs: running.length,
    queuedJobs: queued.length,
    completedJobs: done.length,
    totalFindings,
    hitRate: DEMO_RESEARCH_METRICS.hitRate,
    bestMetric: bestJob
      ? `${bestJob.metric.toFixed(3)} ${bestJob.metricLabel}`
      : "—",
  };
}

/**
 * Build network summary from live system metrics + worker counts.
 */
export function getNetworkSummary(
  system: SystemMetrics,
  activeWorkerCount: number,
  idleWorkerCount: number,
): NetworkSummary {
  return {
    nodes: system.nodes,
    gpuCount: Math.ceil(system.nodes / 2),
    activeWorkers: activeWorkerCount,
    idleWorkers: idleWorkerCount,
    cpuUsage: system.cpuUsage,
    memUsedGb: system.memUsedGb,
    memTotalGb: system.memTotalGb,
    vramUsedGb: system.vramUsedGb,
    vramTotalGb: system.vramTotalGb,
  };
}

/** Protocol / token economics summary. */
export function getProtocolSummary(): ProtocolSummary {
  return { ...FIXTURE_PROTOCOL };
}

/** Models summary. */
export function getModelsSummary(): ModelsSummary {
  return {
    count: FIXTURE_MODELS.length,
    topMetric: FIXTURE_MODELS[0]?.metric ?? "—",
    models: FIXTURE_MODELS,
  };
}

/** Portfolio summary (bonds, staked, models owned). */
export function getPortfolioSummary(): PortfolioSummary {
  return { ...FIXTURE_PORTFOLIO };
}

/** Dashboard events (initial seed). */
export function getDashboardEvents(): DashboardEvent[] {
  return [...DEMO_EVENTS];
}

/**
 * Aggregated dashboard data. Convenience wrapper.
 */
export function getDashboardData(
  jobs: DashboardJob[],
  system: SystemMetrics,
  activeWorkerCount: number,
  idleWorkerCount: number,
): DashboardData {
  return {
    jobs,
    research: getResearchSummary(jobs),
    network: getNetworkSummary(system, activeWorkerCount, idleWorkerCount),
    protocol: getProtocolSummary(),
    models: getModelsSummary(),
    portfolio: getPortfolioSummary(),
  };
}

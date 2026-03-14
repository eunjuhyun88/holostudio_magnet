/** Dashboard command center simulation data */

export interface DashboardJob {
  id: string;
  topic: string;
  status: 'running' | 'complete' | 'queued';
  progress: number;
  metric: number;
  metricLabel: string;
  findings: number;
  startedAt: number;
}

export interface SystemMetrics {
  nodes: number;
  cpuCores: number;
  cpuUsage: number;
  memUsedGb: number;
  memTotalGb: number;
  vramUsedGb: number;
  vramTotalGb: number;
  activeFlows: number;
}

export interface ResearchMetrics {
  activeJobs: number;
  activeAgents: number;
  configsTested: string;
  findings: number;
  hitRate: number;
}

/** Simulated research jobs for dashboard */
export const DEMO_JOBS: DashboardJob[] = [
  {
    id: 'job-eth-001',
    topic: 'ETH price prediction',
    status: 'running',
    progress: 67,
    metric: 1.231,
    metricLabel: 'bpb',
    findings: 3,
    startedAt: Date.now() - 42 * 60 * 1000,
  },
  {
    id: 'job-defi-002',
    topic: 'DeFi risk classifier',
    status: 'complete',
    progress: 100,
    metric: 0.951,
    metricLabel: 'acc',
    findings: 7,
    startedAt: Date.now() - 180 * 60 * 1000,
  },
  {
    id: 'job-sent-003',
    topic: 'Token sentiment',
    status: 'running',
    progress: 23,
    metric: 0.834,
    metricLabel: 'f1',
    findings: 0,
    startedAt: Date.now() - 12 * 60 * 1000,
  },
  {
    id: 'job-whale-004',
    topic: 'Whale wallet tracking',
    status: 'queued',
    progress: 0,
    metric: 0,
    metricLabel: 'acc',
    findings: 0,
    startedAt: Date.now() - 3 * 60 * 1000,
  },
];

/** Simulated system metrics */
export const DEMO_SYSTEM_METRICS: SystemMetrics = {
  nodes: 8,
  cpuCores: 32,
  cpuUsage: 85,
  memUsedGb: 24,
  memTotalGb: 128,
  vramUsedGb: 35,
  vramTotalGb: 96,
  activeFlows: 1,
};

/** Simulated research metrics */
export const DEMO_RESEARCH_METRICS: ResearchMetrics = {
  activeJobs: 4,
  activeAgents: 2,
  configsTested: '12/60',
  findings: 10,
  hitRate: 42,
};

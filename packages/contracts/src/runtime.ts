export type SurfaceId = "web" | "runtime-api" | "protocol";

export type RuntimeJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "complete"
  | "failed"
  | "stopped";

export type RuntimeJobSource = "manual" | "autoresearch";

export type RuntimeJobProgress = {
  completed: number;
  total: number | null;
};

export type RuntimeJob = {
  id: string;
  topic: string;
  surface: SurfaceId;
  status: RuntimeJobStatus;
  source: RuntimeJobSource;
  createdAt: string;
  updatedAt: string;
  lastCommandAt: string | null;
  progress: RuntimeJobProgress;
  bestMetric: number | null;
  boostedCategories: string[];
  pausedCategories: string[];
};

export type CreateRuntimeJobInput = {
  id: string;
  topic: string;
  surface?: SurfaceId;
  source?: RuntimeJobSource;
  createdAt: string;
  totalExperiments?: number | null;
};

export type RuntimeJobCommand =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "boost_category"; category: string }
  | { type: "unboost_category"; category: string }
  | { type: "pause_category"; category: string }
  | { type: "resume_category"; category: string };

export type RuntimeSnapshot = {
  generatedAt: string;
  jobs: RuntimeJob[];
};

export type RuntimeWorkspaceStatus = "blocked" | "ready" | "running" | "unknown";

export type RuntimeWorkspaceResultStatus = "keep" | "discard" | "crash" | null;

export type RuntimeWorkspaceResultEntry = {
  index: number;
  commit: string | null;
  valBpb: number | null;
  memoryGb: number | null;
  status: RuntimeWorkspaceResultStatus;
  description: string | null;
};

export type RuntimeWorkspaceSummary = {
  workerId: string;
  nodeId: string;
  jobId: string;
  experimentId: string;
  region: string;
  gpuLabel: string;
  workspaceDir: string;
  status: RuntimeWorkspaceStatus;
  branch: string | null;
  head: string | null;
  launchAttempted: boolean | null;
  blockers: string[];
  resultsCount: number;
  keepCount: number;
  discardCount: number;
  crashCount: number;
  bestMetric: number | null;
  lastMetric: number | null;
  lastResultStatus: RuntimeWorkspaceResultStatus;
  lastDescription: string | null;
  lastRunAt: string | null;
  runLogPath: string;
  resultsPath: string;
  agentStatusPath: string | null;
  results: RuntimeWorkspaceResultEntry[];
};

export type RuntimeControllerSummary = {
  reachable: boolean;
  port: number | null;
  mode: string | null;
  supportsCommands: boolean | null;
  iterations: number | null;
  keeps: number | null;
  discards: number | null;
  crashes: number | null;
  workers: number | null;
  events: number | null;
  stopReason: string | null;
  paused: boolean | null;
  boostedCategories: string[];
  pausedCategories: string[];
  lastCommandAt: string | null;
  fetchedAt: string;
  error: string | null;
};

export type RuntimeSupervisorSummary = {
  updatedAt: string | null;
  repoPath: string | null;
  nanochatRepoPath: string | null;
  round1BaselineCommit: string | null;
  workers: number | null;
  ready: boolean | null;
  blockers: string[];
};

export type RuntimeMeshTotals = {
  workspaces: number;
  blocked: number;
  ready: number;
  running: number;
  results: number;
  keepCount: number;
  discardCount: number;
  crashCount: number;
  bestMetric: number | null;
  telemetryEvents: number;
};

export type RuntimeMeshSummary = {
  generatedAt: string;
  ready: boolean;
  runtimeRoot: string;
  missing: string[];
  controller: RuntimeControllerSummary | null;
  supervisor: RuntimeSupervisorSummary | null;
  workspaces: RuntimeWorkspaceSummary[];
  totals: RuntimeMeshTotals;
};

export type RuntimeEvent =
  | { type: "job.created"; ts: string; job: RuntimeJob }
  | { type: "job.updated"; ts: string; job: RuntimeJob }
  | { type: "job.command.accepted"; ts: string; jobId: string; command: RuntimeJobCommand }
  | { type: "runtime.snapshot"; ts: string; snapshot: RuntimeSnapshot };

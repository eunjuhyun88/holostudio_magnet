import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type {
  RuntimeControllerSummary,
  RuntimeMeshSummary,
  RuntimeSupervisorSummary,
  RuntimeWorkspaceResultEntry,
  RuntimeWorkspaceResultStatus,
  RuntimeWorkspaceStatus,
  RuntimeWorkspaceSummary,
} from "../../contracts/src/index.ts";

type ManifestWorkspace = {
  workspace: string;
  nodeId: string;
  workerId: string;
  jobId: string;
  experimentId: string;
  region: string;
  lat: number;
  lng: number;
  cpu: number;
  gpu: number;
  memGb: number;
  gpuLabel: string;
};

type ManifestFile = {
  defaultHub: {
    lat: number;
    lng: number;
  };
  defaults: {
    cpu: number;
    gpu: number;
    memGb: number;
  };
  workspaces: ManifestWorkspace[];
};

type SupervisorStateFile = {
  controllerPort?: number;
  manifestPath?: string;
  repoPath?: string;
  nanochatRepoPath?: string;
  round1BaselineCommit?: string;
  workers?: number;
  updatedAt?: string;
  preflight?: {
    ready?: boolean;
    blockers?: string[];
  };
};

type AgentStatusSummary = {
  launchAttempted: boolean | null;
  blockers: string[];
};

type ResultRow = {
  index: number;
  commit: string | null;
  valBpb: number | null;
  memoryGb: number | null;
  status: RuntimeWorkspaceResultStatus;
  description: string | null;
};

export async function inspectAutoresearchRuntimeRoot(
  projectRoot: string,
  runtimeRootInput: string,
): Promise<RuntimeMeshSummary> {
  const runtimeRoot = resolveRuntimeRoot(projectRoot, runtimeRootInput);
  const generatedAt = new Date().toISOString();
  const manifestPath = resolve(runtimeRoot, "manifest.json");
  const supervisorStatePath = resolve(runtimeRoot, "supervisor-state.json");
  const telemetryLogPath = resolve(runtimeRoot, "telemetry.ndjson");
  const missing: string[] = [];

  const manifest = await readJsonIfExists<ManifestFile>(manifestPath);
  if (!manifest) {
    missing.push(`manifest missing at ${manifestPath}`);
  }

  const supervisor = await readJsonIfExists<SupervisorStateFile>(supervisorStatePath);
  const supervisorSummary = createSupervisorSummary(supervisor);
  const controllerSummary = await inspectController(supervisor?.controllerPort ?? null);
  const telemetryEvents = await countTelemetryEvents(telemetryLogPath);

  const workspaces = manifest
    ? await Promise.all(
        manifest.workspaces.map((workspace) =>
          inspectWorkspace({
            manifestPath,
            runtimeRoot,
            workspace,
            controller: controllerSummary,
            supervisor: supervisorSummary,
          }),
        ),
      )
    : [];

  const totals = {
    workspaces: workspaces.length,
    blocked: workspaces.filter((workspace) => workspace.status === "blocked").length,
    ready: workspaces.filter((workspace) => workspace.status === "ready").length,
    running: workspaces.filter((workspace) => workspace.status === "running").length,
    results: workspaces.reduce((sum, workspace) => sum + workspace.resultsCount, 0),
    keepCount: workspaces.reduce((sum, workspace) => sum + workspace.keepCount, 0),
    discardCount: workspaces.reduce((sum, workspace) => sum + workspace.discardCount, 0),
    crashCount: workspaces.reduce((sum, workspace) => sum + workspace.crashCount, 0),
    bestMetric: minMetric(workspaces.map((workspace) => workspace.bestMetric)),
    telemetryEvents,
  };

  return {
    generatedAt,
    ready: missing.length === 0,
    runtimeRoot,
    missing,
    controller: controllerSummary,
    supervisor: supervisorSummary,
    workspaces,
    totals,
  };
}

async function inspectWorkspace({
  manifestPath,
  runtimeRoot,
  workspace,
  controller,
  supervisor,
}: {
  manifestPath: string;
  runtimeRoot: string;
  workspace: ManifestWorkspace;
  controller: RuntimeControllerSummary | null;
  supervisor: RuntimeSupervisorSummary | null;
}): Promise<RuntimeWorkspaceSummary> {
  const workspaceDir = resolve(dirname(manifestPath), workspace.workspace);
  const slug = workspace.workerId.replace(/^worker-/, "");
  const resultsPath = resolve(workspaceDir, "results.tsv");
  const runLogPath = resolve(workspaceDir, "run.log");
  const agentStatusPath = resolve(runtimeRoot, "agent-logs", slug, "agent_status.md");

  const [rows, branch, head, lastRunAt, agentStatus] = await Promise.all([
    readResultRows(resultsPath),
    runGit(workspaceDir, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => null),
    runGit(workspaceDir, ["rev-parse", "HEAD"]).catch(() => null),
    readIsoMtime(runLogPath),
    readAgentStatus(agentStatusPath),
  ]);

  const lastRow = rows.at(-1) ?? null;
  const blockers = uniqueItems([
    ...(agentStatus?.blockers ?? []),
    ...(supervisor?.blockers ?? []),
  ]);
  const launchAttempted = agentStatus?.launchAttempted ?? null;
  const status = deriveWorkspaceStatus({
    controller,
    blockers,
    launchAttempted,
  });

  return {
    workerId: workspace.workerId,
    nodeId: workspace.nodeId,
    jobId: workspace.jobId,
    experimentId: workspace.experimentId,
    region: workspace.region,
    gpuLabel: workspace.gpuLabel,
    workspaceDir,
    status,
    branch,
    head,
    launchAttempted,
    blockers,
    resultsCount: rows.length,
    keepCount: rows.filter((row) => row.status === "keep").length,
    discardCount: rows.filter((row) => row.status === "discard").length,
    crashCount: rows.filter((row) => row.status === "crash").length,
    bestMetric: minMetric(rows.map((row) => validMetric(row.status, row.valBpb))),
    lastMetric: validMetric(lastRow?.status ?? null, lastRow?.valBpb ?? null),
    lastResultStatus: lastRow?.status ?? null,
    lastDescription: lastRow?.description ?? null,
    lastRunAt,
    runLogPath,
    resultsPath,
    agentStatusPath: (await pathExists(agentStatusPath)) ? agentStatusPath : null,
    results: rows.map((row) => ({
      index: row.index,
      commit: row.commit,
      valBpb: row.valBpb,
      memoryGb: row.memoryGb,
      status: row.status,
      description: row.description,
    })),
  };
}

function createSupervisorSummary(state: SupervisorStateFile | null): RuntimeSupervisorSummary | null {
  if (!state) {
    return null;
  }

  return {
    updatedAt: state.updatedAt ?? null,
    repoPath: state.repoPath ?? null,
    nanochatRepoPath: state.nanochatRepoPath ?? null,
    round1BaselineCommit: state.round1BaselineCommit ?? null,
    workers: typeof state.workers === "number" ? state.workers : null,
    ready: typeof state.preflight?.ready === "boolean" ? state.preflight.ready : null,
    blockers: state.preflight?.blockers ?? [],
  };
}

async function inspectController(port: number | null): Promise<RuntimeControllerSummary | null> {
  if (!port) {
    return null;
  }

  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(`http://localhost:${port}/healthz`);
    if (!response.ok) {
      return {
        reachable: false,
        port,
        mode: null,
        supportsCommands: null,
        iterations: null,
        keeps: null,
        discards: null,
        crashes: null,
        workers: null,
        events: null,
        stopReason: null,
        paused: null,
        boostedCategories: [],
        pausedCategories: [],
        lastCommandAt: null,
        fetchedAt,
        error: `healthz returned ${response.status}`,
      };
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      reachable: true,
      port,
      mode: typeof data.mode === "string" ? data.mode : null,
      supportsCommands: typeof data.supportsCommands === "boolean" ? data.supportsCommands : null,
      iterations: readNumber(data.iterations),
      keeps: readNumber(data.keeps),
      discards: readNumber(data.discards),
      crashes: readNumber(data.crashes),
      workers: readNumber(data.workers),
      events: readNumber(data.events),
      stopReason: typeof data.stopReason === "string" ? data.stopReason : null,
      paused: typeof data.paused === "boolean" ? data.paused : null,
      boostedCategories: readStringList(data.boostedCategories),
      pausedCategories: readStringList(data.pausedCategories),
      lastCommandAt: typeof data.lastCommandAt === "string" ? data.lastCommandAt : null,
      fetchedAt,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      port,
      mode: null,
      supportsCommands: null,
      iterations: null,
      keeps: null,
      discards: null,
      crashes: null,
      workers: null,
      events: null,
      stopReason: null,
      paused: null,
      boostedCategories: [],
      pausedCategories: [],
      lastCommandAt: null,
      fetchedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readResultRows(resultsPath: string): Promise<ResultRow[]> {
  const raw = await readFile(resultsPath, "utf8").catch(() => "");
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [commit, valBpb, memoryGb, status, ...descriptionParts] = line.split("\t");
      return {
        index: index + 1,
        commit: commit?.trim() || null,
        valBpb: parseOptionalNumber(valBpb),
        memoryGb: parseOptionalNumber(memoryGb),
        status: normalizeResultStatus(status),
        description: descriptionParts.join("\t").trim() || null,
      } satisfies ResultRow;
    });
}

async function readAgentStatus(agentStatusPath: string): Promise<AgentStatusSummary | null> {
  const raw = await readFile(agentStatusPath, "utf8").catch(() => "");
  if (!raw.trim()) {
    return null;
  }

  if (raw.startsWith("# Agent Session")) {
    return {
      launchAttempted: true,
      blockers: [],
    };
  }

  const launchMatch = raw.match(/^launch_attempted:\s*(true|false)\s*$/m);
  const blockersSection = raw.match(/## Blockers\s+([\s\S]*?)\n## /);
  const blockers = blockersSection
    ? blockersSection[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2))
        .filter((line) => line !== "none")
    : [];

  return {
    launchAttempted: launchMatch ? launchMatch[1] === "true" : null,
    blockers,
  };
}

function deriveWorkspaceStatus({
  controller,
  blockers,
  launchAttempted,
}: {
  controller: RuntimeControllerSummary | null;
  blockers: string[];
  launchAttempted: boolean | null;
}): RuntimeWorkspaceStatus {
  if (blockers.length > 0) {
    return "blocked";
  }
  if (controller?.reachable && !controller.stopReason) {
    return "running";
  }
  if (launchAttempted !== null || controller?.stopReason) {
    return "ready";
  }
  return "unknown";
}

async function countTelemetryEvents(telemetryLogPath: string): Promise<number> {
  const raw = await readFile(telemetryLogPath, "utf8").catch(() => "");
  if (!raw.trim()) {
    return 0;
  }
  return raw.split(/\r?\n/).filter(Boolean).length;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readIsoMtime(filePath: string): Promise<string | null> {
  try {
    const metadata = await stat(filePath);
    return metadata.mtime.toISOString();
  } catch {
    return null;
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn("git", ["-C", cwd, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(Buffer.concat(stdout).toString("utf8").trim());
        return;
      }
      rejectPromise(new Error(Buffer.concat(stderr).toString("utf8").trim() || "git command failed"));
    });
  });
}

function resolveRuntimeRoot(projectRoot: string, runtimeRootInput: string): string {
  return isAbsolute(runtimeRootInput) ? runtimeRootInput : resolve(projectRoot, runtimeRootInput);
}

function parseOptionalNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResultStatus(value: string | null | undefined): RuntimeWorkspaceResultStatus {
  if (value === "keep" || value === "discard" || value === "crash") {
    return value;
  }
  return null;
}

function validMetric(status: RuntimeWorkspaceResultStatus, metric: number | null): number | null {
  if (status === "crash") {
    return null;
  }
  if (metric === null || metric <= 0) {
    return null;
  }
  return metric;
}

function minMetric(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) {
    return null;
  }
  return Math.min(...filtered);
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function uniqueItems(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

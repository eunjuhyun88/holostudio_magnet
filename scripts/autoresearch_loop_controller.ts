import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  appendFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseCliArgs,
} from "./autoresearch_to_telemetry.ts";
import type {
  ExperimentResult,
  Job,
  NodeState,
  TelemetryEvent,
  Worker,
} from "../src/fixed/types.ts";

type ControllerMode = "simulate" | "watch";

type RegionPreset = {
  slug: string;
  region: string;
  lat: number;
  lng: number;
  gpuLabel: string;
  cpu: number;
  gpu: number;
  memGb: number;
};

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

type ControllerConfig = {
  mode: ControllerMode;
  repoPath?: string;
  baseRef: string;
  runtimeRoot: string;
  workspaceRoot: string;
  manifestPath: string;
  telemetryLogPath: string;
  port: number;
  workers: number;
  tickMs: number;
  simulationIterationMs: number;
  cooldownMs: number;
  maxIterations: number;
  maxNoKeep: number;
  targetValBpb?: number;
  maxRuntimeMs?: number;
  enableWorktreeBootstrap: boolean;
  writeTelemetryLog: boolean;
};

type ControllerWorkspace = {
  id: string;
  slug: string;
  workspaceDir: string;
  resultsPath: string;
  runLogPath: string;
  nodeId: string;
  workerId: string;
  region: string;
  lat: number;
  lng: number;
  cpu: number;
  gpu: number;
  memGb: number;
  gpuLabel: string;
  nextExperimentIndex: number;
  nextStartAt: number;
  bestMetric: number;
  previousMetric?: number;
  noKeepStreak: number;
  lastKnownResultCount: number;
  lastKnownRunLogFingerprint?: string;
  activeRun?: ActiveRun;
};

type ActiveRun = {
  experimentId: string;
  jobId: string;
  description: string;
  commit: string;
  status: ExperimentResult;
  targetMetric?: number;
  metricDelta?: number;
  peakVramGb: number;
  startedAt: number;
  patchMs: number;
  trainingMs: number;
  evaluatingMs: number;
  cooldownMs: number;
  progressMarkers: number[];
  emittedProgressCount: number;
  trainingStarted: boolean;
  evaluatingEmitted: boolean;
  resultEmitted: boolean;
};

type Client = {
  id: string;
  response: import("node:http").ServerResponse<import("node:http").IncomingMessage>;
};

type ControllerRuntime = {
  config: ControllerConfig;
  manifest: ManifestFile;
  workspaces: ControllerWorkspace[];
  history: TelemetryEvent[];
  clients: Map<string, Client>;
  iterations: number;
  keeps: number;
  discards: number;
  crashes: number;
  startedAt: number;
  stopReason: string | null;
};

type ResultRow = {
  commit: string;
  valBpb?: number;
  memoryGb?: number;
  status?: ExperimentResult;
  description: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const defaultRuntimeRoot = resolve(rootDir, "runtime/autoresearch-loop");
const defaultWorkspaceRoot = resolve(defaultRuntimeRoot, "workspaces");
const defaultManifestPath = resolve(defaultRuntimeRoot, "manifest.json");
const defaultTelemetryLogPath = resolve(defaultRuntimeRoot, "telemetry.ndjson");
const resultsHeader = "commit\tval_bpb\tmemory_gb\tstatus\tdescription\n";

const regionPresets: RegionPreset[] = [
  { slug: "seoul-4090", region: "Seoul", lat: 37.5665, lng: 126.978, gpuLabel: "RTX 4090", cpu: 24, gpu: 1, memGb: 32 },
  { slug: "singapore-4080", region: "Singapore", lat: 1.3521, lng: 103.8198, gpuLabel: "RTX 4080", cpu: 24, gpu: 1, memGb: 48 },
  { slug: "berlin-a100", region: "Berlin", lat: 52.52, lng: 13.405, gpuLabel: "A100 80GB", cpu: 32, gpu: 1, memGb: 80 },
  { slug: "dubai-h100", region: "Dubai", lat: 25.2048, lng: 55.2708, gpuLabel: "H100 80GB", cpu: 32, gpu: 1, memGb: 80 },
  { slug: "mumbai-l40s", region: "Mumbai", lat: 19.076, lng: 72.8777, gpuLabel: "L40S", cpu: 24, gpu: 1, memGb: 48 },
  { slug: "tokyo-4090", region: "Tokyo", lat: 35.6762, lng: 139.6503, gpuLabel: "RTX 4090", cpu: 24, gpu: 1, memGb: 32 },
  { slug: "london-a6000", region: "London", lat: 51.5072, lng: -0.1276, gpuLabel: "RTX A6000", cpu: 32, gpu: 1, memGb: 48 },
  { slug: "new-york-h100", region: "New York", lat: 40.7128, lng: -74.006, gpuLabel: "H100 80GB", cpu: 32, gpu: 1, memGb: 80 },
];

const experimentIdeas = [
  "raise muon momentum on attention path",
  "shrink residual projection init scale",
  "swap window pattern for denser local blocks",
  "increase device batch size after warmup",
  "reduce depth and widen heads slightly",
  "tighten lr decay floor to stabilize endgame",
  "bias norm eps toward lower-variance tokens",
  "reweight mlp expansion against kv bandwidth",
  "trim rotary span for shorter effective context",
  "rebalance adamw decay on embedding table",
];

function mainModulePath(): string | null {
  const entry = process.argv[1];
  return entry ? resolve(entry) : null;
}

function isMain(): boolean {
  const entry = mainModulePath();
  return entry !== null && fileURLToPath(import.meta.url) === entry;
}

function parseConfig(): ControllerConfig {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = (args.get("mode")?.[0] ?? "simulate") as ControllerMode;
  const runtimeRoot = resolveInputPath(args.get("runtime-root")?.[0] ?? defaultRuntimeRoot);
  const workspaceRoot = resolveInputPath(args.get("workspace-root")?.[0] ?? resolve(runtimeRoot, "workspaces"));
  const manifestPath = resolveInputPath(args.get("manifest")?.[0] ?? resolve(runtimeRoot, "manifest.json"));
  const telemetryLogPath = resolveInputPath(args.get("telemetry-log")?.[0] ?? resolve(runtimeRoot, "telemetry.ndjson"));

  return {
    mode: mode === "watch" ? "watch" : "simulate",
    repoPath: args.get("repo")?.[0] ? resolveInputPath(args.get("repo")?.[0]!) : undefined,
    baseRef: args.get("base-ref")?.[0] ?? "HEAD",
    runtimeRoot,
    workspaceRoot,
    manifestPath,
    telemetryLogPath,
    port: Number(args.get("port")?.[0] ?? "8787"),
    workers: Math.max(1, Number(args.get("workers")?.[0] ?? "6")),
    tickMs: Math.max(150, Number(args.get("tick-ms")?.[0] ?? "700")),
    simulationIterationMs: Math.max(5000, Number(args.get("simulate-iteration-ms")?.[0] ?? "18000")),
    cooldownMs: Math.max(800, Number(args.get("cooldown-ms")?.[0] ?? "2600")),
    maxIterations: Math.max(1, Number(args.get("max-iterations")?.[0] ?? "240")),
    maxNoKeep: Math.max(1, Number(args.get("max-no-keep")?.[0] ?? "32")),
    targetValBpb: parseOptionalNumber(args.get("target-val-bpb")?.[0]),
    maxRuntimeMs: parseOptionalNumber(args.get("max-runtime-minutes")?.[0], 60000),
    enableWorktreeBootstrap: args.get("bootstrap")?.[0] !== "false",
    writeTelemetryLog: args.get("write-telemetry-log")?.[0] !== "false",
  };
}

async function setupRuntime(config: ControllerConfig): Promise<ControllerRuntime> {
  await mkdir(config.runtimeRoot, { recursive: true });
  await mkdir(config.workspaceRoot, { recursive: true });

  const manifest = config.enableWorktreeBootstrap && config.repoPath
    ? await bootstrapManifest(config)
    : await loadOrCreateManifest(config);

  if (config.writeTelemetryLog) {
    await writeFile(config.telemetryLogPath, "", "utf8");
  }

  const workspaces = await Promise.all(
    manifest.workspaces.map(async (entry, index) => {
      const workspaceDir = resolve(dirname(config.manifestPath), entry.workspace);
      const resultsPath = resolve(workspaceDir, "results.tsv");
      const runLogPath = resolve(workspaceDir, "run.log");
      await mkdir(workspaceDir, { recursive: true });
      await ensureResultsHeader(resultsPath);

      const rows = await readResultRows(resultsPath);
      const latestMetric = rows.at(-1)?.valBpb;

      return {
        id: entry.workerId,
        slug: entry.workerId.replace(/^worker-/, ""),
        workspaceDir,
        resultsPath,
        runLogPath,
        nodeId: entry.nodeId,
        workerId: entry.workerId,
        region: entry.region,
        lat: entry.lat,
        lng: entry.lng,
        cpu: entry.cpu,
        gpu: entry.gpu,
        memGb: entry.memGb,
        gpuLabel: entry.gpuLabel,
        nextExperimentIndex: rows.length + 1,
        nextStartAt: Date.now() + 800 + index * 850,
        bestMetric: latestMetric ?? seededMetric(index),
        previousMetric: latestMetric,
        noKeepStreak: 0,
        lastKnownResultCount: rows.length,
        lastKnownRunLogFingerprint: await readFingerprint(runLogPath),
      } satisfies ControllerWorkspace;
    }),
  );

  const runtime: ControllerRuntime = {
    config,
    manifest,
    workspaces,
    history: [],
    clients: new Map(),
    iterations: 0,
    keeps: 0,
    discards: 0,
    crashes: 0,
    startedAt: Date.now(),
    stopReason: null,
  };

  for (const workspace of runtime.workspaces) {
    emit(runtime, {
      ts: new Date().toISOString(),
      type: "node.online",
      node: {
        id: workspace.nodeId,
        lat: workspace.lat,
        lng: workspace.lng,
        cpu: workspace.cpu,
        gpu: workspace.gpu,
        memGb: workspace.memGb,
      },
    });
    emit(runtime, {
      ts: new Date().toISOString(),
      type: "node.available",
      nodeId: workspace.nodeId,
    });
    emit(runtime, {
      ts: new Date().toISOString(),
      type: "worker.started",
      worker: {
        id: workspace.workerId,
        gpuLabel: workspace.gpuLabel,
        region: workspace.region,
        nodeId: workspace.nodeId,
        experimentId: `exp-${workspace.slug}-seed`,
        state: "idle",
        progress: 0,
        metric: workspace.previousMetric,
      } satisfies Worker,
    });
  }

  return runtime;
}

async function bootstrapManifest(config: ControllerConfig): Promise<ManifestFile> {
  const manifestDir = dirname(config.manifestPath);
  await mkdir(manifestDir, { recursive: true });

  const selectedPresets = selectRegionPresets(config.workers);
  const workspaces: ManifestWorkspace[] = [];

  for (const preset of selectedPresets) {
    const workspaceDir = resolve(config.workspaceRoot, preset.slug);
    await ensureGitWorkspace({
      repoPath: config.repoPath!,
      workspaceDir,
      baseRef: config.baseRef,
      branchName: `codex/autoresearch-${preset.slug}-${shortHash(workspaceDir)}`,
    });

    workspaces.push({
      workspace: relative(manifestDir, workspaceDir),
      nodeId: `node-${preset.slug}`,
      workerId: `worker-${preset.slug}`,
      jobId: `job-${preset.slug}`,
      experimentId: `exp-${preset.slug}-seed`,
      region: preset.region,
      lat: preset.lat,
      lng: preset.lng,
      cpu: preset.cpu,
      gpu: preset.gpu,
      memGb: preset.memGb,
      gpuLabel: preset.gpuLabel,
    });
  }

  const manifest: ManifestFile = {
    defaultHub: deriveHub(selectedPresets),
    defaults: {
      cpu: 16,
      gpu: 1,
      memGb: 32,
    },
    workspaces,
  };

  await writeFile(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function loadOrCreateManifest(config: ControllerConfig): Promise<ManifestFile> {
  try {
    const raw = await readFile(config.manifestPath, "utf8");
    return JSON.parse(raw) as ManifestFile;
  } catch {
    if (!config.repoPath) {
      throw new Error("Missing manifest. Provide --manifest or --repo to bootstrap workspaces.");
    }
    return bootstrapManifest(config);
  }
}

async function ensureGitWorkspace({
  repoPath,
  workspaceDir,
  baseRef,
  branchName,
}: {
  repoPath: string;
  workspaceDir: string;
  baseRef: string;
  branchName: string;
}) {
  const gitDir = resolve(workspaceDir, ".git");
  if (await pathExists(gitDir)) {
    return;
  }

  await mkdir(dirname(workspaceDir), { recursive: true });

  if (await gitBranchExists(repoPath, branchName)) {
    await runProcess("git", ["-C", repoPath, "worktree", "add", workspaceDir, branchName], repoPath);
    return;
  }

  await runProcess(
    "git",
    ["-C", repoPath, "worktree", "add", "-b", branchName, workspaceDir, baseRef],
    repoPath,
  );
}

async function gitBranchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    await runProcess("git", ["-C", repoPath, "show-ref", "--verify", `refs/heads/${branchName}`], repoPath);
    return true;
  } catch {
    return false;
  }
}

async function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} failed: ${Buffer.concat(stderr).toString("utf8")}`));
    });
  });
}

function createServerRuntime(runtime: ControllerRuntime) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/healthz") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({
        ok: true,
        mode: runtime.config.mode,
        iterations: runtime.iterations,
        keeps: runtime.keeps,
        discards: runtime.discards,
        crashes: runtime.crashes,
        stopReason: runtime.stopReason,
        workers: runtime.workspaces.length,
        events: runtime.history.length,
      }));
      return;
    }

    if (url.pathname === "/manifest") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify(runtime.manifest, null, 2));
      return;
    }

    if (url.pathname === "/state") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({
        mode: runtime.config.mode,
        startedAt: new Date(runtime.startedAt).toISOString(),
        stopReason: runtime.stopReason,
        workspaces: runtime.workspaces.map((workspace) => ({
          workerId: workspace.workerId,
          region: workspace.region,
          bestMetric: workspace.bestMetric,
          previousMetric: workspace.previousMetric,
          noKeepStreak: workspace.noKeepStreak,
          lastKnownResultCount: workspace.lastKnownResultCount,
          activeRun: workspace.activeRun
            ? {
                experimentId: workspace.activeRun.experimentId,
                jobId: workspace.activeRun.jobId,
                status: workspace.activeRun.status,
                targetMetric: workspace.activeRun.targetMetric,
              }
            : null,
        })),
      }, null, 2));
      return;
    }

    if (url.pathname !== "/events") {
      response.writeHead(404, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const clientId = crypto.randomUUID();
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });

    response.write("retry: 1500\n");
    response.write("event: meta\n");
    response.write(`data: ${JSON.stringify({
      clientId,
      mode: runtime.config.mode,
      events: runtime.history.length,
      workers: runtime.workspaces.length,
    })}\n\n`);

    for (const event of runtime.history) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    runtime.clients.set(clientId, { id: clientId, response });
    request.on("close", () => {
      const client = runtime.clients.get(clientId);
      if (!client) {
        return;
      }
      if (!client.response.writableEnded) {
        client.response.end();
      }
      runtime.clients.delete(clientId);
    });
  });
}

function emit(runtime: ControllerRuntime, event: TelemetryEvent) {
  runtime.history.push(event);
  const line = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of runtime.clients.values()) {
    client.response.write(line);
  }

  if (runtime.config.writeTelemetryLog) {
    void appendFile(runtime.config.telemetryLogPath, `${JSON.stringify(event)}\n`, "utf8");
  }
}

function startSimulationLoop(runtime: ControllerRuntime) {
  const timer = setInterval(async () => {
    try {
      await tickSimulation(runtime);
    } catch (error) {
      console.error(`[controller] simulation tick failed: ${toErrorMessage(error)}`);
    }
  }, runtime.config.tickMs);

  return timer;
}

async function tickSimulation(runtime: ControllerRuntime) {
  if (shouldStop(runtime)) {
    return;
  }

  const now = Date.now();

  for (const workspace of runtime.workspaces) {
    if (!workspace.activeRun) {
      if (now >= workspace.nextStartAt) {
        startSimulatedRun(runtime, workspace, now);
      }
      continue;
    }

    const run = workspace.activeRun;
    const elapsed = now - run.startedAt;

    if (!run.trainingStarted && elapsed >= run.patchMs) {
      run.trainingStarted = true;
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "job.created",
        job: {
          id: run.jobId,
          hubLat: runtime.manifest.defaultHub.lat,
          hubLng: runtime.manifest.defaultHub.lng,
          workerIds: [workspace.workerId],
          nodeIds: [workspace.nodeId],
          state: "queued",
        } satisfies Job,
      });
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "node.assigned",
        nodeId: workspace.nodeId,
        jobId: run.jobId,
      });
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "job.state",
        jobId: run.jobId,
        state: "training",
      });
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "worker.state",
        workerId: workspace.workerId,
        state: "training",
        progress: 0.08,
      });
      await writeRunLogHeader(workspace.runLogPath, run);
    }

    if (run.trainingStarted && !run.resultEmitted) {
      const trainingElapsed = Math.max(0, elapsed - run.patchMs);
      const progressRatio = Math.min(trainingElapsed / run.trainingMs, 1);

      while (
        run.emittedProgressCount < run.progressMarkers.length &&
        progressRatio >= run.progressMarkers[run.emittedProgressCount]
      ) {
        const progress = run.progressMarkers[run.emittedProgressCount];
        run.emittedProgressCount += 1;
        await appendTrainingStep(workspace.runLogPath, run, progress);
        emit(runtime, {
          ts: new Date().toISOString(),
          type: "worker.state",
          workerId: workspace.workerId,
          state: "training",
          progress: clampNumber(0.12 + progress * 0.72, 0.12, 0.86),
        });
      }
    }

    if (!run.evaluatingEmitted && elapsed >= run.patchMs + run.trainingMs) {
      run.evaluatingEmitted = true;
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "worker.state",
        workerId: workspace.workerId,
        state: "evaluating",
        progress: 0.93,
        metric: run.targetMetric,
        metricDelta: run.metricDelta,
      });
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "job.state",
        jobId: run.jobId,
        state: "evaluating",
      });
    }

    if (!run.resultEmitted && elapsed >= run.patchMs + run.trainingMs + run.evaluatingMs) {
      run.resultEmitted = true;
      await finalizeSimulatedRun(runtime, workspace);
    }

    if (run.resultEmitted && elapsed >= run.patchMs + run.trainingMs + run.evaluatingMs + run.cooldownMs) {
      emit(runtime, {
        ts: new Date().toISOString(),
        type: "node.state",
        nodeId: workspace.nodeId,
        state: "available",
      });
      workspace.activeRun = undefined;
      workspace.nextStartAt = Date.now() + 1400 + Math.floor(Math.random() * 3200);
    }
  }
}

function startSimulatedRun(runtime: ControllerRuntime, workspace: ControllerWorkspace, now: number) {
  const nextIndex = workspace.nextExperimentIndex;
  workspace.nextExperimentIndex += 1;
  const baseMetric = workspace.bestMetric;
  const crashRoll = Math.random();
  let status: ExperimentResult = "discard";
  let targetMetric: number | undefined;
  let metricDelta: number | undefined;

  if (crashRoll < 0.08) {
    status = "crash";
  } else {
    const exploitBias = Math.max(0.00025, 0.0017 * Math.exp(-nextIndex / 18));
    const improveRoll = Math.random();
    if (improveRoll < 0.34) {
      status = "keep";
      targetMetric = Number((baseMetric - (0.0002 + Math.random() * exploitBias)).toFixed(6));
    } else {
      status = "discard";
      targetMetric = Number((baseMetric + (0.00005 + Math.random() * (exploitBias * 0.9))).toFixed(6));
    }
    metricDelta = Number((targetMetric - baseMetric).toFixed(6));
  }

  const run: ActiveRun = {
    experimentId: `exp-${workspace.slug}-${String(nextIndex).padStart(4, "0")}`,
    jobId: `job-${workspace.slug}-${String(nextIndex).padStart(4, "0")}`,
    description: experimentIdeas[nextIndex % experimentIdeas.length],
    commit: shortHash(`${workspace.slug}:${nextIndex}:${now}`),
    status,
    targetMetric,
    metricDelta,
    peakVramGb: Number((workspace.memGb * (0.42 + Math.random() * 0.22)).toFixed(1)),
    startedAt: now,
    patchMs: 600 + Math.floor(Math.random() * 800),
    trainingMs: Math.max(2400, runtime.config.simulationIterationMs - 2200),
    evaluatingMs: 900 + Math.floor(Math.random() * 800),
    cooldownMs: runtime.config.cooldownMs,
    progressMarkers: [0.12, 0.24, 0.38, 0.54, 0.72, 0.88],
    emittedProgressCount: 0,
    trainingStarted: false,
    evaluatingEmitted: false,
    resultEmitted: false,
  };

  workspace.activeRun = run;
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.state",
    workerId: workspace.workerId,
    state: "patching",
    progress: 0.03,
  });
}

async function finalizeSimulatedRun(runtime: ControllerRuntime, workspace: ControllerWorkspace) {
  const run = workspace.activeRun;
  if (!run) {
    return;
  }

  runtime.iterations += 1;

  if (run.status === "keep") {
    runtime.keeps += 1;
  } else if (run.status === "discard") {
    runtime.discards += 1;
  } else {
    runtime.crashes += 1;
  }

  const row: ResultRow = {
    commit: run.commit,
    valBpb: run.targetMetric,
    memoryGb: run.peakVramGb,
    status: run.status,
    description: run.description,
  };

  await writeSimulatedResult(workspace, row);

  if (run.status === "keep" && typeof run.targetMetric === "number") {
    workspace.bestMetric = run.targetMetric;
    workspace.previousMetric = run.targetMetric;
    workspace.noKeepStreak = 0;
  } else if (typeof run.targetMetric === "number") {
    workspace.previousMetric = run.targetMetric;
    workspace.noKeepStreak += 1;
  } else {
    workspace.noKeepStreak += 1;
  }

  if (run.status !== "crash") {
    emit(runtime, {
      ts: new Date().toISOString(),
      type: "job.state",
      jobId: run.jobId,
      state: "done",
    });
  }

  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.result",
    workerId: workspace.workerId,
    state: run.status,
    metric: run.targetMetric,
    metricDelta: run.metricDelta,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "experiment.result",
    experimentId: run.experimentId,
    workerId: workspace.workerId,
    result: run.status,
    metricDelta: run.metricDelta,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "node.state",
    nodeId: workspace.nodeId,
    state: "cooldown",
    jobId: run.jobId,
  });

  maybeStop(runtime);
}

function startWatchLoop(runtime: ControllerRuntime) {
  const timer = setInterval(async () => {
    try {
      await tickWatch(runtime);
    } catch (error) {
      console.error(`[controller] watch tick failed: ${toErrorMessage(error)}`);
    }
  }, runtime.config.tickMs);

  return timer;
}

async function tickWatch(runtime: ControllerRuntime) {
  if (shouldStop(runtime)) {
    return;
  }

  for (const workspace of runtime.workspaces) {
    const runLogFingerprint = await readFingerprint(workspace.runLogPath);
    if (
      runLogFingerprint &&
      runLogFingerprint !== workspace.lastKnownRunLogFingerprint &&
      !workspace.activeRun
    ) {
      workspace.lastKnownRunLogFingerprint = runLogFingerprint;
      startObservedRun(runtime, workspace);
    }

    const rows = await readResultRows(workspace.resultsPath);
    if (rows.length <= workspace.lastKnownResultCount) {
      continue;
    }

    const latestRow = rows.at(-1);
    workspace.lastKnownResultCount = rows.length;
    workspace.previousMetric = latestRow?.valBpb;
    if (latestRow?.status === "keep" && typeof latestRow.valBpb === "number") {
      workspace.bestMetric = Math.min(workspace.bestMetric, latestRow.valBpb);
      workspace.noKeepStreak = 0;
      runtime.keeps += 1;
    } else if (latestRow?.status === "discard") {
      workspace.noKeepStreak += 1;
      runtime.discards += 1;
    } else if (latestRow?.status === "crash") {
      workspace.noKeepStreak += 1;
      runtime.crashes += 1;
    }

    runtime.iterations += 1;
    finishObservedRun(runtime, workspace, latestRow);
    maybeStop(runtime);
  }
}

function startObservedRun(runtime: ControllerRuntime, workspace: ControllerWorkspace) {
  const experimentId = `exp-${workspace.slug}-${String(workspace.lastKnownResultCount + 1).padStart(4, "0")}`;
  const jobId = `job-${workspace.slug}-${String(workspace.lastKnownResultCount + 1).padStart(4, "0")}`;
  workspace.activeRun = {
    experimentId,
    jobId,
    description: "observed live autoresearch run",
    commit: experimentId,
    status: "discard",
    peakVramGb: 0,
    startedAt: Date.now(),
    patchMs: 0,
    trainingMs: 1,
    evaluatingMs: 1,
    cooldownMs: runtime.config.cooldownMs,
    progressMarkers: [],
    emittedProgressCount: 0,
    trainingStarted: true,
    evaluatingEmitted: false,
    resultEmitted: false,
  };

  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.state",
    workerId: workspace.workerId,
    state: "patching",
    progress: 0.04,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "job.created",
    job: {
      id: jobId,
      hubLat: runtime.manifest.defaultHub.lat,
      hubLng: runtime.manifest.defaultHub.lng,
      workerIds: [workspace.workerId],
      nodeIds: [workspace.nodeId],
      state: "queued",
    },
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "node.assigned",
    nodeId: workspace.nodeId,
    jobId,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "job.state",
    jobId,
    state: "training",
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.state",
    workerId: workspace.workerId,
    state: "training",
    progress: 0.28,
  });
}

function finishObservedRun(runtime: ControllerRuntime, workspace: ControllerWorkspace, latestRow?: ResultRow) {
  const run = workspace.activeRun ?? {
    experimentId: `exp-${workspace.slug}-${String(workspace.lastKnownResultCount).padStart(4, "0")}`,
    jobId: `job-${workspace.slug}-${String(workspace.lastKnownResultCount).padStart(4, "0")}`,
  };
  const status = latestRow?.status ?? "discard";

  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.state",
    workerId: workspace.workerId,
    state: "evaluating",
    progress: 0.94,
    metric: latestRow?.valBpb,
    metricDelta:
      typeof latestRow?.valBpb === "number" && typeof workspace.bestMetric === "number"
        ? Number((latestRow.valBpb - workspace.bestMetric).toFixed(6))
        : undefined,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "job.state",
    jobId: run.jobId,
    state: status === "crash" ? "training" : "done",
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "worker.result",
    workerId: workspace.workerId,
    state: status,
    metric: latestRow?.valBpb,
    metricDelta:
      typeof latestRow?.valBpb === "number" && typeof workspace.bestMetric === "number"
        ? Number((latestRow.valBpb - workspace.bestMetric).toFixed(6))
        : undefined,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "experiment.result",
    experimentId: run.experimentId,
    workerId: workspace.workerId,
    result: status,
    metricDelta:
      typeof latestRow?.valBpb === "number" && typeof workspace.bestMetric === "number"
        ? Number((latestRow.valBpb - workspace.bestMetric).toFixed(6))
        : undefined,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "node.state",
    nodeId: workspace.nodeId,
    state: "cooldown",
    jobId: run.jobId,
  });
  emit(runtime, {
    ts: new Date().toISOString(),
    type: "node.state",
    nodeId: workspace.nodeId,
    state: "available",
  });

  workspace.activeRun = undefined;
}

async function writeRunLogHeader(runLogPath: string, run: ActiveRun) {
  const header = [
    `# autoresearch loop simulation`,
    `# experiment_id=${run.experimentId}`,
    `# description=${run.description}`,
    ``,
  ].join("\n");
  await writeFile(runLogPath, header, "utf8");
}

async function appendTrainingStep(runLogPath: string, run: ActiveRun, progress: number) {
  const step = Math.max(1, Math.round(progress * 100));
  await appendFile(runLogPath, `step ${step} | train_loss=${(1.6 - progress * 0.4).toFixed(4)}\n`, "utf8");
}

async function writeSimulatedResult(workspace: ControllerWorkspace, row: ResultRow) {
  const run = workspace.activeRun;
  if (!run) {
    return;
  }

  const summaryLines = run.status === "crash"
    ? [
        "FAIL RuntimeError: simulated kernel launch failure",
        `peak_vram_mb:      ${Math.round(run.peakVramGb * 1024)}`,
        `num_steps:         0`,
      ]
    : [
        `training_seconds:  ${(run.trainingMs / 1000).toFixed(3)}`,
        `total_seconds:     ${((run.patchMs + run.trainingMs + run.evaluatingMs) / 1000).toFixed(3)}`,
        `peak_vram_mb:      ${Math.round(run.peakVramGb * 1024)}`,
        `num_steps:         ${Math.max(48, Math.round(run.trainingMs / 140))}`,
        `val_bpb:           ${(row.valBpb ?? 0).toFixed(6)}`,
      ];

  await appendFile(workspace.runLogPath, `${summaryLines.join("\n")}\n`, "utf8");
  const tsvLine = [
    row.commit,
    typeof row.valBpb === "number" ? row.valBpb.toFixed(6) : "0.000000",
    typeof row.memoryGb === "number" ? row.memoryGb.toFixed(1) : "0.0",
    row.status ?? run.status,
    row.description,
  ].join("\t");
  await appendFile(workspace.resultsPath, `${tsvLine}\n`, "utf8");
  workspace.lastKnownResultCount += 1;
  workspace.lastKnownRunLogFingerprint = await readFingerprint(workspace.runLogPath);
}

function shouldStop(runtime: ControllerRuntime): boolean {
  if (runtime.stopReason) {
    return true;
  }

  const { maxRuntimeMs } = runtime.config;
  if (typeof maxRuntimeMs === "number" && Date.now() - runtime.startedAt >= maxRuntimeMs) {
    runtime.stopReason = "time budget reached";
    return true;
  }

  return false;
}

function maybeStop(runtime: ControllerRuntime) {
  if (runtime.stopReason) {
    return;
  }

  if (runtime.iterations >= runtime.config.maxIterations) {
    runtime.stopReason = "max iterations reached";
    return;
  }

  const globalNoKeepStreak = runtime.workspaces.reduce((maxStreak, workspace) => {
    return Math.max(maxStreak, workspace.noKeepStreak);
  }, 0);
  if (globalNoKeepStreak >= runtime.config.maxNoKeep) {
    runtime.stopReason = "max no-keep streak reached";
    return;
  }

  if (typeof runtime.config.targetValBpb === "number") {
    const bestMetric = runtime.workspaces.reduce((best, workspace) => {
      return Math.min(best, workspace.bestMetric);
    }, Number.POSITIVE_INFINITY);
    if (bestMetric <= runtime.config.targetValBpb) {
      runtime.stopReason = `target val_bpb reached (${bestMetric.toFixed(6)})`;
    }
  }
}

function selectRegionPresets(count: number): RegionPreset[] {
  const presets: RegionPreset[] = [];

  for (let index = 0; index < count; index += 1) {
    const base = regionPresets[index % regionPresets.length];
    if (index < regionPresets.length) {
      presets.push(base);
      continue;
    }

    const shard = Math.floor(index / regionPresets.length) + 1;
    presets.push({
      ...base,
      slug: `${base.slug}-${shard}`,
      region: `${base.region} ${shard}`,
    });
  }

  return presets;
}

function deriveHub(presets: RegionPreset[]) {
  const lat = presets.reduce((sum, preset) => sum + preset.lat, 0) / presets.length;
  const lng = presets.reduce((sum, preset) => sum + preset.lng, 0) / presets.length;
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
  };
}

function seededMetric(seed: number): number {
  return Number((1.004 + seed * 0.0017 + Math.random() * 0.0012).toFixed(6));
}

function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 7);
}

async function readResultRows(resultsPath: string): Promise<ResultRow[]> {
  const text = await readFile(resultsPath, "utf8").catch(() => resultsHeader);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("commit\t"))
    .map((line) => {
      const [commit, valBpbText, memoryGbText, statusText, ...descriptionParts] = line.split("\t");
      return {
        commit,
        valBpb: parseOptionalNumber(valBpbText),
        memoryGb: parseOptionalNumber(memoryGbText),
        status: normalizeStatus(statusText),
        description: descriptionParts.join(" ").trim(),
      };
    });
}

function normalizeStatus(value: string | undefined): ExperimentResult | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "keep" || normalized === "discard" || normalized === "crash") {
    return normalized;
  }
  return undefined;
}

async function ensureResultsHeader(resultsPath: string) {
  if (await pathExists(resultsPath)) {
    return;
  }
  await writeFile(resultsPath, resultsHeader, "utf8");
}

async function readFingerprint(filePath: string): Promise<string | undefined> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return undefined;
    }
    return `${fileStat.size}:${fileStat.mtimeMs}`;
  } catch {
    return undefined;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveInputPath(inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
}

function parseOptionalNumber(value: string | undefined, multiplier = 1): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * multiplier : undefined;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const config = parseConfig();
  const runtime = await setupRuntime(config);
  const server = createServerRuntime(runtime);

  const timer = config.mode === "simulate"
    ? startSimulationLoop(runtime)
    : startWatchLoop(runtime);

  server.listen(config.port, () => {
    console.log(`[controller] mode=${config.mode}`);
    console.log(`[controller] manifest=${config.manifestPath}`);
    console.log(`[controller] workspaces=${config.workspaceRoot}`);
    console.log(`[controller] SSE=http://localhost:${config.port}/events`);
    console.log(`[controller] health=http://localhost:${config.port}/healthz`);
  });

  const shutdown = () => {
    clearInterval(timer);
    server.close();
    for (const client of runtime.clients.values()) {
      if (!client.response.writableEnded) {
        client.response.end();
      }
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (isMain()) {
  await main();
}

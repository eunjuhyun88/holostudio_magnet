import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ExperimentResult, TelemetryEvent } from "../src-svelte/lib/utils/types.ts";

type Coordinate = {
  lat: number;
  lng: number;
};

type ManifestWorkspace = {
  workspace: string;
  nodeId?: string;
  workerId?: string;
  jobId?: string;
  experimentId?: string;
  region?: string;
  lat?: number;
  lng?: number;
  cpu?: number;
  gpu?: number;
  memGb?: number;
  gpuLabel?: string;
};

type AutoresearchManifest = {
  defaultHub?: Coordinate;
  defaults?: {
    cpu?: number;
    gpu?: number;
    memGb?: number;
  };
  workspaces?: ManifestWorkspace[];
};

type ParsedArgs = Map<string, string[]>;

type ConvertAutoresearchOptions = {
  workspaceRoot?: string;
  workspaces?: string[];
  manifestPath?: string;
  baseTs?: string;
  workspaceSpacingMs?: number;
};

type ParsedResultRow = {
  commit?: string;
  valBpb?: number;
  memoryGb?: number;
  status?: ExperimentResult;
  description?: string;
};

type ParsedRunLog = {
  stepNumbers: number[];
  valBpb?: number;
  trainingSeconds?: number;
  totalSeconds?: number;
  peakVramGb?: number;
  numSteps?: number;
  crashed: boolean;
};

type WorkspaceDescriptor = {
  workspaceDir: string;
  workspaceName: string;
  nodeId: string;
  workerId: string;
  jobId: string;
  experimentId: string;
  region: string;
  gpuLabel: string;
  lat: number;
  lng: number;
  cpu: number;
  gpu: number;
  memGb: number;
  metric?: number;
  metricDelta?: number;
  status: ExperimentResult;
  progressPoints: number[];
  vramGb?: number;
};

const DEFAULT_BASE_TS = "2026-03-13T01:00:00.000Z";
const DEFAULT_WORKSPACE_SPACING_MS = 220;

export function parseCliArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string[]>();

  for (const rawArg of argv) {
    if (!rawArg.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = rawArg.slice(2).split("=", 2);
    const key = rawKey.trim();
    const value = (rawValue ?? "true").trim();
    const values = args.get(key) ?? [];
    values.push(value);
    args.set(key, values);
  }

  return args;
}

export async function convertAutoresearchToTelemetry(
  options: ConvertAutoresearchOptions,
): Promise<TelemetryEvent[]> {
  const manifest = options.manifestPath
    ? await loadManifest(options.manifestPath)
    : { defaultHub: undefined, defaults: undefined, workspaces: [] };
  const workspaceDirs = await resolveWorkspaceDirs({
    workspaceRoot: options.workspaceRoot,
    workspaces: options.workspaces,
    manifestPath: options.manifestPath,
    manifest,
  });

  if (workspaceDirs.length === 0) {
    throw new Error("No autoresearch workspaces found. Provide --workspace-root or --workspace.");
  }

  const descriptors = await Promise.all(
    workspaceDirs.map(async (workspaceDir, index) => {
      return describeWorkspace({
        workspaceDir,
        index,
        manifest,
        manifestPath: options.manifestPath,
      });
    }),
  );

  const hub =
    manifest.defaultHub ??
    deriveDefaultHub(descriptors.map((descriptor) => ({ lat: descriptor.lat, lng: descriptor.lng })));
  const baseTs = new Date(options.baseTs ?? DEFAULT_BASE_TS);
  const workspaceSpacingMs = options.workspaceSpacingMs ?? DEFAULT_WORKSPACE_SPACING_MS;
  const events = descriptors.flatMap((descriptor, index) => {
    const startTs = new Date(baseTs.getTime() + index * workspaceSpacingMs);
    return buildWorkspaceEvents({
      descriptor,
      startTs,
      hub,
    });
  });

  return events.sort((left, right) => left.ts.localeCompare(right.ts));
}

function getFirstArg(args: ParsedArgs, key: string): string | undefined {
  return args.get(key)?.[0];
}

function normalizeExperimentStatus(value: string | undefined): ExperimentResult | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "keep" || normalized === "discard" || normalized === "crash") {
    return normalized;
  }

  return undefined;
}

async function loadManifest(manifestPath: string): Promise<AutoresearchManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as AutoresearchManifest;
  return {
    defaultHub: parsed.defaultHub,
    defaults: parsed.defaults,
    workspaces: parsed.workspaces ?? [],
  };
}

async function resolveWorkspaceDirs({
  workspaceRoot,
  workspaces,
  manifestPath,
  manifest,
}: {
  workspaceRoot?: string;
  workspaces?: string[];
  manifestPath?: string;
  manifest: AutoresearchManifest;
}): Promise<string[]> {
  const resolvedWorkspaces = new Set<string>();

  if (workspaceRoot) {
    for (const workspace of await scanWorkspaceRoot(workspaceRoot)) {
      resolvedWorkspaces.add(workspace);
    }
  }

  if (workspaces) {
    for (const workspace of workspaces) {
      resolvedWorkspaces.add(resolveInputPath(process.cwd(), workspace));
    }
  }

  const manifestDir = manifestPath ? dirname(manifestPath) : process.cwd();
  for (const workspace of manifest.workspaces ?? []) {
    resolvedWorkspaces.add(resolveInputPath(manifestDir, workspace.workspace));
  }

  return Array.from(resolvedWorkspaces).sort();
}

async function scanWorkspaceRoot(workspaceRoot: string): Promise<string[]> {
  const absoluteRoot = resolveInputPath(process.cwd(), workspaceRoot);
  const candidates: string[] = [];

  if (await hasRunLog(absoluteRoot)) {
    candidates.push(absoluteRoot);
  }

  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = resolve(absoluteRoot, entry.name);
    if (await hasRunLog(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function hasRunLog(workspaceDir: string): Promise<boolean> {
  try {
    const file = await stat(resolve(workspaceDir, "run.log"));
    return file.isFile();
  } catch {
    return false;
  }
}

async function describeWorkspace({
  workspaceDir,
  index,
  manifest,
  manifestPath,
}: {
  workspaceDir: string;
  index: number;
  manifest: AutoresearchManifest;
  manifestPath?: string;
}): Promise<WorkspaceDescriptor> {
  const manifestEntry = matchManifestWorkspace({
    workspaceDir,
    manifest,
    manifestPath,
  });
  const workspaceName = basename(workspaceDir);
  const workspaceSlug = slugify(workspaceName);
  const runLogPath = resolve(workspaceDir, "run.log");
  const resultsPath = resolve(workspaceDir, "results.tsv");

  const [runLogText, resultsText] = await Promise.all([
    readFile(runLogPath, "utf8"),
    readTextIfPresent(resultsPath),
  ]);
  const runLog = parseRunLog(runLogText);
  const resultRows = parseResultsTsv(resultsText);
  const latestResult = resultRows.at(-1);
  const previousMetric = findPreviousMetric(resultRows);
  const metric = latestResult?.valBpb ?? runLog.valBpb;
  const metricDelta =
    typeof metric === "number" && typeof previousMetric === "number"
      ? metric - previousMetric
      : undefined;
  const status = inferStatus({
    latestResult,
    metric,
    previousMetric,
    crashed: runLog.crashed,
  });
  const defaults = manifest.defaults ?? {};
  const fallbackCoordinates = deriveFallbackCoordinates(workspaceSlug, index);

  return {
    workspaceDir,
    workspaceName,
    nodeId: manifestEntry?.nodeId ?? `node-${workspaceSlug}`,
    workerId: manifestEntry?.workerId ?? `worker-${workspaceSlug}`,
    jobId: manifestEntry?.jobId ?? `job-${workspaceSlug}`,
    experimentId:
      manifestEntry?.experimentId ??
      (latestResult?.commit ? `exp-${latestResult.commit}` : `exp-${workspaceSlug}`),
    region: manifestEntry?.region ?? titleFromSlug(workspaceName),
    gpuLabel: manifestEntry?.gpuLabel ?? titleFromSlug(workspaceName),
    lat: manifestEntry?.lat ?? fallbackCoordinates.lat,
    lng: manifestEntry?.lng ?? fallbackCoordinates.lng,
    cpu: manifestEntry?.cpu ?? defaults.cpu ?? 16,
    gpu: manifestEntry?.gpu ?? defaults.gpu ?? 1,
    memGb:
      manifestEntry?.memGb ??
      latestResult?.memoryGb ??
      defaults.memGb ??
      Math.max(16, Math.round((runLog.peakVramGb ?? 0) * 1.8)),
    metric,
    metricDelta,
    status,
    progressPoints: buildProgressPoints(runLog),
    vramGb: latestResult?.memoryGb ?? runLog.peakVramGb,
  };
}

function matchManifestWorkspace({
  workspaceDir,
  manifest,
  manifestPath,
}: {
  workspaceDir: string;
  manifest: AutoresearchManifest;
  manifestPath?: string;
}): ManifestWorkspace | undefined {
  const manifestDir = manifestPath ? dirname(manifestPath) : process.cwd();

  return manifest.workspaces?.find((entry) => {
    const resolvedWorkspace = resolveInputPath(manifestDir, entry.workspace);
    return resolvedWorkspace === workspaceDir || basename(resolvedWorkspace) === basename(workspaceDir);
  });
}

function parseRunLog(text: string): ParsedRunLog {
  const stepNumbers = Array.from(text.matchAll(/^step\s+(\d+)/gm))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  return {
    stepNumbers,
    valBpb: parseNumericSummary(text, "val_bpb"),
    trainingSeconds: parseNumericSummary(text, "training_seconds"),
    totalSeconds: parseNumericSummary(text, "total_seconds"),
    peakVramGb: toOptionalFixed(parseNumericSummary(text, "peak_vram_mb"), 1024),
    numSteps: parseNumericSummary(text, "num_steps"),
    crashed: /\bFAIL\b/m.test(text),
  };
}

function parseNumericSummary(text: string, label: string): number | undefined {
  const match = text.match(new RegExp(`^${label}:\\s*([+-]?\\d+(?:\\.\\d+)?)$`, "m"));
  return match ? Number(match[1]) : undefined;
}

function parseResultsTsv(text: string | null): ParsedResultRow[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("commit\t"))
    .map((line) => {
      const columns = line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);
      const [commit, valBpbText, memoryGbText, statusText, ...descriptionParts] = columns;

      return {
        commit: commit || undefined,
        valBpb: parseOptionalNumber(valBpbText),
        memoryGb: parseOptionalNumber(memoryGbText),
        status: normalizeExperimentStatus(statusText),
        description: descriptionParts.join(" ").trim() || undefined,
      } satisfies ParsedResultRow;
    });
}

function findPreviousMetric(rows: ParsedResultRow[]): number | undefined {
  for (let index = rows.length - 2; index >= 0; index -= 1) {
    const candidate = rows[index];
    if (typeof candidate.valBpb === "number") {
      return candidate.valBpb;
    }
  }

  return undefined;
}

function inferStatus({
  latestResult,
  metric,
  previousMetric,
  crashed,
}: {
  latestResult?: ParsedResultRow;
  metric?: number;
  previousMetric?: number;
  crashed: boolean;
}): ExperimentResult {
  if (latestResult?.status) {
    return latestResult.status;
  }

  if (crashed) {
    return "crash";
  }

  if (typeof metric === "number") {
    if (typeof previousMetric !== "number" || metric < previousMetric) {
      return "keep";
    }

    return "discard";
  }

  return "crash";
}

function buildProgressPoints(runLog: ParsedRunLog): number[] {
  const maxStep =
    runLog.numSteps ??
    runLog.stepNumbers.at(-1) ??
    100;

  if (!Number.isFinite(maxStep) || maxStep <= 0) {
    return [0.14, 0.32, 0.51, 0.76];
  }

  const rawPoints = runLog.stepNumbers
    .map((stepNumber) => stepNumber / maxStep)
    .filter((point) => point > 0 && point < 1)
    .map((point) => clamp(point, 0.06, 0.88));

  if (rawPoints.length === 0) {
    return [0.14, 0.32, 0.51, 0.76];
  }

  return sampleProgresses(rawPoints, 6);
}

function sampleProgresses(points: number[], limit: number): number[] {
  if (points.length <= limit) {
    return dedupeProgresses(points);
  }

  const sampled: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index / (limit - 1)) * (points.length - 1));
    sampled.push(points[sourceIndex]);
  }

  return dedupeProgresses(sampled);
}

function dedupeProgresses(points: number[]): number[] {
  const deduped: number[] = [];

  for (const point of points) {
    if (deduped.length === 0 || Math.abs(point - deduped[deduped.length - 1]) > 0.025) {
      deduped.push(point);
    }
  }

  return deduped;
}

function buildWorkspaceEvents({
  descriptor,
  startTs,
  hub,
}: {
  descriptor: WorkspaceDescriptor;
  startTs: Date;
  hub: Coordinate;
}): TelemetryEvent[] {
  const timeline = descriptor.status === "crash"
    ? {
        started: 280,
        jobCreated: 440,
        assigned: 620,
        jobTraining: 760,
        trainingStart: 980,
        trainingEnd: 4700,
        result: 5600,
        experimentResult: 5720,
        nodeCooldown: 5880,
      }
    : {
        started: 280,
        jobCreated: 440,
        assigned: 620,
        jobTraining: 760,
        trainingStart: 980,
        trainingEnd: 4900,
        evaluating: 5250,
        jobEvaluating: 5400,
        jobDone: 5800,
        result: 5960,
        experimentResult: 6100,
        nodeCooldown: 6260,
      };
  const events: TelemetryEvent[] = [
    {
      ts: offsetTimestamp(startTs, 0),
      type: "node.online",
      node: {
        id: descriptor.nodeId,
        lat: descriptor.lat,
        lng: descriptor.lng,
        cpu: descriptor.cpu,
        gpu: descriptor.gpu,
        memGb: descriptor.memGb,
      },
    },
    {
      ts: offsetTimestamp(startTs, 140),
      type: "node.available",
      nodeId: descriptor.nodeId,
    },
    {
      ts: offsetTimestamp(startTs, timeline.started),
      type: "worker.started",
      worker: {
        id: descriptor.workerId,
        gpuLabel: descriptor.gpuLabel,
        region: descriptor.region,
        nodeId: descriptor.nodeId,
        experimentId: descriptor.experimentId,
        state: "patching",
        progress: 0.04,
        vramGb: descriptor.vramGb,
      },
    },
    {
      ts: offsetTimestamp(startTs, timeline.jobCreated),
      type: "job.created",
      job: {
        id: descriptor.jobId,
        hubLat: hub.lat,
        hubLng: hub.lng,
        workerIds: [descriptor.workerId],
        nodeIds: [descriptor.nodeId],
        state: "queued",
      },
    },
    {
      ts: offsetTimestamp(startTs, timeline.assigned),
      type: "node.assigned",
      nodeId: descriptor.nodeId,
      jobId: descriptor.jobId,
    },
    {
      ts: offsetTimestamp(startTs, timeline.jobTraining),
      type: "job.state",
      jobId: descriptor.jobId,
      state: "training",
    },
  ];

  const trainingWindow = Math.max(1200, timeline.trainingEnd - timeline.trainingStart);
  descriptor.progressPoints.forEach((progress, index) => {
    const ratio =
      descriptor.progressPoints.length === 1
        ? 0
        : index / (descriptor.progressPoints.length - 1);
    const eventOffset = timeline.trainingStart + ratio * trainingWindow;
    events.push({
      ts: offsetTimestamp(startTs, eventOffset),
      type: "worker.state",
      workerId: descriptor.workerId,
      state: "training",
      progress,
    });
  });

  if (descriptor.status !== "crash") {
    events.push(
      {
        ts: offsetTimestamp(startTs, timeline.evaluating),
        type: "worker.state",
        workerId: descriptor.workerId,
        state: "evaluating",
        progress: 0.93,
        metric: descriptor.metric,
        metricDelta: descriptor.metricDelta,
      },
      {
        ts: offsetTimestamp(startTs, timeline.jobEvaluating),
        type: "job.state",
        jobId: descriptor.jobId,
        state: "evaluating",
      },
      {
        ts: offsetTimestamp(startTs, timeline.jobDone),
        type: "job.state",
        jobId: descriptor.jobId,
        state: "done",
      },
    );
  }

  events.push(
    {
      ts: offsetTimestamp(startTs, timeline.result),
      type: "worker.result",
      workerId: descriptor.workerId,
      state: descriptor.status,
      metric: descriptor.metric,
      metricDelta: descriptor.metricDelta,
    },
    {
      ts: offsetTimestamp(startTs, timeline.experimentResult),
      type: "experiment.result",
      experimentId: descriptor.experimentId,
      workerId: descriptor.workerId,
      result: descriptor.status,
      metricDelta: descriptor.metricDelta,
    },
    {
      ts: offsetTimestamp(startTs, timeline.nodeCooldown),
      type: "node.state",
      nodeId: descriptor.nodeId,
      state: "cooldown",
      jobId: descriptor.jobId,
    },
  );

  return events;
}

function deriveDefaultHub(coordinates: Coordinate[]): Coordinate {
  if (coordinates.length === 0) {
    return { lat: 35.6762, lng: 139.6503 };
  }

  const lat = coordinates.reduce((sum, coordinate) => sum + coordinate.lat, 0) / coordinates.length;
  const lng = coordinates.reduce((sum, coordinate) => sum + coordinate.lng, 0) / coordinates.length;
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
  };
}

function deriveFallbackCoordinates(workspaceSlug: string, index: number): Coordinate {
  const seed = hashString(`${workspaceSlug}:${index}`);
  const lat = ((seed % 12000) / 100) - 60;
  const lng = (((seed * 17) % 36000) / 100) - 180;
  return {
    lat: Number(clamp(lat, -58, 58).toFixed(4)),
    lng: Number(lng.toFixed(4)),
  };
}

function hashString(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function titleFromSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized === "" || normalized === "-" || normalized.toLowerCase() === "n/a") {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalFixed(value: number | undefined, divisor: number): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  return Number((value / divisor).toFixed(1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function offsetTimestamp(base: Date, offsetMs: number): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

async function readTextIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function resolveInputPath(baseDir: string, inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
}

function formatTelemetryNdjson(events: TelemetryEvent[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n");
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const workspaceRoot = getFirstArg(args, "workspace-root");
  const workspaces = args.get("workspace");
  const manifestPath = getFirstArg(args, "manifest");
  const outputPath = getFirstArg(args, "output");
  const baseTs = getFirstArg(args, "base-ts");
  const workspaceSpacingMs = parseOptionalNumber(getFirstArg(args, "workspace-spacing-ms"));
  const events = await convertAutoresearchToTelemetry({
    workspaceRoot,
    workspaces,
    manifestPath,
    baseTs,
    workspaceSpacingMs,
  });
  const ndjson = formatTelemetryNdjson(events);

  if (outputPath) {
    await writeFile(resolveInputPath(process.cwd(), outputPath), `${ndjson}\n`, "utf8");
    console.error(`Wrote ${events.length} events to ${resolveInputPath(process.cwd(), outputPath)}`);
    return;
  }

  process.stdout.write(`${ndjson}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

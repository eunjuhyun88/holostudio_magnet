import type { EvalCheck } from "./checks.ts";
import type { TelemetryEvent, VisualizerModel } from "../src/fixed/types.ts";

export type EvalMetrics = {
  buildPass: number;
  workerAccuracy: number;
  nodeAccuracy: number;
  arcAccuracy: number;
  visualMatch: number;
  perfScore: number;
  overlapPenalty: number;
  sceneScore: number;
};

type DeriveMetricsInput = {
  checks: EvalCheck[];
  visualizerText: string;
  events: TelemetryEvent[];
  model: VisualizerModel;
};

export function deriveMetrics(input: DeriveMetricsInput): EvalMetrics {
  const criticalChecks = input.checks.filter((check) => check.critical);
  const buildPass =
    criticalChecks.length > 0 && criticalChecks.every((check) => check.ok) ? 1 : 0;

  const expectedWorkerIds = collectIds(input.events, "worker");
  const expectedNodeIds = collectIds(input.events, "node");

  const actualWorkerIds = new Set(input.model.workers.map((worker) => worker.id));
  const actualNodeIds = new Set(input.model.nodes.map((node) => node.id));

  const workerAccuracy = coverageRatio(expectedWorkerIds, actualWorkerIds);
  const nodeAccuracy = coverageRatio(expectedNodeIds, actualNodeIds);

  const validJobs = input.model.jobs.filter((job) => {
    const workerCoverage = job.workerIds.every((workerId) => actualWorkerIds.has(workerId));
    const nodeCoverage = job.nodeIds.every((nodeId) => actualNodeIds.has(nodeId));
    return workerCoverage && nodeCoverage && job.workerIds.length > 0 && job.nodeIds.length > 0;
  });

  const arcAccuracy =
    input.model.jobs.length === 0 ? 0 : validJobs.length / input.model.jobs.length;

  const visualMatch = deriveVisualMatch(input.visualizerText);
  const perfScore = derivePerfScore(input.model);
  const overlapPenalty = deriveOverlapPenalty(input.model);

  const rawScore =
    30 * buildPass +
    15 * workerAccuracy +
    20 * nodeAccuracy +
    20 * arcAccuracy +
    10 * visualMatch +
    10 * perfScore -
    5 * overlapPenalty;

  return {
    buildPass,
    workerAccuracy,
    nodeAccuracy,
    arcAccuracy,
    visualMatch,
    perfScore,
    overlapPenalty,
    sceneScore: roundMetric(Math.max(0, Math.min(100, rawScore))),
  };
}

function collectIds(events: TelemetryEvent[], kind: "worker" | "node"): Set<string> {
  const ids = new Set<string>();

  for (const event of events) {
    if (kind === "worker") {
      if (event.type === "worker.started") {
        ids.add(event.worker.id);
      }
      if (event.type === "worker.state" || event.type === "worker.result") {
        ids.add(event.workerId);
      }
    }

    if (kind === "node") {
      if (event.type === "node.online") {
        ids.add(event.node.id);
      }
      if (
        event.type === "node.available" ||
        event.type === "node.assigned" ||
        event.type === "node.state"
      ) {
        ids.add(event.nodeId);
      }
    }
  }

  return ids;
}

function coverageRatio(expected: Set<string>, actual: Set<string>): number {
  if (expected.size === 0) {
    return 0;
  }

  let covered = 0;

  for (const id of expected) {
    if (actual.has(id)) {
      covered += 1;
    }
  }

  return roundMetric(covered / expected.size);
}

function deriveVisualMatch(visualizerText: string): number {
  let score = 0;

  if (visualizerText.includes("Research Swarm")) {
    score += 0.2;
  }
  if (visualizerText.includes("Global Compute Mesh")) {
    score += 0.2;
  }
  if (visualizerText.includes("Experiment Tape")) {
    score += 0.2;
  }
  if (visualizerText.includes("radial-gradient")) {
    score += 0.2;
  }
  if (visualizerText.includes("selectedWorkerId")) {
    score += 0.2;
  }

  return roundMetric(score);
}

function derivePerfScore(model: VisualizerModel): number {
  const activeJobs = model.jobs.filter((job) => job.state !== "done").length;
  const workerLoadPenalty = Math.max(0, model.workers.length - 24) / 24;
  const activeJobPenalty = Math.max(0, activeJobs - 12) / 12;
  const score = 1 - workerLoadPenalty - activeJobPenalty;
  return roundMetric(Math.max(0, Math.min(1, score)));
}

function deriveOverlapPenalty(model: VisualizerModel): number {
  const activeJobs = model.jobs.filter((job) => job.state === "training" || job.state === "evaluating")
    .length;
  const nodeCount = model.nodes.length;

  const arcPenalty = Math.max(0, activeJobs - 8) / 8;
  const nodePenalty = Math.max(0, nodeCount - 18) / 18;

  return roundMetric(Math.max(0, arcPenalty + nodePenalty));
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}

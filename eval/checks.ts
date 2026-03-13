import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import type { TelemetryEvent, VisualizerModel } from "../src/fixed/types.ts";

export type EvalCheck = {
  id: string;
  ok: boolean;
  detail: string;
  critical?: boolean;
};

type RunChecksInput = {
  rootDir: string;
  specText: string;
  programText: string;
  visualizerText: string;
  events: TelemetryEvent[];
  model: VisualizerModel;
};

export async function checkRequiredFiles(rootDir: string): Promise<EvalCheck[]> {
  const paths = [
    "spec.md",
    "program.md",
    "fixtures/events.ndjson",
    "src/Visualizer.tsx",
    "src/fixed/types.ts",
    "src/fixed/telemetry.ts",
    "src/fixed/fixturePlayer.ts",
    "eval/checks.ts",
    "eval/score.ts",
    "eval/run_eval.ts",
    "results.tsv",
  ];

  const checks = await Promise.all(
    paths.map(async (relativePath) => {
      const absolutePath = resolve(rootDir, relativePath);

      try {
        await access(absolutePath, constants.F_OK);
        return {
          id: `file:${relativePath}`,
          ok: true,
          detail: "present",
          critical: true,
        } satisfies EvalCheck;
      } catch {
        return {
          id: `file:${relativePath}`,
          ok: false,
          detail: "missing",
          critical: true,
        } satisfies EvalCheck;
      }
    }),
  );

  return checks;
}

export function runStructuralChecks(input: RunChecksInput): EvalCheck[] {
  const eventResults = new Set(
    input.events
      .filter((event): event is Extract<TelemetryEvent, { type: "experiment.result" }> => {
        return event.type === "experiment.result";
      })
      .map((event) => event.result),
  );

  const workerIds = new Set(input.model.workers.map((worker) => worker.id));
  const nodeIds = new Set(input.model.nodes.map((node) => node.id));
  const jobIds = new Set(input.model.jobs.map((job) => job.id));

  const workerNodeLinksValid = input.model.workers.every((worker) => nodeIds.has(worker.nodeId));
  const jobRefsValid = input.model.jobs.every((job) => {
    const nodesExist = job.nodeIds.every((nodeId) => nodeIds.has(nodeId));
    const workersExist = job.workerIds.every((workerId) => workerIds.has(workerId));
    return nodesExist && workersExist;
  });

  return [
    {
      id: "visualizer.fixed-imports",
      ok: input.visualizerText.includes('from "./fixed/'),
      detail: "Visualizer should read from fixed read-only helpers.",
      critical: true,
    },
    {
      id: "visualizer.dual-panel",
      ok:
        input.visualizerText.includes("Research Swarm") &&
        input.visualizerText.includes("Global Compute Mesh"),
      detail: "Visualizer should render the left swarm and right globe panels.",
      critical: true,
    },
    {
      id: "visualizer.tape",
      ok: input.visualizerText.includes("Experiment Tape"),
      detail: "Visualizer should render the bottom experiment tape.",
      critical: true,
    },
    {
      id: "visualizer.selection-sync",
      ok: input.visualizerText.includes("selectedWorkerId"),
      detail: "Visualizer should maintain cross-panel selection state.",
    },
    {
      id: "visualizer.globe-scene",
      ok:
        input.visualizerText.includes('import * as THREE from "three"') &&
        input.visualizerText.includes("function GlobeCanvas"),
      detail: "Visualizer should include the real globe scene component.",
      critical: true,
    },
    {
      id: "visualizer.fixture-playback",
      ok:
        input.visualizerText.includes("createFixturePlayback") &&
        input.visualizerText.includes("setFrameIndex"),
      detail: "Visualizer should replay fixture telemetry over time.",
    },
    {
      id: "program.edit-scope-lock",
      ok:
        input.programText.includes("Only edit:") &&
        input.programText.includes("src/Visualizer.tsx"),
      detail: "program.md should lock editing to the single visualizer file.",
      critical: true,
    },
    {
      id: "program.phase-order",
      ok:
        input.programText.includes("Phase 1: worker-board") &&
        input.programText.includes("Phase 5: perf-polish"),
      detail: "program.md should define the execution phases.",
    },
    {
      id: "spec.truth-rules",
      ok: input.specText.includes("Truth Rules") && input.specText.includes("telemetry truth"),
      detail: "spec.md should prioritize telemetry truth.",
      critical: true,
    },
    {
      id: "fixture.has-results",
      ok:
        eventResults.has("keep") &&
        eventResults.has("discard") &&
        eventResults.has("crash"),
      detail: "Fixture stream should include keep, discard, and crash outcomes.",
      critical: true,
    },
    {
      id: "model.has-entities",
      ok:
        input.model.workers.length > 0 &&
        input.model.nodes.length > 0 &&
        input.model.jobs.length > 0 &&
        input.model.tape.length > 0,
      detail: "Fixture playback should produce workers, nodes, jobs, and tape entries.",
      critical: true,
    },
    {
      id: "model.worker-node-links",
      ok: workerNodeLinksValid,
      detail: "Every worker should point at a known node.",
      critical: true,
    },
    {
      id: "model.job-references",
      ok: jobRefsValid && input.model.jobs.every((job) => jobIds.has(job.id)),
      detail: "Every job should reference known workers and nodes.",
      critical: true,
    },
  ];
}

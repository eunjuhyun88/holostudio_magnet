import { appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildModelFromFixtureText, parseNdjson } from "../src/fixed/fixturePlayer.ts";
import { checkRequiredFiles, runStructuralChecks } from "./checks.ts";
import { deriveMetrics } from "./score.ts";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const specPath = resolve(rootDir, "spec.md");
  const programPath = resolve(rootDir, "program.md");
  const visualizerPath = resolve(rootDir, "src/Visualizer.tsx");
  const fixturePath = resolve(rootDir, "fixtures/events.ndjson");
  const resultsPath = resolve(rootDir, "results.tsv");

  const [specText, programText, visualizerText, fixtureText] = await Promise.all([
    readFile(specPath, "utf8"),
    readFile(programPath, "utf8"),
    readFile(visualizerPath, "utf8"),
    readFile(fixturePath, "utf8"),
  ]);

  const events = parseNdjson(fixtureText);
  const model = buildModelFromFixtureText(fixtureText);
  const checks = [
    ...(await checkRequiredFiles(rootDir)),
    ...runStructuralChecks({
      rootDir,
      specText,
      programText,
      visualizerText,
      events,
      model,
    }),
  ];
  const metrics = deriveMetrics({
    checks,
    visualizerText,
    events,
    model,
  });

  const passedChecks = checks.filter((check) => check.ok).length;
  const failedChecks = checks.length - passedChecks;

  const resultRow = [
    new Date().toISOString(),
    metrics.buildPass,
    metrics.workerAccuracy,
    metrics.nodeAccuracy,
    metrics.arcAccuracy,
    metrics.visualMatch,
    metrics.perfScore,
    metrics.overlapPenalty,
    metrics.sceneScore,
    passedChecks,
    failedChecks,
  ].join("\t");

  await appendFile(resultsPath, `${resultRow}\n`);

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          metrics,
          checks,
        },
        null,
        2,
      ),
    );
    return;
  }

  printHumanReport({ metrics, checks, model, events });
}

function printHumanReport({
  metrics,
  checks,
  model,
  events,
}: {
  metrics: ReturnType<typeof deriveMetrics>;
  checks: Awaited<ReturnType<typeof checkRequiredFiles>> extends (infer T)[]
    ? T[]
    : never;
  model: ReturnType<typeof buildModelFromFixtureText>;
  events: ReturnType<typeof parseNdjson>;
}) {
  console.log("Mesh Autoresearch Visualizer Eval");
  console.log("");
  console.log(`scene_score      ${metrics.sceneScore.toFixed(2)}`);
  console.log(`build_pass       ${metrics.buildPass.toFixed(2)}`);
  console.log(`worker_accuracy  ${metrics.workerAccuracy.toFixed(4)}`);
  console.log(`node_accuracy    ${metrics.nodeAccuracy.toFixed(4)}`);
  console.log(`arc_accuracy     ${metrics.arcAccuracy.toFixed(4)}`);
  console.log(`visual_match     ${metrics.visualMatch.toFixed(4)}  (heuristic)`);
  console.log(`perf_score       ${metrics.perfScore.toFixed(4)}  (heuristic)`);
  console.log(`overlap_penalty  ${metrics.overlapPenalty.toFixed(4)}  (heuristic)`);
  console.log("");
  console.log(`workers=${model.workers.length} nodes=${model.nodes.length} jobs=${model.jobs.length} tape=${model.tape.length} events=${events.length}`);
  console.log("");
  console.log("Checks");

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.id}  ${check.detail}`);
  }
}

await main();

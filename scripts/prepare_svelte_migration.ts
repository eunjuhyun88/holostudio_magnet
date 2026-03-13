import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type PhaseSpec = {
  id: string;
  title: string;
  goal: string;
  editableScope: string[];
  deliverables: string[];
  nonGoals: string[];
  gates: string[];
};

type Options = {
  runtimeRoot: string;
  sourceRoot: string;
};

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [key, rawValue] = argument.slice(2).split("=", 2);
    values.set(key, rawValue ?? "true");
  }

  const sourceRoot = path.resolve(values.get("source-root") ?? process.cwd());
  const runtimeRoot = path.resolve(values.get("runtime-root") ?? path.join(sourceRoot, "runtime", "svelte-migration"));

  return { runtimeRoot, sourceRoot };
}

function loadPhaseSpecs(sourceRoot: string): PhaseSpec[] {
  const phasePath = path.join(sourceRoot, "migration", "svelte", "phases.json");
  return JSON.parse(readFileSync(phasePath, "utf8")) as PhaseSpec[];
}

function hasSvelteDependencies(sourceRoot: string): boolean {
  const packagePath = path.join(sourceRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return Boolean(
    packageJson.dependencies?.svelte ||
      packageJson.devDependencies?.svelte ||
      packageJson.devDependencies?.["@sveltejs/vite-plugin-svelte"],
  );
}

function writeFile(targetPath: string, content: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
}

function buildPhaseProgram(phase: PhaseSpec, sourceRoot: string): string {
  const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

  return `# ${phase.title}

## Phase Objective

${phase.goal}

## Source Root

\`${sourceRoot}\`

## Editable Scope

${bullets(phase.editableScope)}

## Deliverables

${bullets(phase.deliverables)}

## Non-Goals

${bullets(phase.nonGoals)}

## Required Gates

${bullets(phase.gates)}

## Iteration Rule

Do one scoped change, validate it, then log the outcome in \`results.tsv\`.

## Keep Rule

Keep only if the phase objective gets closer without breaking a gate.
`;
}

function buildRuntimeReadme(options: Options, phases: PhaseSpec[], svelteInstalled: boolean): string {
  const phaseLines = phases
    .map((phase, index) => `${index + 1}. \`${phase.id}\` — ${phase.title}`)
    .join("\n");

  const dependencyStatus = svelteInstalled
    ? "Svelte dependencies already appear in package.json."
    : "Svelte dependencies are not installed yet. Phase 1 can still proceed because it only extracts shared TypeScript core.";

  return `# Prepared Svelte Migration Runtime

Generated for:

- source root: \`${options.sourceRoot}\`
- runtime root: \`${options.runtimeRoot}\`

## Dependency Status

${dependencyStatus}

## Phase Order

${phaseLines}

## Recommended Usage

Use each phase folder as a separate long-running task contract for an autoresearch-style worker.

Do not skip directly to the entry cutover.
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const phases = loadPhaseSpecs(options.sourceRoot);
  const svelteInstalled = hasSvelteDependencies(options.sourceRoot);

  mkdirSync(options.runtimeRoot, { recursive: true });

  const manifest = {
    generated_at: new Date().toISOString(),
    source_root: options.sourceRoot,
    runtime_root: options.runtimeRoot,
    svelte_dependencies_present: svelteInstalled,
    phases,
    blockers: svelteInstalled ? [] : ["Install Svelte dependencies before phase-2-svelte-shell."],
  };

  writeFile(path.join(options.runtimeRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFile(path.join(options.runtimeRoot, "README.md"), buildRuntimeReadme(options, phases, svelteInstalled));

  for (const phase of phases) {
    const phaseRoot = path.join(options.runtimeRoot, phase.id);
    writeFile(path.join(phaseRoot, "program.md"), buildPhaseProgram(phase, options.sourceRoot));
    writeFile(path.join(phaseRoot, "results.tsv"), "iteration\tstatus\tdescription\n");
    writeFile(
      path.join(phaseRoot, "notes.md"),
      `# ${phase.title}\n\nStart here.\n\n- Goal: ${phase.goal}\n- Current status: not started\n`,
    );
  }

  process.stdout.write(`${options.runtimeRoot}\n`);
}

main();

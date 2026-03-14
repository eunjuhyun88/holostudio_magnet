import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "./autoresearch_to_telemetry.ts";
import {
  readAutoresearchStackStatus,
  resolvePreferredAutoresearchRepoPath,
  resolvePreferredNanochatRepoPath,
} from "../packages/autoresearch-adapter/src/index.ts";

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

type SupervisorConfig = {
  repoPath: string;
  runtimeRoot: string;
  workspaceRoot: string;
  manifestPath: string;
  controllerPort: number;
  controllerLaunch: boolean;
  controllerTickMs: number;
  workers: number;
  agentExperiments: number;
  preflightOnly: boolean;
  forceLaunch: boolean;
  restartAgents: boolean;
  restartDelayMs: number;
  model?: string;
  round1BaselineCommit: string;
  round1ReferencePaths: string[];
  nanochatRepoPath: string;
};

type Preflight = {
  uv: boolean;
  codex: boolean;
  nvidiaSmi: boolean;
  cacheRoot: boolean;
  tokenizer: boolean;
  ready: boolean;
  blockers: string[];
};

type WorkspaceRuntime = {
  entry: ManifestWorkspace;
  workspaceDir: string;
  statusPath: string;
  stdoutPath: string;
  stderrPath: string;
  lastMessagePath: string;
  process?: ChildProcess;
  launches: number;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function parseConfig(): Promise<SupervisorConfig> {
  const args = parseCliArgs(process.argv.slice(2));
  const runtimeRoot = resolveInputPath(args.get("runtime-root")?.[0] ?? resolve(rootDir, "runtime/autoresearch-loop-live"));
  const stack = await readAutoresearchStackStatus(rootDir);
  const nanochatRepoPath = resolvePreferredNanochatRepoPath(rootDir, stack);
  const round1BaselineCommit = stack.lock?.nanochat.round1BaselineCommit ?? stack.spec.nanochat.round1BaselineCommit;
  const round1ReferencePaths = stack.lock?.nanochat.round1ReferencePaths ?? stack.spec.nanochat.round1ReferencePaths;

  return {
    repoPath: resolvePreferredAutoresearchRepoPath(rootDir, stack, args.get("repo")?.[0]),
    runtimeRoot,
    workspaceRoot: resolveInputPath(args.get("workspace-root")?.[0] ?? resolve(runtimeRoot, "workspaces")),
    manifestPath: resolveInputPath(args.get("manifest")?.[0] ?? resolve(runtimeRoot, "manifest.json")),
    controllerPort: Number(args.get("controller-port")?.[0] ?? "8787"),
    controllerLaunch: args.get("launch-controller")?.[0] !== "false",
    controllerTickMs: Math.max(150, Number(args.get("controller-tick-ms")?.[0] ?? "700")),
    workers: Math.max(1, Number(args.get("workers")?.[0] ?? "6")),
    agentExperiments: Math.max(1, Number(args.get("agent-experiments")?.[0] ?? "12")),
    preflightOnly: args.get("preflight-only")?.[0] === "true",
    forceLaunch: args.get("force-launch")?.[0] === "true",
    restartAgents: args.get("restart-agents")?.[0] !== "false",
    restartDelayMs: Math.max(1000, Number(args.get("restart-delay-ms")?.[0] ?? "12000")),
    model: args.get("model")?.[0],
    round1BaselineCommit,
    round1ReferencePaths,
    nanochatRepoPath,
  };
}

async function main() {
  const config = await parseConfig();
  await mkdir(config.runtimeRoot, { recursive: true });

  const controller = await ensureController(config);
  const manifest = await waitForManifest(config);
  const workspaces = manifest.workspaces.map((entry) => createWorkspaceRuntime(config, entry));
  const preflight = await runPreflight();

  await writeSupervisorState(config, manifest, preflight);
  await Promise.all(workspaces.map((workspace) => writeBlockedStatus(workspace, preflight, false)));

  console.log(`[supervisor] controller=http://localhost:${config.controllerPort}/events`);
  console.log(`[supervisor] workspaces=${workspaces.length}`);
  console.log(`[supervisor] ready=${preflight.ready}`);

  if (config.preflightOnly || (!preflight.ready && !config.forceLaunch)) {
    if (!preflight.ready) {
      console.log(`[supervisor] blocked: ${preflight.blockers.join(" | ")}`);
    }
    return;
  }

  const launchPromises = workspaces.map((workspace) => launchWorkspaceAgent(config, workspace));
  await Promise.all(launchPromises);

  const shutdown = () => {
    for (const workspace of workspaces) {
      workspace.process?.kill("SIGTERM");
    }
    controller?.kill("SIGTERM");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function ensureController(config: SupervisorConfig): Promise<ChildProcess | null> {
  if (await healthzOk(config.controllerPort)) {
    console.log("[supervisor] reusing existing controller");
    return null;
  }

  if (!config.controllerLaunch) {
    throw new Error(`Controller is not reachable on port ${config.controllerPort}.`);
  }

  const controllerScript = resolve(rootDir, "scripts/autoresearch_loop_controller.ts");
  const child = spawn(
    "node",
    [
      "--experimental-strip-types",
      controllerScript,
      `--repo=${config.repoPath}`,
      `--runtime-root=${config.runtimeRoot}`,
      `--workspace-root=${config.workspaceRoot}`,
      `--manifest=${config.manifestPath}`,
      `--workers=${config.workers}`,
      "--mode=watch",
      `--port=${config.controllerPort}`,
      `--tick-ms=${config.controllerTickMs}`,
      "--max-iterations=1000000",
      "--write-telemetry-log=true",
    ],
    {
      cwd: rootDir,
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  await waitForHealthz(config.controllerPort, 12000);
  return child;
}

async function healthzOk(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthz(port: number, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await healthzOk(port)) {
      return;
    }
    await sleep(400);
  }
  throw new Error(`Controller did not become healthy on port ${port}.`);
}

async function waitForManifest(config: SupervisorConfig): Promise<ManifestFile> {
  const start = Date.now();
  while (Date.now() - start < 12000) {
    try {
      const raw = await readFile(config.manifestPath, "utf8");
      return JSON.parse(raw) as ManifestFile;
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`Manifest did not appear at ${config.manifestPath}`);
}

function createWorkspaceRuntime(config: SupervisorConfig, entry: ManifestWorkspace): WorkspaceRuntime {
  const workspaceDir = resolve(dirname(config.manifestPath), entry.workspace);
  const slug = entry.workerId.replace(/^worker-/, "");
  const logsDir = resolve(config.runtimeRoot, "agent-logs", slug);

  return {
    entry,
    workspaceDir,
    statusPath: resolve(logsDir, "agent_status.md"),
    stdoutPath: resolve(logsDir, "codex.stdout.log"),
    stderrPath: resolve(logsDir, "codex.stderr.log"),
    lastMessagePath: resolve(logsDir, "codex.last.txt"),
    launches: 0,
  };
}

async function runPreflight(): Promise<Preflight> {
  const uv = await commandExists("uv");
  const codex = await commandExists("codex");
  const nvidiaSmi = await commandExists("nvidia-smi");
  const cacheRoot = await pathExists(resolveHome("~/.cache/autoresearch"));
  const tokenizer = await pathExists(resolveHome("~/.cache/autoresearch/tokenizer.json"));
  const blockers: string[] = [];

  if (!uv) {
    blockers.push("uv not found");
  }
  if (!codex) {
    blockers.push("codex CLI not found");
  }
  if (!nvidiaSmi) {
    blockers.push("nvidia-smi not found");
  }
  if (!cacheRoot) {
    blockers.push("~/.cache/autoresearch missing");
  }
  if (!tokenizer) {
    blockers.push("~/.cache/autoresearch/tokenizer.json missing");
  }

  return {
    uv,
    codex,
    nvidiaSmi,
    cacheRoot,
    tokenizer,
    ready: blockers.length === 0,
    blockers,
  };
}

async function launchWorkspaceAgent(config: SupervisorConfig, workspace: WorkspaceRuntime): Promise<void> {
  await mkdir(dirname(workspace.statusPath), { recursive: true });

  const runOnce = async () => {
    workspace.launches += 1;
    const prompt = buildAgentPrompt(workspace, config);
    await writeFile(workspace.statusPath, `# Agent Launching\n\nlaunches: ${workspace.launches}\n`, "utf8");

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const args = [
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        workspace.workspaceDir,
        "-o",
        workspace.lastMessagePath,
      ];
      if (config.model) {
        args.push("-m", config.model);
      }

      const child = spawn("codex", args, {
        cwd: workspace.workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      workspace.process = child;
      child.stdin.write(prompt);
      child.stdin.end();

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
      child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

      child.on("error", rejectPromise);
      child.on("close", async (code) => {
        const stdoutText = Buffer.concat(stdoutChunks).toString("utf8");
        const stderrText = Buffer.concat(stderrChunks).toString("utf8");
        await writeFile(workspace.stdoutPath, stdoutText, "utf8");
        await writeFile(workspace.stderrPath, stderrText, "utf8");
        await updateStatusFromLogs(workspace, code ?? 1);
        workspace.process = undefined;

        if (code === 0) {
          resolvePromise();
          return;
        }

        rejectPromise(new Error(`codex exited with code ${code ?? -1}`));
      });
    });
  };

  const loop = async () => {
    for (;;) {
      try {
        await runOnce();
      } catch (error) {
        await appendStatusLine(workspace.statusPath, `launch failed: ${toErrorMessage(error)}`);
      }

      if (!config.restartAgents) {
        return;
      }

      await sleep(config.restartDelayMs);
    }
  };

  void loop();
}

function buildAgentPrompt(workspace: WorkspaceRuntime, config: SupervisorConfig): string {
  const referenceLines = config.round1ReferencePaths.map(
    (referencePath) => `- ${resolve(config.nanochatRepoPath, referencePath)}`,
  );

  return [
    `You are ${workspace.entry.workerId}, one worker in a long-running autoresearch swarm.`,
    `Work only inside this git worktree: ${workspace.workspaceDir}.`,
    `The controller is already running at http://localhost:${config.controllerPort}/events and watches run.log + results.tsv.`,
    `Setup is already done: stay on the current branch, do not create a new branch, and do not wait for human confirmation.`,
    `Before changing anything, read README.md, program.md, prepare.py, and train.py.`,
    `This workspace is bootstrapped from the pinned Karpathy upstream autoresearch repo at ${config.repoPath}.`,
    `Use nanochat round-1 commit ${config.round1BaselineCommit} as the baseline reference. Review these files for concrete ideas before radical changes:`,
    ...referenceLines,
    `Respect program.md, with these overrides:`,
    `- do not ask for confirmation`,
    `- do not create a new branch`,
    `- only modify train.py`,
    `- you may write untracked notes to agent_status.md`,
    `- keep results.tsv untracked`,
    `- run up to ${config.agentExperiments} experiments in this session, then stop and summarize`,
    `If blocked by missing data, missing GPU, or environment setup, do not loop uselessly. Write a short blocker note to agent_status.md with the exact command needed, then exit.`,
    `If the environment is ready, follow the experiment loop in program.md and improve val_bpb.`,
    `At the end, write agent_status.md containing: best kept commit, best val_bpb, last experiment result, and next three ideas.`,
  ].join("\n");
}

async function updateStatusFromLogs(workspace: WorkspaceRuntime, exitCode: number) {
  const lastMessage = await readFile(workspace.lastMessagePath, "utf8").catch(() => "");
  const stdoutTail = await readFile(workspace.stdoutPath, "utf8")
    .then((text) => tail(text, 40))
    .catch(() => "");

  const body = [
    "# Agent Session",
    "",
    `exit_code: ${exitCode}`,
    "",
    "## Last Message",
    "",
    "```text",
    lastMessage.trim() || "(empty)",
    "```",
    "",
    "## Stdout Tail",
    "",
    "```text",
    stdoutTail.trim() || "(empty)",
    "```",
    "",
  ].join("\n");

  await writeFile(workspace.statusPath, body, "utf8");
}

async function writeBlockedStatus(workspace: WorkspaceRuntime, preflight: Preflight, launched: boolean) {
  await mkdir(dirname(workspace.statusPath), { recursive: true });
  const body = [
    "# Agent Status",
    "",
    `worker: ${workspace.entry.workerId}`,
    `region: ${workspace.entry.region}`,
    `workspace: ${workspace.workspaceDir}`,
    `launch_attempted: ${launched}`,
    "",
    "## Preflight",
    "",
    `- uv: ${preflight.uv}`,
    `- codex: ${preflight.codex}`,
    `- nvidia-smi: ${preflight.nvidiaSmi}`,
    `- cache root: ${preflight.cacheRoot}`,
    `- tokenizer: ${preflight.tokenizer}`,
    "",
    "## Blockers",
    "",
    ...(preflight.blockers.length > 0 ? preflight.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "## Required Commands",
    "",
    `- \`cd ${workspace.workspaceDir} && uv sync\``,
    `- \`cd ${workspace.workspaceDir} && uv run prepare.py\``,
    "- run on a machine with a visible NVIDIA GPU (`nvidia-smi` must succeed)",
    "",
  ].join("\n");

  await writeFile(workspace.statusPath, body, "utf8");
}

async function writeSupervisorState(config: SupervisorConfig, manifest: ManifestFile, preflight: Preflight) {
  const statePath = resolve(config.runtimeRoot, "supervisor-state.json");
  await writeFile(
    statePath,
    `${JSON.stringify({
      controllerPort: config.controllerPort,
      manifestPath: config.manifestPath,
      repoPath: config.repoPath,
      nanochatRepoPath: config.nanochatRepoPath,
      round1BaselineCommit: config.round1BaselineCommit,
      workers: manifest.workspaces.length,
      preflight,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise<boolean>((resolvePromise) => {
    const child = spawn("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`], {
      stdio: "ignore",
    });
    child.on("close", (code) => resolvePromise(code === 0));
    child.on("error", () => resolvePromise(false));
  });
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

function resolveHome(value: string): string {
  if (!value.startsWith("~/")) {
    return value;
  }
  return resolve(process.env.HOME ?? "", value.slice(2));
}

function tail(text: string, lines: number): string {
  return text.split(/\r?\n/).slice(-lines).join("\n");
}

async function appendStatusLine(statusPath: string, line: string) {
  const previous = await readFile(statusPath, "utf8").catch(() => "");
  await writeFile(statusPath, `${previous}\n${line}\n`, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();

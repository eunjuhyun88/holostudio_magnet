import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "./autoresearch_to_telemetry.ts";
import {
  defaultAutoresearchStackLockPath,
  defaultAutoresearchStackSpecPath,
  readAutoresearchStackSpec,
  resolveStackRepoPath,
  type AutoresearchStackLock,
} from "../packages/autoresearch-adapter/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const specPath = resolveInputPath(args.get("spec")?.[0] ?? defaultAutoresearchStackSpecPath(rootDir));
  const lockPath = resolveInputPath(args.get("lock")?.[0] ?? defaultAutoresearchStackLockPath(rootDir));
  const force = args.get("force")?.[0] === "true";
  const spec = await readAutoresearchStackSpec(rootDir, specPath);

  await mkdir(dirname(lockPath), { recursive: true });

  const autoresearchPath = resolveStackRepoPath(rootDir, spec.autoresearch.localPath);
  const nanochatPath = resolveStackRepoPath(rootDir, spec.nanochat.localPath);

  await syncRepo({
    localPath: autoresearchPath,
    remoteUrl: spec.autoresearch.remoteUrl,
    ref: spec.autoresearch.ref,
    force,
  });
  await syncRepo({
    localPath: nanochatPath,
    remoteUrl: spec.nanochat.remoteUrl,
    ref: spec.nanochat.ref,
    force,
  });

  const lock: AutoresearchStackLock = {
    version: spec.version,
    generatedAt: new Date().toISOString(),
    specPath,
    autoresearch: {
      remoteUrl: spec.autoresearch.remoteUrl,
      ref: spec.autoresearch.ref,
      localPath: autoresearchPath,
      resolvedCommit: await revParseHead(autoresearchPath),
    },
    nanochat: {
      remoteUrl: spec.nanochat.remoteUrl,
      ref: spec.nanochat.ref,
      localPath: nanochatPath,
      resolvedCommit: await revParseHead(nanochatPath),
      round1BaselineCommit: spec.nanochat.round1BaselineCommit,
      round1ReferencePaths: spec.nanochat.round1ReferencePaths,
    },
  };

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  console.log(`[bootstrap] spec=${specPath}`);
  console.log(`[bootstrap] lock=${lockPath}`);
  console.log(`[bootstrap] autoresearch=${lock.autoresearch.resolvedCommit} @ ${lock.autoresearch.localPath}`);
  console.log(`[bootstrap] nanochat=${lock.nanochat.resolvedCommit} @ ${lock.nanochat.localPath}`);
  console.log(`[bootstrap] round1=${lock.nanochat.round1BaselineCommit}`);
}

async function syncRepo({
  localPath,
  remoteUrl,
  ref,
  force,
}: {
  localPath: string;
  remoteUrl: string;
  ref: string;
  force: boolean;
}) {
  if (!(await pathExists(resolve(localPath, ".git")))) {
    await mkdir(dirname(localPath), { recursive: true });
    await runProcess("git", ["clone", "--filter=blob:none", remoteUrl, localPath], rootDir);
  }

  await runProcess("git", ["-C", localPath, "remote", "set-url", "origin", remoteUrl], rootDir);
  await runProcess("git", ["-C", localPath, "fetch", "--tags", "--prune", "origin"], rootDir);
  await runProcess("git", ["-C", localPath, "checkout", "--detach", ref], rootDir);

  if (force) {
    await runProcess("git", ["-C", localPath, "clean", "-fd"], rootDir);
  }
}

async function revParseHead(repoPath: string): Promise<string> {
  return runProcessForText("git", ["-C", repoPath, "rev-parse", "HEAD"], rootDir);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK);
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

async function runProcessForText(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
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
      rejectPromise(new Error(`${command} ${args.join(" ")} failed: ${Buffer.concat(stderr).toString("utf8")}`));
    });
  });
}

function resolveInputPath(inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
}

await main();

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export type AutoresearchWorkspaceDescriptor = {
  workspace: string;
  nodeId: string;
  workerId: string;
  region: string;
};

export type AutoresearchAdapterSource = {
  manifestPath: string;
  workspaceRoot: string;
};

export type AutoresearchAdapterStatus = {
  ready: boolean;
  mode: "watch" | "simulate";
  source: AutoresearchAdapterSource;
  workspaceCount: number;
};

export type AutoresearchUpstreamRepoSpec = {
  remoteUrl: string;
  ref: string;
  localPath: string;
};

export type NanochatUpstreamSpec = AutoresearchUpstreamRepoSpec & {
  round1BaselineCommit: string;
  round1ReferencePaths: string[];
};

export type AutoresearchStackSpec = {
  version: number;
  description?: string;
  updatedAt?: string;
  autoresearch: AutoresearchUpstreamRepoSpec;
  nanochat: NanochatUpstreamSpec;
};

export type AutoresearchUpstreamRepoLock = AutoresearchUpstreamRepoSpec & {
  localPath: string;
  resolvedCommit: string;
};

export type NanochatUpstreamLock = AutoresearchUpstreamRepoLock & {
  round1BaselineCommit: string;
  round1ReferencePaths: string[];
};

export type AutoresearchStackLock = {
  version: number;
  generatedAt: string;
  specPath: string;
  autoresearch: AutoresearchUpstreamRepoLock;
  nanochat: NanochatUpstreamLock;
};

export type AutoresearchStackStatus = {
  ready: boolean;
  specPath: string;
  lockPath: string;
  spec: AutoresearchStackSpec;
  lock: AutoresearchStackLock | null;
  missing: string[];
};

export function defaultAutoresearchStackSpecPath(projectRoot: string): string {
  return resolve(projectRoot, "config/autoresearch-upstreams.json");
}

export function defaultAutoresearchStackLockPath(projectRoot: string): string {
  return resolve(projectRoot, "runtime/upstreams/stack.lock.json");
}

export function resolveStackRepoPath(projectRoot: string, repoPath: string): string {
  return isAbsolute(repoPath) ? repoPath : resolve(projectRoot, repoPath);
}

export async function readAutoresearchStackSpec(
  projectRoot: string,
  specPath = defaultAutoresearchStackSpecPath(projectRoot),
): Promise<AutoresearchStackSpec> {
  const raw = await readFile(specPath, "utf8");
  return JSON.parse(raw) as AutoresearchStackSpec;
}

export async function readAutoresearchStackLock(
  projectRoot: string,
  lockPath = defaultAutoresearchStackLockPath(projectRoot),
): Promise<AutoresearchStackLock | null> {
  try {
    const raw = await readFile(lockPath, "utf8");
    return JSON.parse(raw) as AutoresearchStackLock;
  } catch {
    return null;
  }
}

export async function readAutoresearchStackStatus(
  projectRoot: string,
  {
    specPath = defaultAutoresearchStackSpecPath(projectRoot),
    lockPath = defaultAutoresearchStackLockPath(projectRoot),
  }: {
    specPath?: string;
    lockPath?: string;
  } = {},
): Promise<AutoresearchStackStatus> {
  const spec = await readAutoresearchStackSpec(projectRoot, specPath);
  const lock = await readAutoresearchStackLock(projectRoot, lockPath);

  const missing: string[] = [];
  const autoresearchPath = resolveStackRepoPath(projectRoot, lock?.autoresearch.localPath ?? spec.autoresearch.localPath);
  const nanochatPath = resolveStackRepoPath(projectRoot, lock?.nanochat.localPath ?? spec.nanochat.localPath);

  if (!(await pathExists(autoresearchPath))) {
    missing.push(`autoresearch repo missing at ${autoresearchPath}`);
  }
  if (!(await pathExists(nanochatPath))) {
    missing.push(`nanochat repo missing at ${nanochatPath}`);
  }
  if (!lock) {
    missing.push(`stack lock missing at ${lockPath}`);
  }

  return {
    ready: missing.length === 0,
    specPath,
    lockPath,
    spec,
    lock,
    missing,
  };
}

export function resolvePreferredAutoresearchRepoPath(
  projectRoot: string,
  stack: {
    spec: AutoresearchStackSpec;
    lock?: AutoresearchStackLock | null;
  },
  explicitRepoPath?: string,
): string {
  if (explicitRepoPath) {
    return resolveStackRepoPath(projectRoot, explicitRepoPath);
  }
  return resolveStackRepoPath(projectRoot, stack.lock?.autoresearch.localPath ?? stack.spec.autoresearch.localPath);
}

export function resolvePreferredNanochatRepoPath(
  projectRoot: string,
  stack: {
    spec: AutoresearchStackSpec;
    lock?: AutoresearchStackLock | null;
  },
): string {
  return resolveStackRepoPath(projectRoot, stack.lock?.nanochat.localPath ?? stack.spec.nanochat.localPath);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function describeAdapterStatus(input: AutoresearchAdapterStatus): string {
  const mode = input.mode === "watch" ? "watching" : "simulating";
  return `${mode} ${input.workspaceCount} workspace(s) from ${input.source.workspaceRoot}`;
}

export * from "./runtime-root.ts";

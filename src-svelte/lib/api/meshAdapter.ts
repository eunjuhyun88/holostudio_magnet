import type {
  RuntimeMeshSummary,
  RuntimeWorkspaceResultEntry,
  RuntimeWorkspaceSummary,
} from '@mesh/contracts';
import type { ModCategory } from '../data/modifications.ts';
import type { Experiment, Branch, AutoresearchJob, ExperimentStatus, VerificationState } from '../stores/jobStore.ts';

/* ─── Runtime Mesh → AutoresearchJob Mapping ─── */

export function mapRuntimeMeshToJob(
  mesh: RuntimeMeshSummary,
  apiBase: string,
  requestedRuntimeRoot: string | null,
): AutoresearchJob {
  const experiments = buildRuntimeExperiments(mesh);
  const completed = experiments.filter((experiment) => experiment.status !== 'training').length;
  const firstCompleted = [...experiments]
    .reverse()
    .find((experiment) => experiment.status === 'keep' || experiment.status === 'discard');
  const bestMetric = mesh.totals.bestMetric ?? Infinity;
  const runningCount = experiments.filter((experiment) => experiment.status === 'training').length;
  const totalExperiments = Math.max(completed + runningCount, mesh.totals.results + runningCount, 1);
  const startedAt = experiments.length > 0 ? Math.min(...experiments.map((experiment) => experiment.timestamp)) : Date.now();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const topic = createRuntimeTopic(mesh);
  const setupMessage = createRuntimeSetupMessage(mesh);

  return {
    topic,
    phase: mesh.controller?.stopReason
      ? 'complete'
      : experiments.length > 0 || mesh.workspaces.length > 0
        ? 'running'
        : 'idle',
    setupMessage,
    experiments,
    branches: createRuntimeBranches(experiments),
    bestMetric,
    totalExperiments,
    startedAt,
    elapsedSeconds,
    paused: mesh.controller?.paused ?? false,
    boostedCategories: (mesh.controller?.boostedCategories ?? []) as ModCategory[],
    pausedCategories: (mesh.controller?.pausedCategories ?? []) as ModCategory[],
    baselineMetric: firstCompleted?.metric ?? bestMetric,
    sourceMode: 'runtime',
    controlsAvailable: mesh.controller?.reachable === true
      && mesh.controller.supportsCommands === true
      && !mesh.controller.stopReason,
    runtimeApiBase: apiBase,
    runtimeRoot: requestedRuntimeRoot ?? mesh.runtimeRoot,
    runtimeStatus: mesh.controller?.reachable || mesh.workspaces.length > 0 ? 'streaming' : 'connecting',
    runtimeError: mesh.missing.length > 0 ? mesh.missing.join(' | ') : mesh.controller?.error ?? null,
  };
}

export function applyRuntimeControllerToJob(
  job: AutoresearchJob,
  controller: RuntimeMeshSummary['controller'],
): AutoresearchJob {
  if (!controller) {
    return job;
  }

  return {
    ...job,
    phase: controller.stopReason ? 'complete' : job.phase,
    setupMessage: controller.stopReason ? `Runtime stopped: ${controller.stopReason}` : job.setupMessage,
    paused: controller.paused ?? job.paused,
    boostedCategories: (controller.boostedCategories ?? []) as ModCategory[],
    pausedCategories: (controller.pausedCategories ?? []) as ModCategory[],
    controlsAvailable: controller.reachable === true
      && controller.supportsCommands === true
      && !controller.stopReason,
    runtimeError: controller.error ?? job.runtimeError,
    runtimeStatus: controller.reachable ? 'streaming' : job.runtimeStatus,
  };
}

/* ─── Internal Helpers ─── */

function createRuntimeTopic(mesh: RuntimeMeshSummary): string {
  const rootLabel = mesh.runtimeRoot.split('/').filter(Boolean).at(-1) ?? 'runtime';
  const repoLabel = mesh.supervisor?.repoPath?.includes('karpathy-autoresearch')
    ? 'Karpathy Autoresearch'
    : 'Autoresearch Runtime';
  return `${repoLabel} · ${rootLabel}`;
}

function createRuntimeSetupMessage(mesh: RuntimeMeshSummary): string {
  if (mesh.missing.length > 0) {
    return mesh.missing.join(' | ');
  }
  if (mesh.supervisor?.blockers.length) {
    return `Blocked: ${mesh.supervisor.blockers.join(' | ')}`;
  }
  if (mesh.controller?.stopReason) {
    return `Runtime stopped: ${mesh.controller.stopReason}`;
  }
  if (mesh.controller?.paused) {
    return `Runtime paused across ${mesh.totals.workspaces} workspace(s)`;
  }
  if (mesh.controller?.reachable) {
    return `Runtime live: ${mesh.totals.results} results across ${mesh.totals.workspaces} workspace(s)`;
  }
  return `Runtime snapshot: ${mesh.totals.results} results across ${mesh.totals.workspaces} workspace(s)`;
}

function buildRuntimeExperiments(mesh: RuntimeMeshSummary): Experiment[] {
  const experiments: Experiment[] = [];
  let nextId = 1;

  mesh.workspaces.forEach((workspace, workspaceIndex) => {
    const branchId = workspaceIndex + 1;
    const timestamps = buildWorkspaceTimestamps(workspace, mesh.generatedAt);
    let previousMetric: number | null = null;
    let previousKeepId: number | null = null;

    workspace.results.forEach((result, resultIndex) => {
      const metric = result.status === 'crash' ? 0 : result.valBpb ?? 0;
      const delta = previousMetric !== null && metric > 0 ? Math.round((previousMetric - metric) * 1000) / 1000 : 0;
      const experimentId = nextId++;
      const status = normalizeExperimentStatus(result);
      const experiment: Experiment = {
        id: experimentId,
        parentId: previousKeepId,
        status,
        verification: 'verified' as VerificationState,
        modification: result.description ?? result.commit ?? `experiment ${result.index}`,
        metric,
        delta,
        nodeId: workspace.nodeId,
        gpuNodes: [workspace.nodeId],
        tier: 1,
        branchId,
        duration: 300,
        progress: 100,
        timestamp: timestamps[resultIndex] ?? Date.now(),
      };

      experiments.push(experiment);

      if (metric > 0) {
        previousMetric = metric;
      }
      if (status === 'keep') {
        previousKeepId = experimentId;
      }
    });

    if (workspace.status === 'running') {
      experiments.unshift({
        id: nextId++,
        parentId: previousKeepId,
        status: 'training' as ExperimentStatus,
        verification: 'pending' as VerificationState,
        modification: `live workspace ${workspace.region.toLowerCase()} · ${workspace.gpuLabel.toLowerCase()}`,
        metric: 0,
        delta: 0,
        nodeId: workspace.nodeId,
        gpuNodes: [workspace.nodeId],
        tier: 1,
        branchId,
        duration: 0,
        progress: 42,
        timestamp: Date.now(),
      });
    }
  });

  return experiments.sort((left, right) => right.timestamp - left.timestamp);
}

function buildWorkspaceTimestamps(workspace: RuntimeWorkspaceSummary, generatedAt: string): number[] {
  const endTs = Date.parse(workspace.lastRunAt ?? generatedAt);
  const spacingMs = 45_000;
  return workspace.results.map((_, index) => endTs - (workspace.results.length - index - 1) * spacingMs);
}

function createRuntimeBranches(experiments: Experiment[]): Branch[] {
  const branchMap = new Map<number, Branch>();

  for (const experiment of experiments) {
    let branch = branchMap.get(experiment.branchId);
    if (!branch) {
      branch = { id: experiment.branchId, completed: 0, total: 0, bestMetric: Infinity };
      branchMap.set(experiment.branchId, branch);
    }

    if (experiment.status !== 'training') {
      branch.completed += 1;
      branch.total += 1;
      if (experiment.metric > 0 && experiment.metric < branch.bestMetric) {
        branch.bestMetric = experiment.metric;
      }
    } else {
      branch.total += 1;
    }
  }

  return [...branchMap.values()].sort((left, right) => left.id - right.id);
}

function normalizeExperimentStatus(result: RuntimeWorkspaceResultEntry): ExperimentStatus {
  if (result.status === 'keep' || result.status === 'discard' || result.status === 'crash') {
    return result.status;
  }
  return result.valBpb && result.valBpb > 0 ? 'discard' : 'crash';
}

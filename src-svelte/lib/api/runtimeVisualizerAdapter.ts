import type { RuntimeMeshSummary, RuntimeWorkspaceSummary } from '@mesh/contracts';
import type { Job, Node, TapeEntry, VisualizerModel, Worker } from '../utils/types.ts';

const RESULT_SPACING_MS = 45_000;

export function mapRuntimeMeshToVisualizer(mesh: RuntimeMeshSummary): VisualizerModel {
  const nodes = mesh.workspaces.map(mapWorkspaceNode);
  const workers = mesh.workspaces.map(mapWorkspaceWorker);
  const jobs = buildJobs(mesh.workspaces);
  const tape = buildTape(mesh.workspaces, workers);

  return {
    nodes,
    workers,
    jobs,
    tape,
  };
}

function mapWorkspaceNode(workspace: RuntimeWorkspaceSummary): Node {
  return {
    id: workspace.nodeId,
    lat: workspace.lat,
    lng: workspace.lng,
    cpu: workspace.cpu,
    gpu: workspace.gpu,
    memGb: workspace.memGb,
    state: deriveNodeState(workspace),
    jobId: workspace.jobId,
  };
}

function mapWorkspaceWorker(workspace: RuntimeWorkspaceSummary): Worker {
  const lastTwo = workspace.results.slice(-2);
  const lastMetric = workspace.lastMetric ?? undefined;
  const metricDelta = lastTwo.length === 2 && lastTwo[0].valBpb !== null && lastTwo[1].valBpb !== null
    ? +(lastTwo[0].valBpb - lastTwo[1].valBpb).toFixed(4)
    : undefined;

  return {
    id: workspace.workerId,
    gpuLabel: workspace.gpuLabel,
    region: workspace.region,
    nodeId: workspace.nodeId,
    experimentId: workspace.experimentId,
    state: deriveWorkerState(workspace),
    progress: workspace.status === 'running' ? 0.48 : workspace.resultsCount > 0 ? 1 : 0,
    metric: lastMetric,
    metricDelta,
    vramGb: workspace.memGb,
  };
}

function buildJobs(workspaces: RuntimeWorkspaceSummary[]): Job[] {
  const byJob = new Map<string, Job>();

  for (const workspace of workspaces) {
    let job = byJob.get(workspace.jobId);
    if (!job) {
      job = {
        id: workspace.jobId,
        hubLat: workspace.lat,
        hubLng: workspace.lng,
        workerIds: [],
        nodeIds: [],
        state: 'queued',
      };
      byJob.set(workspace.jobId, job);
    }

    job.workerIds.push(workspace.workerId);
    job.nodeIds.push(workspace.nodeId);
    job.state = mergeJobState(job.state, workspace);
  }

  return [...byJob.values()];
}

function buildTape(workspaces: RuntimeWorkspaceSummary[], workers: Worker[]): TapeEntry[] {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const entries: TapeEntry[] = [];

  for (const workspace of workspaces) {
    const worker = workerById.get(workspace.workerId);
    const baseTs = Date.parse(workspace.lastRunAt ?? new Date().toISOString());
    workspace.results.forEach((result, index) => {
      if (!result.status) return;
      const previous = index > 0 ? workspace.results[index - 1] : null;
      const delta = previous?.valBpb != null && result.valBpb != null
        ? +(previous.valBpb - result.valBpb).toFixed(4)
        : worker?.metricDelta;

      entries.push({
        ts: new Date(baseTs - (workspace.results.length - index - 1) * RESULT_SPACING_MS).toISOString(),
        experimentId: result.commit ?? `${workspace.experimentId}-${result.index}`,
        workerId: workspace.workerId,
        result: result.status,
        metricDelta: delta,
      });
    });
  }

  return entries.sort((left, right) => Date.parse(right.ts) - Date.parse(left.ts));
}

function deriveNodeState(workspace: RuntimeWorkspaceSummary): Node['state'] {
  if (workspace.status === 'running') return 'training';
  if (workspace.launchAttempted || workspace.resultsCount > 0) return 'assigned';
  if (workspace.status === 'blocked') return 'cooldown';
  return 'available';
}

function deriveWorkerState(workspace: RuntimeWorkspaceSummary): Worker['state'] {
  if (workspace.status === 'running') return 'training';
  if (workspace.lastResultStatus === 'keep' || workspace.lastResultStatus === 'discard' || workspace.lastResultStatus === 'crash') {
    return workspace.lastResultStatus;
  }
  if (workspace.launchAttempted || workspace.resultsCount > 0) return 'evaluating';
  return 'idle';
}

function mergeJobState(current: Job['state'], workspace: RuntimeWorkspaceSummary): Job['state'] {
  if (workspace.status === 'running') return 'training';
  if (current === 'training') return current;
  if (workspace.lastResultStatus) return 'done';
  if (workspace.launchAttempted || workspace.resultsCount > 0) return 'evaluating';
  return current;
}

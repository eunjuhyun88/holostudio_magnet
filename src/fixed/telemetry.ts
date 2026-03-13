import type {
  ExperimentResultEvent,
  Job,
  Node,
  TelemetryEvent,
  VisualizerModel,
  Worker,
} from "./types.ts";

export function createEmptyModel(): VisualizerModel {
  return {
    workers: [],
    nodes: [],
    jobs: [],
    tape: [],
  };
}

export function cloneModel(model: VisualizerModel): VisualizerModel {
  return JSON.parse(JSON.stringify(model)) as VisualizerModel;
}

export function applyTelemetryEvent(
  model: VisualizerModel,
  event: TelemetryEvent,
): VisualizerModel {
  switch (event.type) {
    case "node.online": {
      upsertNode(model, {
        ...event.node,
        state: "online",
      });
      return model;
    }
    case "node.available": {
      const node = ensureNode(model, event.nodeId);
      node.state = "available";
      return model;
    }
    case "node.assigned": {
      const node = ensureNode(model, event.nodeId);
      node.state = "assigned";
      node.jobId = event.jobId;
      return model;
    }
    case "node.state": {
      const node = ensureNode(model, event.nodeId);
      node.state = event.state;
      if (event.jobId) {
        node.jobId = event.jobId;
      }
      return model;
    }
    case "worker.started": {
      upsertWorker(model, event.worker);
      return model;
    }
    case "worker.state": {
      const worker = ensureWorker(model, event.workerId);
      worker.state = event.state;
      if (typeof event.progress === "number") {
        worker.progress = event.progress;
      }
      if (typeof event.metric === "number") {
        worker.metric = event.metric;
      }
      if (typeof event.metricDelta === "number") {
        worker.metricDelta = event.metricDelta;
      }

      const attachedNode = model.nodes.find((node) => node.id === worker.nodeId);
      if (attachedNode && (event.state === "training" || event.state === "evaluating")) {
        attachedNode.state = event.state === "training" ? "training" : "assigned";
      }

      return model;
    }
    case "worker.result": {
      const worker = ensureWorker(model, event.workerId);
      worker.state = event.state;
      worker.progress = 1;
      if (typeof event.metric === "number") {
        worker.metric = event.metric;
      }
      if (typeof event.metricDelta === "number") {
        worker.metricDelta = event.metricDelta;
      }
      return model;
    }
    case "job.created": {
      upsertJob(model, event.job);
      return model;
    }
    case "job.state": {
      const job = ensureJob(model, event.jobId);
      job.state = event.state;
      return model;
    }
    case "experiment.result": {
      recordTapeEntry(model, event);
      return model;
    }
    default: {
      return model;
    }
  }
}

function upsertNode(model: VisualizerModel, nextNode: Node) {
  const index = model.nodes.findIndex((node) => node.id === nextNode.id);

  if (index === -1) {
    model.nodes.push(nextNode);
    return;
  }

  model.nodes[index] = {
    ...model.nodes[index],
    ...nextNode,
  };
}

function upsertWorker(model: VisualizerModel, nextWorker: Worker) {
  const index = model.workers.findIndex((worker) => worker.id === nextWorker.id);

  if (index === -1) {
    model.workers.push(nextWorker);
    return;
  }

  model.workers[index] = {
    ...model.workers[index],
    ...nextWorker,
  };
}

function upsertJob(model: VisualizerModel, nextJob: Job) {
  const index = model.jobs.findIndex((job) => job.id === nextJob.id);

  if (index === -1) {
    model.jobs.push(nextJob);
    return;
  }

  model.jobs[index] = {
    ...model.jobs[index],
    ...nextJob,
  };
}

function recordTapeEntry(model: VisualizerModel, event: ExperimentResultEvent) {
  const nextEntry = {
    ts: event.ts,
    experimentId: event.experimentId,
    workerId: event.workerId,
    result: event.result,
    metricDelta: event.metricDelta,
  };
  const duplicate = model.tape.some((entry) => {
    return (
      entry.ts === nextEntry.ts &&
      entry.experimentId === nextEntry.experimentId &&
      entry.workerId === nextEntry.workerId &&
      entry.result === nextEntry.result &&
      entry.metricDelta === nextEntry.metricDelta
    );
  });

  if (duplicate) {
    return;
  }

  model.tape.unshift(nextEntry);
}

function ensureNode(model: VisualizerModel, nodeId: string): Node {
  let node = model.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    node = {
      id: nodeId,
      lat: 0,
      lng: 0,
      cpu: 0,
      gpu: 0,
      memGb: 0,
      state: "online",
    };
    model.nodes.push(node);
  }

  return node;
}

function ensureWorker(model: VisualizerModel, workerId: string): Worker {
  let worker = model.workers.find((candidate) => candidate.id === workerId);

  if (!worker) {
    worker = {
      id: workerId,
      gpuLabel: "Unknown GPU",
      region: "Unknown Region",
      nodeId: "unknown-node",
      experimentId: "unknown-exp",
      state: "idle",
    };
    model.workers.push(worker);
  }

  return worker;
}

function ensureJob(model: VisualizerModel, jobId: string): Job {
  let job = model.jobs.find((candidate) => candidate.id === jobId);

  if (!job) {
    job = {
      id: jobId,
      hubLat: 0,
      hubLng: 0,
      workerIds: [],
      nodeIds: [],
      state: "queued",
    };
    model.jobs.push(job);
  }

  return job;
}

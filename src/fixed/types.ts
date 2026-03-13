export type WorkerState =
  | "idle"
  | "patching"
  | "training"
  | "evaluating"
  | "keep"
  | "discard"
  | "crash";

export type NodeState =
  | "online"
  | "available"
  | "assigned"
  | "training"
  | "cooldown";

export type JobState = "queued" | "training" | "evaluating" | "done";

export type ExperimentResult = "keep" | "discard" | "crash";

export type Worker = {
  id: string;
  gpuLabel: string;
  region: string;
  nodeId: string;
  experimentId: string;
  state: WorkerState;
  progress?: number;
  metric?: number;
  metricDelta?: number;
  vramGb?: number;
};

export type Node = {
  id: string;
  lat: number;
  lng: number;
  cpu: number;
  gpu: number;
  memGb: number;
  state: NodeState;
  jobId?: string;
};

export type Job = {
  id: string;
  hubLat: number;
  hubLng: number;
  workerIds: string[];
  nodeIds: string[];
  state: JobState;
};

export type TapeEntry = {
  ts: string;
  experimentId: string;
  workerId: string;
  result: ExperimentResult;
  metricDelta?: number;
};

export type VisualizerModel = {
  workers: Worker[];
  nodes: Node[];
  jobs: Job[];
  tape: TapeEntry[];
};

export type NodeOnlineEvent = {
  ts: string;
  type: "node.online";
  node: Omit<Node, "state" | "jobId">;
};

export type NodeAvailableEvent = {
  ts: string;
  type: "node.available";
  nodeId: string;
};

export type NodeAssignedEvent = {
  ts: string;
  type: "node.assigned";
  nodeId: string;
  jobId: string;
};

export type NodeStateEvent = {
  ts: string;
  type: "node.state";
  nodeId: string;
  state: NodeState;
  jobId?: string;
};

export type WorkerStartedEvent = {
  ts: string;
  type: "worker.started";
  worker: Worker;
};

export type WorkerStateEvent = {
  ts: string;
  type: "worker.state";
  workerId: string;
  state: WorkerState;
  progress?: number;
  metric?: number;
  metricDelta?: number;
};

export type WorkerResultEvent = {
  ts: string;
  type: "worker.result";
  workerId: string;
  state: Extract<WorkerState, "keep" | "discard" | "crash">;
  metric?: number;
  metricDelta?: number;
};

export type JobCreatedEvent = {
  ts: string;
  type: "job.created";
  job: Job;
};

export type JobStateEvent = {
  ts: string;
  type: "job.state";
  jobId: string;
  state: JobState;
};

export type ExperimentResultEvent = {
  ts: string;
  type: "experiment.result";
  experimentId: string;
  workerId: string;
  result: ExperimentResult;
  metricDelta?: number;
};

export type TelemetryEvent =
  | NodeOnlineEvent
  | NodeAvailableEvent
  | NodeAssignedEvent
  | NodeStateEvent
  | WorkerStartedEvent
  | WorkerStateEvent
  | WorkerResultEvent
  | JobCreatedEvent
  | JobStateEvent
  | ExperimentResultEvent;

import * as THREE from "three";

import type {
  Job,
  JobState,
  Node,
  NodeState,
  TapeEntry,
  Worker,
  WorkerState,
} from "../fixed/types.ts";

export const workerTone: Record<WorkerState, string> = {
  idle: "#44506b",
  patching: "#7c8fb8",
  training: "#33d1ff",
  evaluating: "#ffb44d",
  keep: "#2ad47d",
  discard: "#ff5d73",
  crash: "#d84cff",
};

export const nodeTone: Record<NodeState, string> = {
  online: "#45607f",
  available: "#5fd3ff",
  assigned: "#33d1ff",
  training: "#00f0ff",
  cooldown: "#7f8fa6",
};

export const tapeTone: Record<TapeEntry["result"], string> = {
  keep: "#2ad47d",
  discard: "#ff5d73",
  crash: "#d84cff",
};

export type MeshRegion = "apac" | "emea" | "amer";

type MeshCenter = {
  key: string;
  lat: number;
  lng: number;
  spreadLat: number;
  spreadLng: number;
  weight: number;
  cadence: number;
  phase: number;
  seed: number;
  jobId?: string;
  meshRegion: MeshRegion;
  kind: "job" | "node" | "pool";
};

export type JobSwarmGroup = {
  id: string;
  donors: number;
  workers: number;
  shards: number;
  flows: number;
  state: JobState;
  tone: string;
};

export type ProtocolPhaseMetric = {
  label: string;
  tone: string;
  value: number;
  detail: string;
};

export type JobOutcomeState = "keep" | "discard" | "crash" | null;

export type JobStageMetric = {
  label: string;
  tone: string;
  active: boolean;
  done: boolean;
};

export const donorHotspots = [
  { lat: 37.5665, lng: 126.978, spreadLat: 5.2, spreadLng: 8.4, region: "apac" as const },
  { lat: 1.3521, lng: 103.8198, spreadLat: 4.4, spreadLng: 7.8, region: "apac" as const },
  { lat: 52.52, lng: 13.405, spreadLat: 5.8, spreadLng: 9.8, region: "emea" as const },
  { lat: 40.7128, lng: -74.006, spreadLat: 6.1, spreadLng: 10.4, region: "amer" as const },
  { lat: 34.0522, lng: -118.2437, spreadLat: 6.3, spreadLng: 10.7, region: "amer" as const },
  { lat: 51.5072, lng: -0.1276, spreadLat: 5.4, spreadLng: 8.9, region: "emea" as const },
  { lat: 25.2048, lng: 55.2708, spreadLat: 5.7, spreadLng: 9.4, region: "emea" as const },
  { lat: 19.076, lng: 72.8777, spreadLat: 6.6, spreadLng: 9.8, region: "apac" as const },
  { lat: -23.5505, lng: -46.6333, spreadLat: 6.8, spreadLng: 10.1, region: "amer" as const },
  { lat: -33.8688, lng: 151.2093, spreadLat: 5.7, spreadLng: 8.5, region: "apac" as const },
  { lat: 35.6762, lng: 139.6503, spreadLat: 5.2, spreadLng: 8.4, region: "apac" as const },
  { lat: 48.8566, lng: 2.3522, spreadLat: 5.1, spreadLng: 8.6, region: "emea" as const },
];

export function isWorkerActiveState(state: WorkerState) {
  return (
    state === "training" ||
    state === "evaluating" ||
    state === "keep" ||
    state === "discard" ||
    state === "crash"
  );
}

export function getJobShardCount(job: Job) {
  const workerCount = Math.max(job.workerIds.length, job.nodeIds.length, 1);

  switch (job.state) {
    case "training":
      return Math.min(7, workerCount * 2 + 1);
    case "evaluating":
      return Math.min(5, workerCount + 2);
    case "queued":
      return Math.min(4, workerCount + 1);
    case "done":
      return Math.min(3, workerCount + 1);
    default:
      return workerCount;
  }
}

export function getJobFlowCount(job: Job) {
  const shardCount = getJobShardCount(job);
  const nodes = Math.max(job.nodeIds.length, 1);
  const flowsPerNode = Math.max(1, Math.min(4, Math.ceil(shardCount / nodes)));
  return nodes * flowsPerNode;
}

export function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function latToPitch(lat: number) {
  return THREE.MathUtils.clamp(THREE.MathUtils.degToRad(lat) * -0.5, -0.65, 0.4);
}

export function lngToRotation(lng: number) {
  return THREE.MathUtils.degToRad(-lng - 90);
}

export function formatNodeLabel(nodeId: string) {
  return nodeId
    .replace(/^node-/, "")
    .split("-")
    .filter((segment) => !/^\d+$/.test(segment))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function stringHash(value: string) {
  return Array.from(value).reduce(
    (sum, character, index) => sum + character.charCodeAt(0) * (index + 1),
    0,
  );
}

export function hashNoise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

export function normalNoise(seedA: number, seedB: number) {
  const u = Math.max(hashNoise(seedA), 1e-6);
  const v = hashNoise(seedB);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function wrapLongitude(lng: number) {
  return THREE.MathUtils.euclideanModulo(lng + 180, 360) - 180;
}

export function resolveMeshRegion(lat: number, lng: number): MeshRegion {
  if (lng >= 70 || lng <= -170) {
    return "apac";
  }

  if (lng >= -25 && lng <= 70) {
    return "emea";
  }

  if (lat < -10 && lng > 110) {
    return "apac";
  }

  return "amer";
}

export function oscillate01(angle: number) {
  return (Math.sin(angle) + 1) * 0.5;
}

export function smoothPulse(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function getRegionPulse(clock: number, region: MeshRegion) {
  const config: Record<MeshRegion, { base: number; burst: number; offset: number }> = {
    apac: { base: 0.083, burst: 0.19, offset: -0.9 },
    emea: { base: 0.072, burst: 0.16, offset: 0.75 },
    amer: { base: 0.064, burst: 0.14, offset: 2.1 },
  };
  const { base, burst, offset } = config[region];
  const longWave = smoothPulse(oscillate01(clock * base + offset));
  const burstWave = smoothPulse(oscillate01(clock * burst + offset * 1.7));

  return THREE.MathUtils.clamp(0.16 + longWave * 0.68 + burstWave * 0.16, 0.16, 1);
}

export function getJobAccent(jobId: string, state: JobState) {
  const seed = stringHash(jobId);
  const hue = hashNoise(seed * 0.173 + 1.27);
  const color = new THREE.Color();
  const lightnessByState: Record<JobState, number> = {
    queued: 0.63,
    training: 0.6,
    evaluating: 0.68,
    done: 0.58,
  };
  const saturationByState: Record<JobState, number> = {
    queued: 0.52,
    training: 0.72,
    evaluating: 0.7,
    done: 0.58,
  };
  color.setHSL(0.48 + hue * 0.18, saturationByState[state], lightnessByState[state]);
  return `#${color.getHexString()}`;
}

export function buildJobNodeCountMap(nodes: Node[]) {
  const counts = new Map<string, number>();

  for (const node of nodes) {
    if (!node.jobId) {
      continue;
    }

    counts.set(node.jobId, (counts.get(node.jobId) ?? 0) + 1);
  }

  return counts;
}

export function buildNodeIdsByJob(nodes: Node[]) {
  const nodeIdsByJob = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.jobId) {
      continue;
    }

    const current = nodeIdsByJob.get(node.jobId);
    if (current) {
      current.push(node.id);
      continue;
    }

    nodeIdsByJob.set(node.jobId, [node.id]);
  }

  return nodeIdsByJob;
}

export function buildJobSwarmGroups(jobs: Job[], jobNodeCountMap: Map<string, number>): JobSwarmGroup[] {
  return jobs
    .map((job) => ({
      id: job.id,
      donors: jobNodeCountMap.get(job.id) ?? 0,
      workers: job.workerIds.length,
      shards: getJobShardCount(job),
      flows: getJobFlowCount(job),
      state: job.state,
      tone: getJobAccent(job.id, job.state),
    }))
    .sort((left, right) => {
      const leftActive = left.state === "training" || left.state === "evaluating" ? 1 : 0;
      const rightActive = right.state === "training" || right.state === "evaluating" ? 1 : 0;

      if (leftActive !== rightActive) {
        return rightActive - leftActive;
      }

      if (left.donors !== right.donors) {
        return right.donors - left.donors;
      }

      return left.id.localeCompare(right.id);
    });
}

export function buildProtocolPhaseMetrics(
  workers: Worker[],
  jobs: Job[],
  nodes: Node[],
  tape: TapeEntry[],
): ProtocolPhaseMetric[] {
  const queuedJobs = jobs.filter((job) => job.state === "queued");
  const trainingWorkers = workers.filter((worker) => worker.state === "training");
  const evaluatingWorkers = workers.filter((worker) => worker.state === "evaluating");
  const settledWorkers = workers.filter(
    (worker) =>
      worker.state === "keep" || worker.state === "discard" || worker.state === "crash",
  );
  const claimedDonors = nodes.filter((node) => node.jobId && node.state !== "training").length;
  const hotDonors = nodes.filter((node) => node.state === "training").length;
  const evaluatingJobs = jobs.filter((job) => job.state === "evaluating");
  const keepCount = tape.filter((entry) => entry.result === "keep").length;
  const discardCount = tape.filter((entry) => entry.result === "discard").length;
  const crashCount = tape.filter((entry) => entry.result === "crash").length;

  return [
    {
      label: "Claim",
      tone: "#9fb4d8",
      value: queuedJobs.length + workers.filter((worker) => worker.state === "patching").length,
      detail: `${claimedDonors.toLocaleString()} donors reserved`,
    },
    {
      label: "Train",
      tone: "#33d1ff",
      value: trainingWorkers.length,
      detail: `${hotDonors.toLocaleString()} donors burning compute`,
    },
    {
      label: "Verify",
      tone: "#ffb44d",
      value: evaluatingWorkers.length,
      detail: `${evaluatingJobs.length} jobs reducing / checking`,
    },
    {
      label: "Payout",
      tone: "#2ad47d",
      value: settledWorkers.length,
      detail: `${keepCount} keep · ${discardCount} discard · ${crashCount} crash`,
    },
  ];
}

export function buildJobOutcomeStateMap(
  jobs: Job[],
  workers: Worker[],
  tape?: TapeEntry[],
): Map<string, JobOutcomeState> {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const outcomeByJobId = new Map<string, JobOutcomeState>();
  const rank: Record<Exclude<JobOutcomeState, null>, number> = {
    keep: 3,
    discard: 2,
    crash: 4,
  };

  for (const job of jobs) {
    let strongestOutcome: JobOutcomeState = null;

    for (const workerId of job.workerIds) {
      const worker = workerById.get(workerId);
      if (
        worker &&
        (worker.state === "keep" || worker.state === "discard" || worker.state === "crash")
      ) {
        if (!strongestOutcome || rank[worker.state] > rank[strongestOutcome]) {
          strongestOutcome = worker.state;
        }
      }
    }

    if (tape) {
      for (const entry of tape) {
        if (!job.workerIds.includes(entry.workerId)) {
          continue;
        }
        if (!strongestOutcome || rank[entry.result] > rank[strongestOutcome]) {
          strongestOutcome = entry.result;
        }
      }
    }

    outcomeByJobId.set(job.id, strongestOutcome);
  }

  return outcomeByJobId;
}

export function buildJobStageMetrics(jobState: JobState, outcomeState: JobOutcomeState): JobStageMetric[] {
  return [
    {
      label: "Claim",
      tone: "#8ea0bf",
      done: true,
      active: jobState === "queued",
    },
    {
      label: "Train",
      tone: "#33d1ff",
      done: jobState === "training" || jobState === "evaluating" || jobState === "done",
      active: jobState === "training",
    },
    {
      label: "Verify",
      tone: "#ffb44d",
      done: jobState === "evaluating" || jobState === "done",
      active: jobState === "evaluating",
    },
    {
      label: "Payout",
      tone: outcomeState ? tapeTone[outcomeState] : "#2ad47d",
      done: outcomeState !== null || jobState === "done",
      active: outcomeState !== null || jobState === "done",
    },
  ];
}

export function buildScaledNodes(
  nodes: Node[],
  jobs: Job[],
  targetCount: number,
  ceilingCount: number,
  clock: number,
) {
  if (nodes.length === 0 || ceilingCount <= nodes.length || targetCount <= nodes.length) {
    return nodes;
  }

  const scaled = [...nodes];
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const activeJobs = jobs.filter((job) => job.state !== "done");
  const syntheticCapacity = Math.max(0, ceilingCount - nodes.length);
  const syntheticVisibleCount = Math.min(
    syntheticCapacity,
    Math.max(0, targetCount - nodes.length),
  );
  const globalVisibility =
    syntheticCapacity > 0
      ? THREE.MathUtils.clamp(syntheticVisibleCount / syntheticCapacity, 0, 1)
      : 0;
  const centers: MeshCenter[] = [
    ...donorHotspots.map((spot, index) => ({
      key: `pool-${index}`,
      lat: spot.lat,
      lng: spot.lng,
      spreadLat: spot.spreadLat,
      spreadLng: spot.spreadLng,
      weight: 1 + hashNoise((index + 1) * 4.17) * 0.55,
      cadence: 0.12 + hashNoise((index + 1) * 2.71) * 0.08,
      phase: hashNoise((index + 1) * 8.17) * Math.PI * 2,
      seed: (index + 1) * 17.21,
      meshRegion: spot.region,
      kind: "pool" as const,
    })),
    ...nodes.map((node, index) => ({
      key: `node-${node.id}`,
      lat: node.lat,
      lng: node.lng,
      spreadLat: 4.1,
      spreadLng: 6.9,
      weight: 0.8 + node.gpu * 0.35,
      cadence: 0.16 + hashNoise((index + 1) * 5.13) * 0.09,
      phase: hashNoise((index + 1) * 9.11) * Math.PI * 2,
      seed: stringHash(node.id) * 1.13,
      jobId: node.jobId,
      meshRegion: resolveMeshRegion(node.lat, node.lng),
      kind: "node" as const,
    })),
    ...activeJobs.map((job, index) => ({
      key: `job-${job.id}`,
      lat: job.hubLat,
      lng: job.hubLng,
      spreadLat: job.state === "training" ? 5.1 : 6.4,
      spreadLng: job.state === "training" ? 7.2 : 8.7,
      weight: job.state === "training" ? 3.6 : job.state === "evaluating" ? 2.8 : 1.8,
      cadence: 0.2 + hashNoise((index + 1) * 6.37) * 0.07,
      phase: hashNoise((index + 1) * 11.17) * Math.PI * 2,
      seed: stringHash(job.id) * 1.91,
      jobId: job.id,
      meshRegion: resolveMeshRegion(job.hubLat, job.hubLng),
      kind: "job" as const,
    })),
  ];

  const centerWeights = centers.map((center) => {
    const capacityBias =
      center.kind === "job" ? 1.28 : center.kind === "node" ? 0.92 : 1.05;
    const score = center.weight * capacityBias;

    return {
      center,
      score,
    };
  });
  const totalScore = Math.max(
    1e-6,
    centerWeights.reduce((sum, entry) => sum + entry.score, 0),
  );
  const centerQuotas = centerWeights.map((entry) => ({
    ...entry,
    exact: (entry.score / totalScore) * syntheticCapacity,
  }));

  const capacityQuotas = centerQuotas.map((entry) => Math.floor(entry.exact));
  let remainder = syntheticCapacity - capacityQuotas.reduce((sum, quota) => sum + quota, 0);
  const remainderOrder = centerQuotas
    .map((entry, index) => ({ index, remainder: entry.exact - capacityQuotas[index] }))
    .sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; index < remainderOrder.length && remainder > 0; index += 1) {
    capacityQuotas[remainderOrder[index].index] += 1;
    remainder -= 1;
  }

  const visibleCenterQuotas = centerQuotas.map((entry, centerIndex) => {
    const regionLead =
      entry.center.meshRegion === "apac"
        ? 0.02
        : entry.center.meshRegion === "emea"
          ? 0.08
          : 0.14;
    const regionWindow =
      entry.center.kind === "job"
        ? 0.34
        : entry.center.kind === "node"
          ? 0.28
          : 0.24;
    const regionalPulse = getRegionPulse(clock, entry.center.meshRegion);
    const localPulse = smoothPulse(oscillate01(clock * entry.center.cadence + entry.center.phase));
    const ramp = THREE.MathUtils.clamp((globalVisibility - regionLead) / regionWindow, 0, 1);
    const visibility = THREE.MathUtils.clamp(
      globalVisibility * 0.64 + ramp * 0.24 + regionalPulse * 0.08 + localPulse * 0.04,
      0,
      1,
    );

    return {
      ...entry,
      activity:
        entry.center.kind === "job"
          ? 0.4 + visibility * 1.24
          : entry.center.kind === "node"
            ? 0.22 + visibility * 0.72
            : 0.18 + visibility * 0.56,
      exactVisible: capacityQuotas[centerIndex] * visibility,
    };
  });

  const quotas = visibleCenterQuotas.map((entry) => Math.floor(entry.exactVisible));
  remainder = syntheticVisibleCount - quotas.reduce((sum, quota) => sum + quota, 0);
  const visibleRemainderOrder = visibleCenterQuotas
    .map((entry, index) => ({ index, remainder: entry.exactVisible - quotas[index] }))
    .sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; index < visibleRemainderOrder.length && remainder > 0; index += 1) {
    quotas[visibleRemainderOrder[index].index] += 1;
    remainder -= 1;
  }

  for (const [centerIndex, entry] of centerQuotas.entries()) {
    const quota = quotas[centerIndex];
    if (quota <= 0) {
      continue;
    }

    const center = entry.center;
    const linkedJob = center.jobId ? jobById.get(center.jobId) ?? null : null;

    for (let localIndex = 0; localIndex < quota; localIndex += 1) {
      const template = nodes[(centerIndex + localIndex) % nodes.length];
      const spreadScale = 0.52 + hashNoise(center.seed * 0.73 + localIndex * 0.31) * 1.18;
      const latOffset =
        normalNoise(center.seed * 0.91 + localIndex * 0.37, center.seed * 1.27 + localIndex * 0.53) *
        center.spreadLat *
        spreadScale;
      const lat = THREE.MathUtils.clamp(center.lat + latOffset, -79, 79);
      const lngOffset =
        normalNoise(center.seed * 1.61 + localIndex * 0.49, center.seed * 2.17 + localIndex * 0.67) *
        center.spreadLng *
        spreadScale *
        (1 / Math.max(Math.cos(THREE.MathUtils.degToRad(Math.abs(lat))), 0.4));
      const lng = wrapLongitude(center.lng + lngOffset);
      const assignmentRoll = hashNoise(center.seed * 2.31 + localIndex * 0.83);
      const ambientJob =
        !linkedJob &&
        activeJobs.length > 0 &&
        assignmentRoll < 0.04 + visibleCenterQuotas[centerIndex].activity * 0.09
          ? activeJobs[
              Math.floor(hashNoise(center.seed * 3.47 + localIndex * 1.17) * activeJobs.length)
            ] ??
            null
          : null;
      const assignedJob = linkedJob ?? ambientJob;
      const state: NodeState = assignedJob
        ? assignedJob.state === "training" && assignmentRoll < 0.34
          ? "training"
          : assignedJob.state === "evaluating"
            ? "assigned"
            : assignmentRoll < 0.18
              ? "cooldown"
              : "assigned"
        : assignmentRoll < 0.14
          ? "online"
          : assignmentRoll < 0.2
            ? "cooldown"
            : "available";

      scaled.push({
        id: `ambient-${center.key}-${localIndex}`,
        lat,
        lng,
        cpu: Math.max(8, template.cpu + ((localIndex % 5) - 2) * 2),
        gpu: localIndex % 19 === 0 ? Math.max(2, template.gpu) : template.gpu,
        memGb: Math.max(16, template.memGb + ((localIndex % 4) - 1) * 8),
        state,
        jobId: assignedJob?.id,
      });
    }
  }

  return scaled;
}

export function buildDecoratedNodeIdSet(
  nodes: Node[],
  workers: Worker[],
  selectedNodeId: string | null,
) {
  const workerByNodeId = new Map(workers.map((worker) => [worker.nodeId, worker]));
  const budget = Math.min(220, Math.max(72, Math.floor(nodes.length * 0.05)));

  return new Set(
    nodes
      .map((node) => {
        const worker = workerByNodeId.get(node.id) ?? null;
        const isSelected = node.id === selectedNodeId;
        const isAssigned = worker
          ? worker.state === "patching" || isWorkerActiveState(worker.state)
          : node.state === "assigned" || node.state === "training";
        const isHot = worker
          ? worker.state === "training" ||
            worker.state === "evaluating" ||
            worker.state === "keep" ||
            worker.state === "discard" ||
            worker.state === "crash"
          : node.state === "training";
        const isSettled =
          worker?.state === "keep" || worker?.state === "discard" || worker?.state === "crash";

        const priority =
          (isSelected ? 1000 : 0) +
          (isSettled ? 520 : 0) +
          (isHot ? 360 : 0) +
          (isAssigned ? 110 : 0) +
          node.gpu * 18 +
          hashNoise(stringHash(node.id) * 0.37) * 6;

        return {
          id: node.id,
          priority,
        };
      })
      .filter((entry) => entry.priority > 0)
      .sort((left, right) => right.priority - left.priority)
      .slice(0, budget)
      .map((entry) => entry.id),
  );
}

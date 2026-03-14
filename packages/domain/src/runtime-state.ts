import type {
  CreateRuntimeJobInput,
  RuntimeEvent,
  RuntimeJob,
  RuntimeJobCommand,
  RuntimeSnapshot,
} from "../../contracts/src/index.ts";

export type RuntimeState = {
  jobs: Record<string, RuntimeJob>;
  jobOrder: string[];
  eventsByJob: Record<string, RuntimeEvent[]>;
};

export function createRuntimeState(): RuntimeState {
  return {
    jobs: {},
    jobOrder: [],
    eventsByJob: {},
  };
}

export function createRuntimeJob(input: CreateRuntimeJobInput): RuntimeJob {
  return {
    id: input.id,
    topic: input.topic,
    surface: input.surface ?? "web",
    status: "running",
    source: input.source ?? "manual",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    lastCommandAt: null,
    progress: {
      completed: 0,
      total: input.totalExperiments ?? null,
    },
    bestMetric: null,
    boostedCategories: [],
    pausedCategories: [],
  };
}

export function applyRuntimeEvent(state: RuntimeState, event: RuntimeEvent): RuntimeState {
  const next: RuntimeState = {
    jobs: { ...state.jobs },
    jobOrder: [...state.jobOrder],
    eventsByJob: { ...state.eventsByJob },
  };

  switch (event.type) {
    case "job.created": {
      next.jobs[event.job.id] = event.job;
      if (!next.jobOrder.includes(event.job.id)) {
        next.jobOrder.unshift(event.job.id);
      }
      next.eventsByJob[event.job.id] = [...(state.eventsByJob[event.job.id] ?? []), event];
      return next;
    }
    case "job.updated": {
      next.jobs[event.job.id] = event.job;
      if (!next.jobOrder.includes(event.job.id)) {
        next.jobOrder.unshift(event.job.id);
      }
      next.eventsByJob[event.job.id] = [...(state.eventsByJob[event.job.id] ?? []), event];
      return next;
    }
    case "job.command.accepted": {
      next.eventsByJob[event.jobId] = [...(state.eventsByJob[event.jobId] ?? []), event];
      return next;
    }
    case "runtime.snapshot": {
      return next;
    }
  }
}

export function applyJobCommand(job: RuntimeJob, command: RuntimeJobCommand, appliedAt: string): RuntimeJob {
  switch (command.type) {
    case "pause":
      return { ...job, status: "paused", updatedAt: appliedAt, lastCommandAt: appliedAt };
    case "resume":
      return { ...job, status: "running", updatedAt: appliedAt, lastCommandAt: appliedAt };
    case "stop":
      return { ...job, status: "stopped", updatedAt: appliedAt, lastCommandAt: appliedAt };
    case "boost_category":
      return {
        ...job,
        updatedAt: appliedAt,
        lastCommandAt: appliedAt,
        boostedCategories: appendUnique(job.boostedCategories, command.category),
      };
    case "unboost_category":
      return {
        ...job,
        updatedAt: appliedAt,
        lastCommandAt: appliedAt,
        boostedCategories: removeItem(job.boostedCategories, command.category),
      };
    case "pause_category":
      return {
        ...job,
        updatedAt: appliedAt,
        lastCommandAt: appliedAt,
        pausedCategories: appendUnique(job.pausedCategories, command.category),
      };
    case "resume_category":
      return {
        ...job,
        updatedAt: appliedAt,
        lastCommandAt: appliedAt,
        pausedCategories: removeItem(job.pausedCategories, command.category),
      };
  }
}

export function listRuntimeJobs(state: RuntimeState): RuntimeJob[] {
  return state.jobOrder.map((jobId) => state.jobs[jobId]).filter(Boolean);
}

export function selectRuntimeJob(state: RuntimeState, jobId: string): RuntimeJob | null {
  return state.jobs[jobId] ?? null;
}

export function selectRuntimeEvents(state: RuntimeState, jobId: string): RuntimeEvent[] {
  return state.eventsByJob[jobId] ?? [];
}

export function createRuntimeSnapshot(state: RuntimeState, generatedAt: string): RuntimeSnapshot {
  return {
    generatedAt,
    jobs: listRuntimeJobs(state),
  };
}

function appendUnique(items: string[], value: string): string[] {
  return items.includes(value) ? items : [...items, value];
}

function removeItem(items: string[], value: string): string[] {
  return items.filter((item) => item !== value);
}

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import type {
  CreateRuntimeJobInput,
  RuntimeMeshSummary,
  RuntimeEvent,
  RuntimeJobCommand,
} from "../../../packages/contracts/src/index.ts";
import {
  inspectAutoresearchRuntimeRoot,
  readAutoresearchStackStatus,
} from "../../../packages/autoresearch-adapter/src/index.ts";
import {
  applyJobCommand,
  applyRuntimeEvent,
  createRuntimeJob,
  createRuntimeSnapshot,
  createRuntimeState,
  listRuntimeJobs,
  selectRuntimeEvents,
  selectRuntimeJob,
} from "../../../packages/domain/src/index.ts";

const port = Number(process.env.RUNTIME_API_PORT ?? "8790");
const defaultRuntimeRoot = process.env.AUTORESEARCH_RUNTIME_ROOT ?? "runtime/autoresearch-loop-live";
let state = createRuntimeState();
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));

const jobClients = new Map<string, Map<string, import("node:http").ServerResponse>>();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${port}`}`);
  const method = request.method ?? "GET";

  if (method === "OPTIONS") {
    writeCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/healthz" || url.pathname === "/api/runtime/health") {
    return json(response, 200, {
      ok: true,
      service: "runtime-api",
      generatedAt: new Date().toISOString(),
      jobs: listRuntimeJobs(state).length,
    });
  }

  if (method === "GET" && url.pathname === "/api/runtime/snapshot") {
    return json(response, 200, createRuntimeSnapshot(state, new Date().toISOString()));
  }

  if (method === "GET" && url.pathname === "/api/runtime/jobs") {
    return json(response, 200, {
      generatedAt: new Date().toISOString(),
      jobs: listRuntimeJobs(state),
    });
  }

  if (method === "GET" && url.pathname === "/api/runtime/workspaces") {
    const mesh = await readMeshSummary(url);
    return json(response, 200, {
      generatedAt: mesh.generatedAt,
      runtimeRoot: mesh.runtimeRoot,
      controller: mesh.controller,
      supervisor: mesh.supervisor,
      workspaces: mesh.workspaces,
      totals: mesh.totals,
    });
  }

  if (method === "GET" && url.pathname === "/api/runtime/upstream") {
    const upstream = await readAutoresearchStackStatus(projectRoot);
    return json(response, 200, upstream);
  }

  if (method === "GET" && url.pathname === "/api/runtime/mesh") {
    return json(response, 200, await readMeshSummary(url));
  }

  if (method === "POST" && url.pathname === "/api/runtime/control") {
    const command = parseCommand(await readJson(request));
    if (!command) {
      return json(response, 400, { error: "invalid command payload" });
    }

    const mesh = await readMeshSummary(url);
    if (!mesh.controller?.port || !mesh.controller.reachable) {
      return json(response, 409, { error: "controller is not reachable", controller: mesh.controller });
    }
    if (mesh.controller.supportsCommands !== true) {
      return json(response, 409, { error: "controller does not support commands in current mode", controller: mesh.controller });
    }

    try {
      const controllerResponse = await postControllerCommand(mesh.controller.port, command);
      const refreshedMesh = await readMeshSummary(url);
      return json(response, 202, {
        ok: true,
        command,
        controllerResponse,
        controller: refreshedMesh.controller,
      });
    } catch (error) {
      return json(response, 502, {
        error: error instanceof Error ? error.message : String(error),
        controller: mesh.controller,
      });
    }
  }

  if (method === "POST" && url.pathname === "/api/runtime/jobs") {
    const body = await readJson(request);
    const topic = typeof body?.topic === "string" && body.topic.trim() ? body.topic.trim() : null;
    if (!topic) {
      return json(response, 400, { error: "topic is required" });
    }

    const now = new Date().toISOString();
    const input: CreateRuntimeJobInput = {
      id: randomUUID(),
      topic,
      surface: body?.surface === "runtime-api" || body?.surface === "protocol" ? body.surface : "web",
      source: body?.source === "autoresearch" ? "autoresearch" : "manual",
      createdAt: now,
      totalExperiments: typeof body?.totalExperiments === "number" ? body.totalExperiments : null,
    };

    const job = createRuntimeJob(input);
    emit({ type: "job.created", ts: now, job });
    return json(response, 201, { job });
  }

  const jobMatch = url.pathname.match(/^\/api\/runtime\/jobs\/([^/]+)$/);
  if (method === "GET" && jobMatch) {
    const job = selectRuntimeJob(state, jobMatch[1]);
    if (!job) {
      return json(response, 404, { error: "job not found" });
    }
    return json(response, 200, { job });
  }

  const eventsMatch = url.pathname.match(/^\/api\/runtime\/jobs\/([^/]+)\/events$/);
  if (method === "GET" && eventsMatch) {
    const jobId = eventsMatch[1];
    const job = selectRuntimeJob(state, jobId);
    if (!job) {
      return json(response, 404, { error: "job not found" });
    }
    return streamJobEvents(jobId, response);
  }

  const commandMatch = url.pathname.match(/^\/api\/runtime\/jobs\/([^/]+)\/commands$/);
  if (method === "POST" && commandMatch) {
    const jobId = commandMatch[1];
    const job = selectRuntimeJob(state, jobId);
    if (!job) {
      return json(response, 404, { error: "job not found" });
    }

    const body = await readJson(request);
    const command = parseCommand(body);
    if (!command) {
      return json(response, 400, { error: "invalid command payload" });
    }

    const now = new Date().toISOString();
    emit({ type: "job.command.accepted", ts: now, jobId, command });
    emit({ type: "job.updated", ts: now, job: applyJobCommand(job, command, now) });
    return json(response, 202, {
      job: selectRuntimeJob(state, jobId),
      command,
    });
  }

  return json(response, 404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`[runtime-api] listening on http://localhost:${port}`);
  console.log(`[runtime-api] health=http://localhost:${port}/api/runtime/health`);
});

function emit(event: RuntimeEvent) {
  state = applyRuntimeEvent(state, event);
  if (event.type === "runtime.snapshot") {
    return;
  }

  const jobId = event.type === "job.command.accepted" ? event.jobId : event.job.id;
  const clients = jobClients.get(jobId);
  if (!clients) {
    return;
  }

  const frame = sseFrame(event.type, event);
  for (const client of clients.values()) {
    client.write(frame);
  }
}

function streamJobEvents(jobId: string, response: import("node:http").ServerResponse) {
  const clientId = randomUUID();
  writeCors(response);
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  response.write(sseFrame("snapshot", createRuntimeSnapshot(state, new Date().toISOString())));
  for (const event of selectRuntimeEvents(state, jobId)) {
    response.write(sseFrame(event.type, event));
  }

  let bucket = jobClients.get(jobId);
  if (!bucket) {
    bucket = new Map();
    jobClients.set(jobId, bucket);
  }
  bucket.set(clientId, response);

  response.on("close", () => {
    const current = jobClients.get(jobId);
    current?.delete(clientId);
    if (current && current.size === 0) {
      jobClients.delete(jobId);
    }
  });
}

function parseCommand(input: unknown): RuntimeJobCommand | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = input as Record<string, unknown>;
  const type = typeof value.type === "string" ? value.type : null;
  const category = typeof value.category === "string" && value.category.trim() ? value.category.trim() : null;

  switch (type) {
    case "pause":
    case "resume":
    case "stop":
      return { type };
    case "boost_category":
    case "unboost_category":
    case "pause_category":
    case "resume_category":
      return category ? { type, category } : null;
    default:
      return null;
  }
}

function sseFrame(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function writeCors(response: import("node:http").ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
}

function json(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  writeCors(response);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

async function readMeshSummary(url: URL): Promise<RuntimeMeshSummary> {
  const runtimeRoot = url.searchParams.get("runtimeRoot")?.trim() || defaultRuntimeRoot;
  return inspectAutoresearchRuntimeRoot(projectRoot, runtimeRoot);
}

async function postControllerCommand(port: number, command: RuntimeJobCommand): Promise<unknown> {
  const response = await fetch(`http://localhost:${port}/commands`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(command),
  });

  const raw = await response.text();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `controller command failed (${response.status})`);
  }
  return payload;
}

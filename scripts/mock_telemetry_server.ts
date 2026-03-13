import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  convertAutoresearchToTelemetry,
  parseCliArgs,
} from "./autoresearch_to_telemetry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const fixturePath = resolve(rootDir, "fixtures/events.ndjson");

const args = parseCliArgs(process.argv.slice(2));

const port = Number(args.get("port")?.[0] ?? "8787");
const intervalMs = Number(args.get("interval")?.[0] ?? "800");

type Client = {
  id: string;
  response: import("node:http").ServerResponse<import("node:http").IncomingMessage>;
  timer: NodeJS.Timeout | null;
};

async function main() {
  const { events, source } = await loadEventLines();

  if (events.length === 0) {
    throw new Error("No events found for the configured telemetry source.");
  }

  const clients = new Map<string, Client>();

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/healthz") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({ ok: true, clients: clients.size, events: events.length }));
      return;
    }

    if (url.pathname !== "/events") {
      response.writeHead(404, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const loop = url.searchParams.get("loop") !== "false";
    const startIndex = Math.max(0, Number(url.searchParams.get("from") ?? "0"));
    const clientId = crypto.randomUUID();

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });

    response.write(`retry: 1500\n`);
    response.write(`event: meta\n`);
      response.write(
        `data: ${JSON.stringify({
          clientId,
          loop,
          intervalMs,
          events: events.length,
          source,
        })}\n\n`,
      );

    let cursor = startIndex;

    const timer = setInterval(() => {
      if (cursor >= events.length) {
        if (!loop) {
          response.write(`event: done\n`);
          response.write(`data: {"clientId":"${clientId}","events":${events.length}}\n\n`);
          cleanupClient(clientId, clients);
          return;
        }
        cursor = 0;
      }

      const payload = events[cursor];
      response.write(`data: ${payload}\n\n`);
      cursor += 1;
    }, intervalMs);

    clients.set(clientId, {
      id: clientId,
      response,
      timer,
    });

    request.on("close", () => {
      cleanupClient(clientId, clients);
    });
  });

  server.listen(port, () => {
    console.log(`Mock telemetry server listening on http://localhost:${port}`);
    console.log(`SSE endpoint: http://localhost:${port}/events`);
    console.log(`Health check: http://localhost:${port}/healthz`);
    console.log(`Interval: ${intervalMs}ms`);
    console.log(`Source: ${sourceLabel()}`);
  });
}

async function loadEventLines(): Promise<{ events: string[]; source: string }> {
  const eventsFile = args.get("events-file")?.[0];
  const autoresearchRoot = args.get("autoresearch-root")?.[0];
  const workspaces = args.get("workspace");
  const manifest = args.get("manifest")?.[0];
  const baseTs = args.get("base-ts")?.[0];
  const workspaceSpacingMs = Number(args.get("workspace-spacing-ms")?.[0] ?? "220");

  if (autoresearchRoot || (workspaces?.length ?? 0) > 0) {
    const events = await convertAutoresearchToTelemetry({
      workspaceRoot: autoresearchRoot
        ? resolveInputPath(autoresearchRoot)
        : undefined,
      workspaces: workspaces?.map((workspace) => resolveInputPath(workspace)),
      manifestPath: manifest ? resolveInputPath(manifest) : undefined,
      baseTs,
      workspaceSpacingMs,
    });

    return {
      events: events.map((event) => JSON.stringify(event)),
      source: "autoresearch",
    };
  }

  const sourcePath = eventsFile ? resolveInputPath(eventsFile) : fixturePath;
  const fixtureText = await readFile(sourcePath, "utf8");
  return {
    events: fixtureText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    source: sourcePath === fixturePath ? "fixture" : sourcePath,
  };
}

function sourceLabel(): string {
  if (args.get("autoresearch-root")?.[0] || (args.get("workspace")?.length ?? 0) > 0) {
    return "autoresearch";
  }

  return args.get("events-file")?.[0] ?? fixturePath;
}

function resolveInputPath(inputPath: string): string {
  return inputPath.startsWith("/") ? inputPath : resolve(rootDir, inputPath);
}

function cleanupClient(clientId: string, clients: Map<string, Client>) {
  const client = clients.get(clientId);
  if (!client) {
    return;
  }

  if (client.timer) {
    clearInterval(client.timer);
  }

  if (!client.response.writableEnded) {
    client.response.end();
  }

  clients.delete(clientId);
}

await main();

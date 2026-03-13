import { applyTelemetryEvent, cloneModel, createEmptyModel } from "./telemetry.ts";
import type { TelemetryEvent, VisualizerModel } from "./types.ts";

export const demoFixtureText = `{"ts":"2026-03-13T01:00:00.000Z","type":"node.online","node":{"id":"node-seoul-1","lat":37.5665,"lng":126.9780,"cpu":16,"gpu":1,"memGb":32}}
{"ts":"2026-03-13T01:00:00.200Z","type":"node.online","node":{"id":"node-singapore-1","lat":1.3521,"lng":103.8198,"cpu":24,"gpu":2,"memGb":64}}
{"ts":"2026-03-13T01:00:00.400Z","type":"node.online","node":{"id":"node-berlin-1","lat":52.5200,"lng":13.4050,"cpu":32,"gpu":1,"memGb":48}}
{"ts":"2026-03-13T01:00:00.600Z","type":"node.available","nodeId":"node-seoul-1"}
{"ts":"2026-03-13T01:00:00.800Z","type":"node.available","nodeId":"node-singapore-1"}
{"ts":"2026-03-13T01:00:01.000Z","type":"node.available","nodeId":"node-berlin-1"}
{"ts":"2026-03-13T01:00:01.200Z","type":"worker.started","worker":{"id":"worker-a","gpuLabel":"RTX 4090","region":"Seoul","nodeId":"node-seoul-1","experimentId":"exp-104","state":"patching","progress":0.08}}
{"ts":"2026-03-13T01:00:01.400Z","type":"worker.started","worker":{"id":"worker-b","gpuLabel":"RTX 4080","region":"Singapore","nodeId":"node-singapore-1","experimentId":"exp-105","state":"patching","progress":0.05}}
{"ts":"2026-03-13T01:00:01.600Z","type":"worker.started","worker":{"id":"worker-c","gpuLabel":"A100 80GB","region":"Berlin","nodeId":"node-berlin-1","experimentId":"exp-106","state":"patching","progress":0.03}}
{"ts":"2026-03-13T01:00:02.000Z","type":"job.created","job":{"id":"job-201","hubLat":22.3193,"hubLng":114.1694,"workerIds":["worker-a","worker-b"],"nodeIds":["node-seoul-1","node-singapore-1"],"state":"queued"}}
{"ts":"2026-03-13T01:00:02.500Z","type":"worker.state","workerId":"worker-a","state":"training","progress":0.22}
{"ts":"2026-03-13T01:00:02.700Z","type":"worker.state","workerId":"worker-b","state":"training","progress":0.18}
{"ts":"2026-03-13T01:00:02.900Z","type":"node.assigned","nodeId":"node-seoul-1","jobId":"job-201"}
{"ts":"2026-03-13T01:00:03.100Z","type":"node.assigned","nodeId":"node-singapore-1","jobId":"job-201"}
{"ts":"2026-03-13T01:00:03.300Z","type":"job.state","jobId":"job-201","state":"training"}
{"ts":"2026-03-13T01:00:04.200Z","type":"worker.state","workerId":"worker-c","state":"training","progress":0.31}
{"ts":"2026-03-13T01:00:04.800Z","type":"job.created","job":{"id":"job-202","hubLat":40.4168,"hubLng":-3.7038,"workerIds":["worker-c"],"nodeIds":["node-berlin-1"],"state":"training"}}
{"ts":"2026-03-13T01:00:05.500Z","type":"worker.state","workerId":"worker-a","state":"evaluating","progress":0.91,"metric":1.8721,"metricDelta":-0.0032}
{"ts":"2026-03-13T01:00:05.900Z","type":"job.state","jobId":"job-201","state":"evaluating"}
{"ts":"2026-03-13T01:00:06.400Z","type":"worker.result","workerId":"worker-a","state":"keep","metric":1.8721,"metricDelta":-0.0032}
{"ts":"2026-03-13T01:00:06.500Z","type":"experiment.result","experimentId":"exp-104","workerId":"worker-a","result":"keep","metricDelta":-0.0032}
{"ts":"2026-03-13T01:00:06.800Z","type":"worker.state","workerId":"worker-b","state":"evaluating","progress":0.94,"metric":1.8814,"metricDelta":0.0018}
{"ts":"2026-03-13T01:00:07.200Z","type":"worker.result","workerId":"worker-b","state":"discard","metric":1.8814,"metricDelta":0.0018}
{"ts":"2026-03-13T01:00:07.300Z","type":"experiment.result","experimentId":"exp-105","workerId":"worker-b","result":"discard","metricDelta":0.0018}
{"ts":"2026-03-13T01:00:07.800Z","type":"worker.result","workerId":"worker-c","state":"crash"}
{"ts":"2026-03-13T01:00:07.900Z","type":"experiment.result","experimentId":"exp-106","workerId":"worker-c","result":"crash"}`;

export function parseNdjson(text: string): TelemetryEvent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelemetryEvent);
}

export function buildModelFromEvents(events: TelemetryEvent[]): VisualizerModel {
  const model = createEmptyModel();

  for (const event of events) {
    applyTelemetryEvent(model, event);
  }

  return model;
}

export function buildModelFromFixtureText(text: string): VisualizerModel {
  return buildModelFromEvents(parseNdjson(text));
}

export function createFixturePlayback(events: TelemetryEvent[]): VisualizerModel[] {
  const playback: VisualizerModel[] = [];
  const model = createEmptyModel();

  for (const event of events) {
    applyTelemetryEvent(model, event);
    playback.push(cloneModel(model));
  }

  return playback;
}

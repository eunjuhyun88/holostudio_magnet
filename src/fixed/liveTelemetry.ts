import { applyTelemetryEvent, cloneModel, createEmptyModel } from "./telemetry.ts";
import type { TelemetryEvent, VisualizerModel } from "./types.ts";

type SnapshotListener = (model: VisualizerModel, event: TelemetryEvent) => void;
type ErrorListener = (error: Event | Error) => void;

export function resolveTelemetryUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const queryUrl = params.get("telemetry");
  return window.__MESH_TELEMETRY_URL__ ?? queryUrl ?? null;
}

export function connectTelemetryStream({
  url,
  onSnapshot,
  onError,
}: {
  url: string;
  onSnapshot: SnapshotListener;
  onError?: ErrorListener;
}) {
  const source = new EventSource(url);
  const model = createEmptyModel();

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as TelemetryEvent;
      applyTelemetryEvent(model, event);
      onSnapshot(cloneModel(model), event);
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error);
      } else {
        onError?.(new Error("Unknown telemetry parse error"));
      }
    }
  };

  source.onerror = (event) => {
    onError?.(event);
  };

  return {
    unsubscribe() {
      source.close();
    },
  };
}

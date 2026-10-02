import type { DtTelemetry, Telemetry } from "./types";

/**
 * Non-React subscribe/publish store (C4). Map layers read this directly and restyle Leaflet
 * elements imperatively (see `src/lib/map/lens.ts`) so a once-per-second simulation tick never
 * triggers a React re-render of the whole map tree. This is a plain closure, not a context.
 */
export interface TelemetryStore {
  getSnapshot(): Telemetry;
  subscribe(listener: (snapshot: Telemetry) => void): () => void;
}

/** Write side, used by the live stream (C4) and by tests/demos. */
export interface TelemetryPublisher extends TelemetryStore {
  publish(items: readonly DtTelemetry[], simNowIso: string | null, receivedAt?: number): void;
}

export function createTelemetryStore(): TelemetryPublisher {
  let snapshot: Telemetry = { receivedAt: 0, simNowIso: null, items: [] };
  const listeners = new Set<(s: Telemetry) => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(items, simNowIso, receivedAt = typeof performance !== "undefined" ? performance.now() : Date.now()) {
      snapshot = { receivedAt, simNowIso, items };
      listeners.forEach((l) => l(snapshot));
    },
  };
}

/** Look up one DT's latest telemetry tuple from a snapshot without allocating a Map. */
export function findDtTelemetry(snapshot: Telemetry, dtId: string): DtTelemetry | null {
  for (const item of snapshot.items) {
    if (item[0] === dtId) return item;
  }
  return null;
}

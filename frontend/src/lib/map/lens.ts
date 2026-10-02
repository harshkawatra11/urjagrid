import type { CircleMarker, PathOptions } from "leaflet";
import type { TelemetryStore } from "@/lib/live/telemetry-store";
import type { DtTelemetry } from "@/lib/live/types";
import { cssVar, RISK_LEVEL_COLOR_VAR, type RiskLevel } from "@/lib/domain";

/**
 * Imperative Leaflet restyling helper (C7). Map layers register their Leaflet element handles
 * here by DT id; `attachTelemetryLens` then subscribes to the telemetry store and restyles those
 * handles directly on every tick. This deliberately bypasses React state so a once-per-second
 * (or faster) simulation tick never re-renders the map's component tree.
 */

const dtMarkers = new Map<string, CircleMarker>();

/** Called by `DtLayer` (and any other layer with a per-DT Leaflet handle) on mount/unmount. */
export function registerDtMarker(dtId: string, marker: CircleMarker | null): void {
  if (marker) dtMarkers.set(dtId, marker);
  else dtMarkers.delete(dtId);
}

export function getRegisteredDtMarker(dtId: string): CircleMarker | undefined {
  return dtMarkers.get(dtId);
}

export function clearDtMarkerRegistry(): void {
  dtMarkers.clear();
}

/** Pure: maps a DT's live loading (pu of rating) to a risk bucket, independent of its static riskLevel. */
export function loadingToRiskLevel(loadingPu: number): RiskLevel {
  if (loadingPu >= 1.3) return "critical";
  if (loadingPu >= 1.1) return "high";
  if (loadingPu >= 0.9) return "moderate";
  return "low";
}

/** Pure: computes the Leaflet path style for one DT telemetry tuple. Exported for unit testing. */
export function styleForTelemetry(item: DtTelemetry, selected: boolean): PathOptions {
  const loadingPu = item[1];
  const level = loadingToRiskLevel(loadingPu);
  const color = cssVar(RISK_LEVEL_COLOR_VAR[level]);
  return {
    color: selected ? "var(--brand)" : color,
    weight: selected ? 3 : 1.5,
    fillColor: color,
    fillOpacity: 0.85,
  };
}

/** Pure: computes the marker radius for one DT telemetry tuple, scaling gently with loading. */
export function radiusForTelemetry(item: DtTelemetry, selected: boolean): number {
  const loadingPu = item[1];
  const base = selected ? 10 : 7;
  return base + Math.max(0, Math.min(4, (loadingPu - 1) * 6));
}

/**
 * Subscribes to the telemetry store and restyles every registered DT marker on each tick.
 * Returns an unsubscribe function. Safe to call with an empty registry (no-op per tick).
 */
export function attachTelemetryLens(store: TelemetryStore, selectedDtId?: string | null): () => void {
  return store.subscribe((snapshot) => {
    for (const item of snapshot.items) {
      const marker = dtMarkers.get(item[0]);
      if (!marker) continue;
      const selected = item[0] === selectedDtId;
      marker.setStyle(styleForTelemetry(item, selected));
      marker.setRadius(radiusForTelemetry(item, selected));
    }
  });
}

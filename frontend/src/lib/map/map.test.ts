import { describe, expect, it, vi } from "vitest";
import { bearing, lerpLatLng, tickFraction } from "./geo";
import {
  attachTelemetryLens,
  clearDtMarkerRegistry,
  getRegisteredDtMarker,
  loadingToRiskLevel,
  radiusForTelemetry,
  registerDtMarker,
  styleForTelemetry,
} from "./lens";
import { createTelemetryStore } from "@/lib/live/telemetry-store";
import type { CircleMarker } from "leaflet";

describe("geo helpers", () => {
  it("lerpLatLng interpolates and clamps t", () => {
    expect(lerpLatLng([0, 0], [10, 10], 0.5)).toEqual([5, 5]);
    expect(lerpLatLng([0, 0], [10, 10], 2)).toEqual([10, 10]);
    expect(lerpLatLng([0, 0], [10, 10], -1)).toEqual([0, 0]);
  });

  it("bearing is 0 due north and ~90 due east", () => {
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(0, 0);
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(90, 0);
  });

  it("tickFraction clamps to 0..1", () => {
    expect(tickFraction(1500, 1000, 1000)).toBeCloseTo(0.5);
    expect(tickFraction(500, 1000, 1000)).toBe(0);
    expect(tickFraction(3000, 1000, 1000)).toBe(1);
  });
});

describe("telemetry lens", () => {
  it("loadingToRiskLevel buckets by pu thresholds", () => {
    expect(loadingToRiskLevel(0.5)).toBe("low");
    expect(loadingToRiskLevel(0.95)).toBe("moderate");
    expect(loadingToRiskLevel(1.15)).toBe("high");
    expect(loadingToRiskLevel(1.35)).toBe("critical");
  });

  it("styleForTelemetry highlights the selected DT", () => {
    const normal = styleForTelemetry(["dt_1", 0.5, 90, 1.0, 0.95], false);
    const selected = styleForTelemetry(["dt_1", 0.5, 90, 1.0, 0.95], true);
    expect(normal.color).not.toBe("var(--brand)");
    expect(selected.color).toBe("var(--brand)");
  });

  it("radiusForTelemetry grows with loading and selection", () => {
    const base = radiusForTelemetry(["dt_1", 1.0, 90, 1.0, 0.95], false);
    const loaded = radiusForTelemetry(["dt_1", 1.3, 90, 1.0, 0.95], false);
    const selected = radiusForTelemetry(["dt_1", 1.0, 90, 1.0, 0.95], true);
    expect(loaded).toBeGreaterThan(base);
    expect(selected).toBeGreaterThan(base);
  });

  it("registers and clears DT marker handles", () => {
    clearDtMarkerRegistry();
    const fakeMarker = { setStyle: vi.fn(), setRadius: vi.fn() } as unknown as CircleMarker;
    registerDtMarker("dt_1", fakeMarker);
    expect(getRegisteredDtMarker("dt_1")).toBe(fakeMarker);
    registerDtMarker("dt_1", null);
    expect(getRegisteredDtMarker("dt_1")).toBeUndefined();
  });

  it("attachTelemetryLens restyles registered markers imperatively on each tick, without React", () => {
    clearDtMarkerRegistry();
    const fakeMarker = { setStyle: vi.fn(), setRadius: vi.fn() } as unknown as CircleMarker;
    registerDtMarker("dt_1", fakeMarker);
    const store = createTelemetryStore();
    const detach = attachTelemetryLens(store, "dt_1");
    store.publish([["dt_1", 1.2, 100, 0.97, 0.9]], null);
    expect(fakeMarker.setStyle).toHaveBeenCalledTimes(1);
    expect(fakeMarker.setRadius).toHaveBeenCalledTimes(1);
    detach();
    store.publish([["dt_1", 1.3, 110, 0.95, 0.85]], null);
    expect(fakeMarker.setStyle).toHaveBeenCalledTimes(1);
    clearDtMarkerRegistry();
  });

  it("is a no-op when no marker is registered for a telemetry id", () => {
    clearDtMarkerRegistry();
    const store = createTelemetryStore();
    const detach = attachTelemetryLens(store);
    expect(() => store.publish([["dt_unregistered", 1.0, 90, 1.0, 0.9]], null)).not.toThrow();
    detach();
  });
});

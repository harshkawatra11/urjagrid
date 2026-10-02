import { describe, expect, it, vi } from "vitest";
import { createTelemetryStore, findDtTelemetry } from "./telemetry-store";
import { LiveStream, matchesFilter, type EventSourceLike } from "./stream";
import type { DtTelemetry, LiveEvent } from "./types";

describe("telemetry-store", () => {
  it("starts empty", () => {
    const store = createTelemetryStore();
    expect(store.getSnapshot()).toEqual({ receivedAt: 0, simNowIso: null, items: [] });
  });

  it("publishes a new snapshot and notifies subscribers without React", () => {
    const store = createTelemetryStore();
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((s) => seen.push(s));
    const items: DtTelemetry[] = [["dt_sn_01", 1.1, 101.2, 0.97, 0.9]];
    store.publish(items, "2026-10-02T18:00:00+05:30", 123);
    expect(seen).toHaveLength(1);
    expect(store.getSnapshot().items).toEqual(items);
    expect(store.getSnapshot().simNowIso).toBe("2026-10-02T18:00:00+05:30");
    unsubscribe();
    store.publish([], null);
    expect(seen).toHaveLength(1);
  });

  it("findDtTelemetry looks up by id and returns null when absent", () => {
    const store = createTelemetryStore();
    store.publish(
      [
        ["dt_sn_01", 1.1, 101.2, 0.97, 0.9],
        ["dt_kn_01", 1.34, 121.8, 0.93, 0.79],
      ],
      null,
    );
    const snap = store.getSnapshot();
    expect(findDtTelemetry(snap, "dt_kn_01")?.[1]).toBeCloseTo(1.34);
    expect(findDtTelemetry(snap, "dt_missing")).toBeNull();
  });
});

class FakeEventSource implements EventSourceLike {
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  closed = false;

  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    for (const l of this.listeners.get(type) ?? []) {
      l({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  open(): void {
    this.onopen?.(new Event("open"));
  }
}

describe("LiveStream", () => {
  it("goes live on open and publishes tick frames to the telemetry store", () => {
    const telemetry = createTelemetryStore();
    let source: FakeEventSource | null = null;
    const stream = new LiveStream({
      url: "http://example.test/api/v1/stream",
      telemetry,
      invalidate: vi.fn(),
      createSource: () => {
        source = new FakeEventSource();
        return source;
      },
    });
    stream.start();
    expect(stream.getState()).toBe("offline");
    source!.open();
    expect(stream.getState()).toBe("live");
    source!.emit("tick", { simNowIso: "2026-10-02T18:00:00+05:30", dts: [["dt_sn_01", 1.0, 95, 0.98, 0.95]] });
    expect(telemetry.getSnapshot().items).toHaveLength(1);
    stream.stop();
    expect(stream.getState()).toBe("offline");
  });

  it("pushes plan/risk/event frames and calls invalidate", () => {
    const telemetry = createTelemetryStore();
    const invalidate = vi.fn();
    let source: FakeEventSource | null = null;
    const stream = new LiveStream({
      url: "http://example.test/api/v1/stream",
      telemetry,
      invalidate,
      createSource: () => {
        source = new FakeEventSource();
        return source;
      },
    });
    stream.start();
    source!.open();
    source!.emit("plan", { planId: "fp_1", subdivisionId: "sd_subhashnagar", status: "approved" });
    source!.emit("risk", { dtId: "dt_sn_01", subdivisionId: "sd_subhashnagar", from: "moderate", to: "high", reason: "load rising" });
    source!.emit("event", { id: "e1", kind: "dispatch", subdivisionId: "sd_subhashnagar", dtId: "dt_sn_01", planId: "fp_1", message: "dispatched" });
    expect(stream.getEvents()).toHaveLength(3);
    expect(invalidate).toHaveBeenCalled();
    stream.stop();
  });

  it("matchesFilter narrows by kind and ids", () => {
    const planEvent: LiveEvent = {
      id: 1,
      receivedAt: 0,
      kind: "plan",
      data: { planId: "fp_1", subdivisionId: "sd_subhashnagar", status: "approved" },
    };
    expect(matchesFilter(planEvent, { kind: "plan" })).toBe(true);
    expect(matchesFilter(planEvent, { kind: "risk" })).toBe(false);
    expect(matchesFilter(planEvent, { planId: "fp_1" })).toBe(true);
    expect(matchesFilter(planEvent, { planId: "fp_2" })).toBe(false);
    expect(matchesFilter(planEvent, { dtId: "dt_sn_01" })).toBe(false);
  });

  it("does not start when url is empty (offline default)", () => {
    const telemetry = createTelemetryStore();
    const create = vi.fn();
    const stream = new LiveStream({ url: "", telemetry, invalidate: vi.fn(), createSource: create });
    stream.start();
    expect(create).not.toHaveBeenCalled();
    expect(stream.getState()).toBe("offline");
  });
});

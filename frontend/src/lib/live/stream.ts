import type { TelemetryPublisher } from "./telemetry-store";
import {
  LIVE_EVENT_LIMIT,
  type EventStreamPayload,
  type KpisStreamPayload,
  type LiveEvent,
  type PlanStreamPayload,
  type RiskStreamPayload,
  type TickPayload,
} from "./types";

export type LiveConnectionState = "offline" | "live" | "stale";

/** Reconnect delays after consecutive failures; the last value repeats. */
export const BACKOFF_MS = [1000, 2000, 5000, 10000] as const;
/** No frame for this long while connected means the stream is stale. */
export const STALE_MS = 8000;

export type EventSourceLike = {
  addEventListener(type: string, listener: (e: MessageEvent) => void): void;
  close(): void;
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
};

/** SWR key prefixes (after /api/v1) to revalidate per event kind. */
export const INVALIDATE = {
  plan: ["/plans"],
  risk: ["/transformers", "/subdivisions"],
  event: ["/events"],
} as const;

export type StreamDeps = {
  url: string;
  telemetry: TelemetryPublisher;
  /** Revalidate SWR keys starting with `/api/v1` + prefix. No-op is fine when unused. */
  invalidate: (prefixes: readonly string[]) => unknown;
  onKpis?: (payload: KpisStreamPayload) => void;
  createSource?: (url: string) => EventSourceLike;
};

/**
 * EventSource lifecycle, reconnect backoff, and event fan-out against GET /api/v1/stream.
 * Framework free so it can be tested with a fake EventSource, and so a missing backend (the
 * expected state until Lane B ships B5) degrades to "offline" rather than throwing.
 */
export class LiveStream {
  private source: EventSourceLike | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private nextId = 1;

  private state: LiveConnectionState = "offline";
  private events: readonly LiveEvent[] = [];
  private readonly stateListeners = new Set<() => void>();
  private readonly eventListeners = new Set<() => void>();

  constructor(private readonly deps: StreamDeps) {}

  /* ---- external store surfaces (useSyncExternalStore) ---- */
  getState = (): LiveConnectionState => this.state;
  getEvents = (): readonly LiveEvent[] => this.events;
  subscribeState = (l: () => void) => this.sub(this.stateListeners, l);
  subscribeEvents = (l: () => void) => this.sub(this.eventListeners, l);

  private sub(set: Set<() => void>, l: () => void) {
    set.add(l);
    return () => {
      set.delete(l);
    };
  }

  start(): void {
    if (this.running || !this.deps.url) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.clearTimers();
    this.source?.close();
    this.source = null;
    this.setState("offline");
  }

  private setState(next: LiveConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((l) => l());
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.reconnectTimer = null;
    this.staleTimer = null;
  }

  private armStale() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.setState("stale"), STALE_MS);
  }

  private connect() {
    if (!this.running) return;
    this.reconnectTimer = null;
    const create = this.deps.createSource ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
    let source: EventSourceLike;
    try {
      source = create(this.deps.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.source = source;
    source.onopen = () => {
      if (this.source !== source) return;
      this.attempt = 0;
      this.setState("live");
      this.armStale();
    };
    source.onerror = () => {
      if (this.source !== source) return;
      source.close();
      this.source = null;
      this.setState("offline");
      this.scheduleReconnect();
    };
    const on = (type: string, handler: (data: unknown) => void) =>
      source.addEventListener(type, (e) => {
        if (this.source !== source) return;
        let data: unknown;
        try {
          data = JSON.parse(e.data as string);
        } catch {
          return;
        }
        this.setState("live");
        this.armStale();
        handler(data);
      });
    on("tick", (d) => this.onTick(d as TickPayload));
    on("plan", (d) => this.onPlan(d as PlanStreamPayload));
    on("risk", (d) => this.onRisk(d as RiskStreamPayload));
    on("event", (d) => this.onEvent(d as EventStreamPayload));
    on("kpis", (d) => this.deps.onKpis?.(d as KpisStreamPayload));
  }

  private scheduleReconnect() {
    if (!this.running) return;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = null;
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private push(event: Omit<LiveEvent, "id" | "receivedAt"> & { kind: LiveEvent["kind"] }) {
    const full = { ...event, id: this.nextId++, receivedAt: Date.now() } as LiveEvent;
    this.events = [full, ...this.events].slice(0, LIVE_EVENT_LIMIT);
    this.eventListeners.forEach((l) => l());
  }

  private onTick(p: TickPayload) {
    this.deps.telemetry.publish(p.dts ?? [], p.simNowIso ?? null);
  }

  private onPlan(p: PlanStreamPayload) {
    this.push({ kind: "plan", data: p });
    this.deps.invalidate(INVALIDATE.plan);
  }

  private onRisk(p: RiskStreamPayload) {
    this.push({ kind: "risk", data: p });
    this.deps.invalidate(INVALIDATE.risk);
  }

  private onEvent(p: EventStreamPayload) {
    this.push({ kind: "event", data: p });
    this.deps.invalidate(INVALIDATE.event);
  }
}

export function matchesFilter(
  e: LiveEvent,
  f: { kind?: string; subdivisionId?: string; dtId?: string; planId?: string },
): boolean {
  if (f.kind && e.kind !== f.kind) return false;
  if (e.kind === "plan") {
    if (f.subdivisionId && e.data.subdivisionId !== f.subdivisionId) return false;
    if (f.planId && e.data.planId !== f.planId) return false;
    if (f.dtId) return false;
    return true;
  }
  if (e.kind === "risk") {
    if (f.subdivisionId && e.data.subdivisionId !== f.subdivisionId) return false;
    if (f.dtId && e.data.dtId !== f.dtId) return false;
    if (f.planId) return false;
    return true;
  }
  if (f.subdivisionId && e.data.subdivisionId !== f.subdivisionId) return false;
  if (f.dtId && e.data.dtId !== f.dtId) return false;
  if (f.planId && e.data.planId !== f.planId) return false;
  return true;
}

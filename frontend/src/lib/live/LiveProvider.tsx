"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { mutate } from "swr";
import { apiBase, scopeQuery } from "@/lib/api/base";
import { useScope } from "@/lib/scope";
import { createTelemetryStore, type TelemetryStore } from "./telemetry-store";
import { LiveStream, matchesFilter, type LiveConnectionState } from "./stream";
import type { LiveEvent, LiveEventFilter, Telemetry } from "./types";

type LiveContextValue = { stream: LiveStream; telemetry: TelemetryStore };

const OFFLINE_STREAM = new LiveStream({
  url: "",
  telemetry: createTelemetryStore(),
  invalidate: () => undefined,
});
const OFFLINE_VALUE: LiveContextValue = { stream: OFFLINE_STREAM, telemetry: createTelemetryStore() };

const LiveContext = createContext<LiveContextValue>(OFFLINE_VALUE);

/** Revalidates SWR keys that start with `/api/v1` + one of `prefixes`, scoped by subdivision. */
function invalidate(prefixes: readonly string[]): void {
  for (const prefix of prefixes) {
    void mutate((key) => typeof key === "string" && key.startsWith(`/api/v1${prefix}`));
  }
}

export function streamUrl(base: string, scope: string): string {
  return `${base}/api/v1/stream${scopeQuery(scope)}`;
}

/** One EventSource for the app. Re-opens when the scope changes. Must sit inside ScopeProvider. */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { scope } = useScope();
  const [telemetry] = useState(() => createTelemetryStore());

  const stream = useMemo(
    () =>
      new LiveStream({
        url: streamUrl(apiBase(), scope),
        telemetry,
        invalidate,
        onKpis: (payload) => {
          void mutate(
            `/api/v1/kpis${scopeQuery(scope)}`,
            { data: payload, offline: false },
            { revalidate: false },
          );
        },
      }),
    [scope, telemetry],
  );

  useEffect(() => {
    stream.start();
    return () => stream.stop();
  }, [stream]);

  return (
    <LiveStoreProvider stream={stream} telemetry={telemetry}>
      {children}
    </LiveStoreProvider>
  );
}

/** Supplies an existing stream and telemetry store to the hooks (also used by tests). */
export function LiveStoreProvider({
  stream,
  telemetry,
  children,
}: LiveContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ stream, telemetry }), [stream, telemetry]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Ref-style store for map layers: subscribe for updates, no React renders. */
export function useTelemetryStore(): TelemetryStore {
  return useContext(LiveContext).telemetry;
}

const EMPTY_TELEMETRY: Telemetry = { receivedAt: 0, simNowIso: null, items: [] };

/** React-bound telemetry snapshot. Most UI should prefer `useTelemetryStore` + `lens.ts` instead,
 * to avoid re-rendering on every tick; this hook is for panels that show a derived number. */
export function useTelemetry(): Telemetry {
  const { telemetry } = useContext(LiveContext);
  return useSyncExternalStore(telemetry.subscribe, telemetry.getSnapshot, () => EMPTY_TELEMETRY);
}

export function useLiveState(): LiveConnectionState {
  const { stream } = useContext(LiveContext);
  return useSyncExternalStore(stream.subscribeState, stream.getState, () => "offline" as const);
}

const NO_EVENTS: readonly LiveEvent[] = [];

/** Last 50 stream events, newest first, optionally filtered. */
export function useLiveEvents(filter: LiveEventFilter = {}): readonly LiveEvent[] {
  const { stream } = useContext(LiveContext);
  const all = useSyncExternalStore(stream.subscribeEvents, stream.getEvents, () => NO_EVENTS);
  const { kind, subdivisionId, dtId, planId } = filter;
  return useMemo(
    () => all.filter((e) => matchesFilter(e, { kind, subdivisionId, dtId, planId })),
    [all, kind, subdivisionId, dtId, planId],
  );
}

"use client";

import useSWR, { type KeyedMutator } from "swr";
import { ApiError, fetchJson, isNetworkError, scopeQuery } from "./base";
import { filterBySubdivision, fixtureNameFor, loadFixture } from "./fixtures";
import type {
  Consumer,
  CriticalFacility,
  EventLogEntry,
  Feeder,
  FairnessMetrics,
  FlexPlan,
  ForecastBundle,
  ReliabilityMetrics,
  Subdivision,
  Transformer,
} from "./types";

/** Refresh cadence in ms: fast for live ops, slow for mostly-static analytics. */
export const REFRESH = { live: 5_000, lists: 15_000, analytics: 30_000, none: 0 } as const;

export type ScopeArg = string | undefined;

type Payload<T> = { data: T; offline: boolean };

export type ApiResult<T> = {
  /** undefined only while the first load is in flight. */
  data: T | undefined;
  /** True when the backend was unreachable and `data` comes from a committed fixture. */
  offline: boolean;
  isLoading: boolean;
  error: ApiError | undefined;
  mutate: KeyedMutator<Payload<T>>;
};

type Options = {
  refreshInterval?: number;
  /** Sub-division id used to filter the `all` fixture client side. */
  scope?: string;
};

/**
 * One SWR hook per resource. Network failures resolve to the fixture for the path (typed `empty`
 * when no fixture file exists) with `offline: true`; HTTP errors (404, 409, ...) surface as `error`.
 * This is the single offline-tolerant primitive every `use*` hook below builds on.
 */
export function useApi<T>(
  path: string | null,
  empty: T,
  { refreshInterval = 0, scope }: Options = {},
): ApiResult<T> {
  const { data, error, isLoading, mutate } = useSWR<Payload<T>, ApiError>(
    path,
    async (key: string) => {
      try {
        const body = await fetchJson<T>(key);
        return { data: body, offline: false };
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        const fx = await loadFixture<T>(fixtureNameFor(key), empty);
        return { data: filterBySubdivision(fx, scope), offline: true };
      }
    },
    { refreshInterval, errorRetryCount: 2 },
  );
  return { data: data?.data, offline: data?.offline ?? false, isLoading, error, mutate };
}

const P = "/api/v1";

/* ---------- geography ---------- */

export function useSubdivisions() {
  return useApi<{ subdivisions: Subdivision[] }>(`${P}/subdivisions`, { subdivisions: [] }, {
    refreshInterval: REFRESH.analytics,
  });
}

export function useFeeders(scope: ScopeArg = "all") {
  return useApi<{ feeders: Feeder[] }>(`${P}/feeders${scopeQuery(scope)}`, { feeders: [] }, {
    refreshInterval: REFRESH.analytics,
    scope,
  });
}

export function useTransformers(scope: ScopeArg = "all") {
  return useApi<{ transformers: Transformer[] }>(
    `${P}/transformers${scopeQuery(scope)}`,
    { transformers: [] },
    { refreshInterval: REFRESH.live, scope },
  );
}

export function useTransformer(dtId: string | null | undefined) {
  return useApi<Transformer | null>(dtId ? `${P}/transformers/${dtId}` : null, null, {
    refreshInterval: REFRESH.live,
  });
}

export function useCriticalFacilities(scope: ScopeArg = "all") {
  return useApi<{ facilities: CriticalFacility[] }>(
    `${P}/critical${scopeQuery(scope)}`,
    { facilities: [] },
    { refreshInterval: REFRESH.analytics, scope },
  );
}

/* ---------- consumers ---------- */

export function useConsumers(dtId: string | null | undefined) {
  return useApi<{ consumers: Consumer[] }>(dtId ? `${P}/transformers/${dtId}/consumers` : null, {
    consumers: [],
  });
}

/* ---------- forecast ---------- */

export function useForecast(dtId: string | null | undefined) {
  return useApi<ForecastBundle | null>(dtId ? `${P}/forecast/${dtId}` : null, null, {
    refreshInterval: REFRESH.analytics,
  });
}

/* ---------- flex plans ---------- */

export function usePlans(scope: ScopeArg = "all") {
  return useApi<{ plans: FlexPlan[] }>(`${P}/plans${scopeQuery(scope)}`, { plans: [] }, {
    refreshInterval: REFRESH.lists,
    scope,
  });
}

export function usePlan(planId: string | null | undefined) {
  return useApi<FlexPlan | null>(planId ? `${P}/plans/${planId}` : null, null, {
    refreshInterval: REFRESH.live,
  });
}

/* ---------- reliability / fairness ---------- */

export function useReliability(scope: ScopeArg = "all") {
  return useApi<ReliabilityMetrics | null>(`${P}/reliability${scopeQuery(scope)}`, null, {
    refreshInterval: REFRESH.analytics,
  });
}

export function useFairness(scope: ScopeArg = "all") {
  return useApi<FairnessMetrics | null>(`${P}/fairness${scopeQuery(scope)}`, null, {
    refreshInterval: REFRESH.analytics,
  });
}

/* ---------- events ---------- */

export function useEvents(scope: ScopeArg = "all") {
  return useApi<{ events: EventLogEntry[] }>(`${P}/events${scopeQuery(scope)}`, { events: [] }, {
    refreshInterval: REFRESH.live,
    scope,
  });
}

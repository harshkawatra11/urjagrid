"use client";

import useSWR, { type KeyedMutator } from "swr";
import { ApiError, fetchJson, isNetworkError, scopeQuery } from "./base";
import { filterBySubdivision, fixtureNameFor, loadFixture } from "./fixtures";
import type {
  AuditLogEntry,
  ChargerStatus,
  Complaint,
  Consumer,
  ConsumerMessageRecord,
  ConsumerStatus,
  CriticalFacility,
  DrBelief,
  EconomicsAssumptions,
  EconomicsSummary,
  EventLogEntry,
  Feeder,
  FairnessMetrics,
  FeatureImportance,
  FederationNode,
  FieldRegistration,
  FlexPlan,
  ForecastBacktest,
  ForecastBundle,
  OutageReport,
  P2pTrade,
  ProtocolMessageRecord,
  RebateLedgerEntry,
  ReliabilityMetrics,
  RolePermissionRow,
  StorageAsset,
  Subdivision,
  Transformer,
  UsageStat,
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

/**
 * For a handful of resources the backend's real route exists but serves a
 * materially different (coarser or differently-keyed) shape than the
 * frontend type below -- see the per-hook comments. Calling the live
 * endpoint there would get a 200 with the *wrong* shape (or, where no route
 * exists at all, a 404), and `useApi`'s offline fallback only triggers on a
 * network failure (status 0) -- so a shape/404 mismatch would surface as a
 * broken render or a hard error instead of the honest "offline, showing the
 * fixture" banner. This hook skips the live call entirely for those few
 * resources and always renders the committed fixture with `offline: true`,
 * which is the "leave a clear comment, fixture-only for now" path called out
 * in the integration-pass instructions rather than silently shipping a
 * mismatched live response.
 */
function useFixtureOnly<T>(path: string | null, empty: T, scope?: string): ApiResult<T> {
  const { data, error, isLoading, mutate } = useSWR<Payload<T>, ApiError>(
    path ? `fixture:${path}` : null,
    async () => ({ data: filterBySubdivision(await loadFixture<T>(fixtureNameFor(path ?? ""), empty), scope), offline: true }),
    { errorRetryCount: 0 },
  );
  return { data: data?.data, offline: true, isLoading, error, mutate };
}

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

/**
 * Fixture-only (see `useFixtureOnly`): a real WAPE/skill-score/coverage
 * backtest needs a held-out actual-vs-predicted eval harness run against
 * the trained quantile models (`grid/forecaster.py`), which is a real but
 * substantial follow-up, not a thin read-model composition -- building it
 * is out of scope for this integration pass. `/forecast/importance` (actual
 * trained-model feature importances) is wired for real; this one isn't.
 */
export function useForecastBacktest() {
  return useFixtureOnly<ForecastBacktest | null>(`${P}/forecast/backtest`, null);
}

export function useForecastImportance() {
  return useApi<{ features: FeatureImportance[] }>(`${P}/forecast/importance`, { features: [] }, {
    refreshInterval: REFRESH.none,
  });
}

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

/* ---------- consumers list / messages / complaints (D21) ---------- */

export function useConsumersList(scope: ScopeArg = "all") {
  return useApi<{ consumers: Consumer[] }>(`${P}/consumers${scopeQuery(scope)}`, { consumers: [] }, {
    refreshInterval: REFRESH.lists,
    scope,
  });
}

export function useConsumerMessages(scope: ScopeArg = "all") {
  return useApi<{ messages: ConsumerMessageRecord[] }>(
    `${P}/consumers/messages${scopeQuery(scope)}`,
    { messages: [] },
    { refreshInterval: REFRESH.lists, scope },
  );
}

/**
 * Fixture-only (see `useFixtureOnly`): there is no backend complaint store
 * distinct from the field/outage registry (billing/voltage/"other"
 * complaint kinds aren't modelled anywhere in the simulation) -- building
 * one is new scope beyond composing an existing read-model, so this stays
 * fixture-only rather than fabricating complaint rows.
 */
export function useComplaints(scope: ScopeArg = "all") {
  return useFixtureOnly<{ complaints: Complaint[] }>(`${P}/consumers/complaints${scopeQuery(scope)}`, { complaints: [] }, scope);
}

/**
 * Fixture-only (see `useFixtureOnly`): per-consumer meter state (`normal`/
 * `dr`/`capped`/`shed`) isn't tracked at consumer granularity anywhere in
 * `GridWorld` -- the simulator's state is DT-aggregate (see
 * `services/service.py`'s `Track`), so a truthful per-consumer status card
 * would need new per-consumer state tracking in the world model, not just a
 * new read-model composition. D27 consumer phone app: a single consumer's
 * own status card.
 */
export function useConsumerStatus(consumerId: string | null | undefined) {
  return useFixtureOnly<ConsumerStatus | null>(consumerId ? `${P}/consumers/${consumerId}/status` : null, null);
}

/* ---------- flex levers detail (D12/D13/D14) ---------- */

/**
 * Fixture-only (see `useFixtureOnly`): the real `/flex/chargers` exists
 * (`backend/app/api/v1/flex.py`) but returns DT-keyed lever-status rows
 * (`{dtId, hubFrac, planId}`), not named per-asset `ChargerStatus` rows
 * (`id`/`name`/`kind`/`ratedKw`) -- there is no per-charger registry
 * anywhere in the network model (`AssetProfiles` sizes hub load in
 * aggregate, see `grid/sizing.py`), so inventing per-asset ids/names would
 * be fabricated data, not a read-model composition.
 */
export function useChargers(scope: ScopeArg = "all") {
  return useFixtureOnly<{ chargers: ChargerStatus[] }>(`${P}/flex/chargers${scopeQuery(scope)}`, { chargers: [] }, scope);
}

/** Fixture-only (see `useFixtureOnly`) for the same reason as `useChargers`:
 * no per-storage-asset registry exists to back `StorageAsset`/`P2pTrade` ids. */
export function useStorageAssets(scope: ScopeArg = "all") {
  return useFixtureOnly<{ storageAssets: StorageAsset[]; trades: P2pTrade[] }>(
    `${P}/flex/storage${scopeQuery(scope)}`,
    { storageAssets: [], trades: [] },
    scope,
  );
}

/**
 * Fixture-only (see `useFixtureOnly`): `grid/dr_model.py`'s
 * `DrAcceptanceRegistry` (the real Beta-Bernoulli acceptance model) is
 * implemented and tested but not yet instantiated/updated by
 * `GridService`/`Dispatcher` at runtime, so there is no live alpha/beta
 * state to read -- wiring that up is real engine-integration work beyond a
 * thin read-model route.
 */
export function useDrBeliefs(scope: ScopeArg = "all") {
  return useFixtureOnly<{ beliefs: DrBelief[]; rebateLedger: RebateLedgerEntry[] }>(
    `${P}/flex/dr${scopeQuery(scope)}`,
    { beliefs: [], rebateLedger: [] },
    scope,
  );
}

/* ---------- protocols / federation (D25/D26) ---------- */

export function useProtocols(scope: ScopeArg = "all") {
  return useApi<{ protocolNames: string[]; counts: Record<string, number>; entries: ProtocolMessageRecord[] }>(
    `${P}/protocols${scopeQuery(scope)}`,
    { protocolNames: [], counts: {}, entries: [] },
    { refreshInterval: REFRESH.live, scope },
  );
}

export function useFederation() {
  return useApi<{ nodes: FederationNode[] }>(`${P}/federation`, { nodes: [] }, {
    refreshInterval: REFRESH.analytics,
  });
}

/* ---------- economics (D24) ---------- */

export function useEconomics() {
  return useApi<{ assumptions: EconomicsAssumptions; summary: EconomicsSummary }>(
    `${P}/economics/unit`,
    {
      assumptions: {
        rebateRsPerKwh: 2,
        dtFailureCostRs: 0,
        deferredUpgradeCostRs: 0,
        energyValueRsPerKwh: 0,
        monthlyFeeRsPerMeter: 0,
      },
      summary: { paybackMonths: 0, bcr: 0, monthlyFeeRs: 0, annualSavingsRs: 0, nMeters: 0, moneyFlow: [] },
    },
    { refreshInterval: REFRESH.analytics },
  );
}

/* ---------- analytics / governance (D23) ---------- */

export function useAuditLog(scope: ScopeArg = "all") {
  return useApi<{ entries: AuditLogEntry[] }>(`${P}/analytics/audit${scopeQuery(scope)}`, { entries: [] }, {
    refreshInterval: REFRESH.lists,
    scope,
  });
}

export function useRoleMatrix() {
  return useApi<{ roles: RolePermissionRow[] }>(`${P}/analytics/roles`, { roles: [] }, {
    refreshInterval: REFRESH.none,
  });
}

export function useUsageStats() {
  return useApi<{ stats: UsageStat[] }>(`${P}/analytics/usage`, { stats: [] }, {
    refreshInterval: REFRESH.analytics,
  });
}

/* ---------- field worker app (D28) ---------- */

export function useFieldRegistry(scope: ScopeArg = "all") {
  return useApi<{ registrations: FieldRegistration[] }>(
    `${P}/field/registry${scopeQuery(scope)}`,
    { registrations: [] },
    { refreshInterval: REFRESH.lists, scope },
  );
}

export function useOutageReports(scope: ScopeArg = "all") {
  return useApi<{ reports: OutageReport[] }>(`${P}/field/outages${scopeQuery(scope)}`, { reports: [] }, {
    refreshInterval: REFRESH.lists,
    scope,
  });
}

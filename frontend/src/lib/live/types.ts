import type { PlanStatus, RiskLevel } from "@/lib/domain";

/**
 * SSE payloads from GET /api/v1/stream (SPEC section 2: event types tick/event/plan/plans/risk/kpis).
 * Not part of a generated OpenAPI client, so hand-written against the SPEC contract.
 */

/**
 * One DT's telemetry for one tick, as a compact tuple (not an object) so a tick frame with
 * dozens of DTs can be published to the non-React telemetry store without allocating object
 * churn on every one-second tick.
 * `[dtId, loadingPu, hotspotC, voltagePu, servedFraction]`
 */
export type DtTelemetry = readonly [
  dtId: string,
  loadingPu: number,
  hotspotC: number,
  voltagePu: number,
  servedFraction: number,
];

export type TickPayload = { simNowIso: string; dts: DtTelemetry[] };

export type Telemetry = {
  /** performance.now() at the moment the tick arrived; used for interpolation. */
  receivedAt: number;
  simNowIso: string | null;
  items: readonly DtTelemetry[];
};

export type PlanStreamPayload = { planId: string; subdivisionId: string; status: PlanStatus };

export type RiskStreamPayload = {
  dtId: string;
  subdivisionId: string;
  from: RiskLevel;
  to: RiskLevel;
  reason: string;
};

export type EventStreamPayload = {
  id: string;
  kind: string;
  subdivisionId: string | null;
  dtId: string | null;
  planId: string | null;
  message: string;
};

export type KpisStreamPayload = {
  subdivisionId: string | "all";
  servedFraction: number;
  activePlanCount: number;
  dtAtRiskCount: number;
};

export type LiveEvent =
  | { id: number; receivedAt: number; kind: "plan"; data: PlanStreamPayload }
  | { id: number; receivedAt: number; kind: "risk"; data: RiskStreamPayload }
  | { id: number; receivedAt: number; kind: "event"; data: EventStreamPayload };

export type LiveEventFilter = {
  kind?: LiveEvent["kind"];
  subdivisionId?: string;
  dtId?: string;
  planId?: string;
};

export const LIVE_EVENT_LIMIT = 50;

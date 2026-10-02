/**
 * Typed data layer (C3). These interfaces mirror the read-model shapes the backend's
 * `views.*` functions (Lane B, task B8) are expected to produce under `/api/v1`. Until that
 * contract lands, Lane D pages render these same shapes from the fixtures in
 * `src/data/fixtures/*.json`.
 */
import type { CapLevel, LeverKey, MeterState, PlanStatus, RiskLevel } from "@/lib/domain";
import type { SubdivisionId } from "@/lib/scope";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Subdivision {
  id: SubdivisionId;
  name: string;
  town: string;
  discom: "MVVNL" | "DVVNL";
  feederIds: string[];
  riskLevel: RiskLevel;
  riskIndex: number;
  consumerCount: number;
  activePlanCount: number;
  servedFraction: number;
  center: LatLng;
}

export interface Feeder {
  id: string;
  subdivisionId: SubdivisionId;
  name: string;
  voltageKv: number;
  dtIds: string[];
  loadingPu: number;
  riskLevel: RiskLevel;
  path: LatLng[];
}

export interface Transformer {
  id: string;
  feederId: string;
  subdivisionId: SubdivisionId;
  name: string;
  ratingKva: number;
  loadingPu: number;
  hotspotC: number;
  lossOfLifePct: number;
  riskLevel: RiskLevel;
  riskIndex: number;
  consumerCount: number;
  servedFraction: number;
  voltagePu: number;
  location: LatLng;
  serviceAreaPolygon: LatLng[];
}

export interface Consumer {
  id: string;
  dtId: string;
  subdivisionId: SubdivisionId;
  tier: "T0" | "T1" | "T2" | "T3";
  name: string;
  meterState: MeterState;
  capLevel: CapLevel;
  connectedLoadW: number;
  lifelineHoursToday: number;
  drOptedIn: boolean;
}

export interface CriticalFacility {
  id: string;
  dtId: string;
  subdivisionId: SubdivisionId;
  name: string;
  kind: "hospital" | "water" | "telecom" | "life_support";
  backupAvailable: boolean;
}

export interface DeficitWindow {
  id: string;
  dtId: string;
  subdivisionId: SubdivisionId;
  startIso: string;
  endIso: string;
  gapKw: number;
  thermalRisk: boolean;
}

export interface ForecastPoint {
  slotIso: string;
  p10Kw: number;
  p50Kw: number;
  p90Kw: number;
  availableKw: number;
  limitKw: number;
  actualKw: number | null;
}

export interface ForecastBundle {
  dtId: string;
  subdivisionId: SubdivisionId;
  horizonSlots: number;
  points: ForecastPoint[];
  deficitWindows: DeficitWindow[];
}

export interface LeverAllocation {
  lever: LeverKey;
  reliefKw: number;
  costRs: number;
  consumerCount: number;
}

export interface FlexPlan {
  id: string;
  subdivisionId: SubdivisionId;
  dtIds: string[];
  status: PlanStatus;
  deficitWindowId: string;
  createdIso: string;
  windowStartIso: string;
  windowEndIso: string;
  gapKw: number;
  coveredKw: number;
  levers: LeverAllocation[];
  approverName: string | null;
  approvedIso: string | null;
  notes: string | null;
}

export interface PlanOption {
  id: string;
  label: string;
  levers: LeverAllocation[];
  totalReliefKw: number;
  totalCostRs: number;
  unservedKw: number;
  recommended: boolean;
}

export interface SensitivityCell {
  leverDeltaPct: number;
  gapDeltaPct: number;
  unservedKw: number;
}

export interface DispatchStep {
  key: "notify" | "signal" | "hes" | "start" | "end" | "verify";
  label: string;
  scheduledIso: string;
  completedIso: string | null;
  status: "pending" | "in_progress" | "done" | "skipped" | "failed";
}

export interface ProtocolMessageRecord {
  id: string;
  protocol: "hes" | "ocpp" | "openadr" | "beckn" | "whatsapp" | "ivr" | "sms";
  direction: "outbound" | "inbound";
  summary: string;
  payload: Record<string, unknown>;
  timestampIso: string;
  status: "sent" | "acked" | "failed";
}

export interface ReliabilityMetrics {
  subdivisionId: SubdivisionId | "all";
  saidiMinutes: number;
  saifiCount: number;
  lifelineAvailabilityPct: number;
  hoursOfHelp: number;
}

export interface FairnessMetrics {
  subdivisionId: SubdivisionId | "all";
  jainIndex: number;
  giniCoefficient: number;
  lorenzPoints: Array<{ cumulativePopulationPct: number; cumulativeServedPct: number }>;
}

/** What-if overrides for FlexPlanService.simulate (Lane B task B2). */
export interface PlanOverrides {
  leverEnabled?: Partial<Record<LeverKey, boolean>>;
  capLevelOverride?: CapLevel;
  drParticipationMultiplier?: number;
}

export interface EventLogEntry {
  id: string;
  timestampIso: string;
  kind: string;
  subdivisionId: SubdivisionId | null;
  dtId: string | null;
  planId: string | null;
  message: string;
}

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

/* ---------- D12 managed charging (OCPP) ---------- */

export interface ChargerStatus {
  id: string;
  dtId: string;
  subdivisionId: SubdivisionId;
  name: string;
  kind: "ev" | "e_rickshaw";
  status: "online" | "charging" | "curtailed" | "offline";
  curtailmentFraction: number;
  powerKw: number;
  ratedKw: number;
}

/* ---------- D13 storage + P2P (OpenADR / Beckn) ---------- */

export interface StorageAsset {
  id: string;
  dtId: string;
  subdivisionId: SubdivisionId;
  name: string;
  socPct: number;
  dispatchKw: number;
  capacityKwh: number;
}

export interface P2pTrade {
  id: string;
  sellerId: string;
  buyerId: string;
  subdivisionId: SubdivisionId;
  energyKwh: number;
  priceRs: number;
  timestampIso: string;
  protocol: "beckn";
  status: "confirmed" | "pending" | "failed";
}

/* ---------- D14 demand response (Beta-Bernoulli acceptance model) ---------- */

export interface DrBelief {
  subdivisionId: SubdivisionId;
  alpha: number;
  beta: number;
  acceptanceRateEstimate: number;
  sampleCount: number;
}

export interface RebateLedgerEntry {
  subdivisionId: SubdivisionId;
  consumerCount: number;
  kwhShifted: number;
  totalRebateRs: number;
}

/* ---------- D21 consumers and channels ---------- */

export interface ConsumerMessageRecord {
  id: string;
  consumerId: string;
  subdivisionId: SubdivisionId;
  channel: "whatsapp" | "ivr" | "sms";
  direction: "outbound" | "inbound";
  bodyHi: string;
  bodyEn: string;
  timestampIso: string;
  audioUrl: string | null;
}

export interface Complaint {
  id: string;
  consumerId: string;
  subdivisionId: SubdivisionId;
  kind: "outage" | "billing" | "voltage" | "other";
  status: "open" | "ack" | "resolved";
  createdIso: string;
  message: string;
}

/* ---------- D20 critical loads / D28 field registry ---------- */

export interface FieldRegistration {
  id: string;
  consumerId: string;
  subdivisionId: SubdivisionId;
  category: "critical_facility" | "life_support_home";
  notes: string;
  registeredBy: string;
  verified: boolean;
  createdIso: string;
}

export interface OutageReport {
  id: string;
  consumerId: string | null;
  dtId: string | null;
  subdivisionId: SubdivisionId;
  description: string;
  status: "reported" | "confirmed" | "resolved";
  createdIso: string;
}

/* ---------- D23 analytics / governance ---------- */

export interface AuditLogEntry {
  id: string;
  timestampIso: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
}

export interface RolePermissionRow {
  role: string;
  canApprovePlans: boolean;
  canEditScenario: boolean;
  canViewConsumerData: boolean;
  canDispatch: boolean;
  canSeeRegulatorAggregates: boolean;
}

export interface UsageStat {
  metric: string;
  value: number;
  unit: string;
}

/* ---------- D24 economics ---------- */

export interface EconomicsAssumptions {
  rebateRsPerKwh: number;
  dtFailureCostRs: number;
  deferredUpgradeCostRs: number;
  energyValueRsPerKwh: number;
  monthlyFeeRsPerMeter: number;
}

export interface MoneyFlowEdge {
  from: string;
  to: string;
  amountRs: number;
}

export interface EconomicsSummary {
  paybackMonths: number;
  bcr: number;
  monthlyFeeRs: number;
  annualSavingsRs: number;
  nMeters: number;
  moneyFlow: MoneyFlowEdge[];
}

/* ---------- D25 protocols / D26 regulator (federation) ---------- */

export interface FederationNode {
  discom: "MVVNL" | "DVVNL";
  town: string;
  subdivisionCount: number;
  consumerCount: number;
  reliabilityIndex: number;
  flexibilityIndex: number;
  fairnessIndex: number;
}

/* ---------- D27 consumer phone app ---------- */

export interface ConsumerStatus {
  consumerId: string;
  name: string;
  subdivisionId: SubdivisionId;
  tier: "T0" | "T1" | "T2" | "T3";
  meterState: MeterState;
  lifelineGuaranteeW: number;
  availabilityBlocks: Array<"available" | "lifeline" | "shed">;
  drAsk: { headlineHi: string; windowStartIso: string; windowEndIso: string; rebateRsPerKwh: number } | null;
}

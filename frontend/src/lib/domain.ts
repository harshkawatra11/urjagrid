/**
 * Domain enums mirroring the Python enums in backend/app/grid/models.py (Lane A).
 * Names and conceptual values must stay identical across the stack.
 */

// -- Honest capability status (SPEC section 1, must be used verbatim in UI) ------------------
export type CapabilityStatus = "LIVE" | "WIRED" | "PILOT";

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  LIVE: "LIVE",
  WIRED: "WIRED",
  PILOT: "PILOT",
};

export const CAPABILITY_STATUS_DESCRIPTION: Record<CapabilityStatus, string> = {
  LIVE: "Real algorithm or external service runs in this prototype.",
  WIRED: "Spec-shaped code path against an in-process simulator, not real hardware.",
  PILOT: "Not built in this prototype.",
};

export const CAPABILITY_STATUS_COLOR_VAR: Record<CapabilityStatus, string> = {
  LIVE: "--status-live",
  WIRED: "--status-wired",
  PILOT: "--status-pilot",
};

// -- Risk level --------------------------------------------------------------------------------
export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const RISK_LEVELS: readonly RiskLevel[] = ["low", "moderate", "high", "critical"];

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export const RISK_LEVEL_COLOR_VAR: Record<RiskLevel, string> = {
  low: "--risk-low",
  moderate: "--risk-moderate",
  high: "--risk-high",
  critical: "--risk-critical",
};

// -- Flex Plan state machine --------------------------------------------------------------------
export type PlanStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "dispatched"
  | "active"
  | "verified"
  | "rejected"
  | "cancelled"
  | "expired";

export const PLAN_STATUSES: readonly PlanStatus[] = [
  "draft",
  "proposed",
  "approved",
  "dispatched",
  "active",
  "verified",
  "rejected",
  "cancelled",
  "expired",
];

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  approved: "Approved",
  dispatched: "Dispatched",
  active: "Active",
  verified: "Verified",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const PLAN_STATUS_COLOR_VAR: Record<PlanStatus, string> = {
  draft: "--plan-draft",
  proposed: "--plan-proposed",
  approved: "--plan-approved",
  dispatched: "--plan-dispatched",
  active: "--plan-active",
  verified: "--plan-verified",
  rejected: "--plan-rejected",
  cancelled: "--plan-cancelled",
  expired: "--plan-expired",
};

// -- Meter state ---------------------------------------------------------------------------------
export type MeterState = "normal" | "dr" | "capped" | "shed" | "offline";

export const METER_STATES: readonly MeterState[] = ["normal", "dr", "capped", "shed", "offline"];

export const METER_STATE_LABEL: Record<MeterState, string> = {
  normal: "Normal",
  dr: "DR active",
  capped: "Capped",
  shed: "Shed",
  offline: "Offline",
};

export const METER_STATE_COLOR_VAR: Record<MeterState, string> = {
  normal: "--meter-normal",
  dr: "--meter-dr",
  capped: "--meter-capped",
  shed: "--meter-shed",
  offline: "--meter-offline",
};

// -- Lever order (always tried in this sequence, L1 -> L6) --------------------------------------
export type LeverKey =
  | "behavioral_dr"
  | "managed_charging"
  | "shiftable_loads"
  | "storage_discharge"
  | "lifeline_cap"
  | "rotational_shedding";

export const LEVER_ORDER: readonly LeverKey[] = [
  "behavioral_dr",
  "managed_charging",
  "shiftable_loads",
  "storage_discharge",
  "lifeline_cap",
  "rotational_shedding",
];

export const LEVER_LABEL: Record<LeverKey, string> = {
  behavioral_dr: "Behavioural DR",
  managed_charging: "Managed charging",
  shiftable_loads: "Shiftable loads",
  storage_discharge: "Storage discharge",
  lifeline_cap: "Lifeline cap",
  rotational_shedding: "Rotational shedding",
};

export const LEVER_SHORT_LABEL: Record<LeverKey, string> = {
  behavioral_dr: "L1 DR",
  managed_charging: "L2 Charging",
  shiftable_loads: "L3 Shiftable",
  storage_discharge: "L4 Storage",
  lifeline_cap: "L5 Cap",
  rotational_shedding: "L6 Shedding",
};

export const LEVER_COLOR_VAR: Record<LeverKey, string> = {
  behavioral_dr: "--lever-behavioral-dr",
  managed_charging: "--lever-managed-charging",
  shiftable_loads: "--lever-shiftable-loads",
  storage_discharge: "--lever-storage-discharge",
  lifeline_cap: "--lever-lifeline-cap",
  rotational_shedding: "--lever-rotational-shedding",
};

// -- Cap levels ------------------------------------------------------------------------------------
export type CapLevel = "none" | "comfort" | "essential" | "lifeline";

export const CAP_LEVELS: readonly CapLevel[] = ["none", "comfort", "essential", "lifeline"];

export const CAP_LEVEL_LABEL: Record<CapLevel, string> = {
  none: "None",
  comfort: "Comfort",
  essential: "Essential",
  lifeline: "Lifeline",
};

/** Cap level wattage floors, keyed by consumer tier (T1 household, T2 shop/livelihood). */
export const CAP_LEVEL_WATTS: Record<CapLevel, { t1: number | null; t2: number | null }> = {
  none: { t1: null, t2: null },
  comfort: { t1: 1000, t2: 2000 },
  essential: { t1: 500, t2: 1000 },
  lifeline: { t1: 300, t2: 500 },
};

export const CAP_LEVEL_COLOR_VAR: Record<CapLevel, string> = {
  none: "--cap-none",
  comfort: "--cap-comfort",
  essential: "--cap-essential",
  lifeline: "--cap-lifeline",
};

// -- Consumer tiers ---------------------------------------------------------------------------------
export type ConsumerTier = "T0" | "T1" | "T2" | "T3";

export const CONSUMER_TIER_LABEL: Record<ConsumerTier, string> = {
  T0: "Critical / life-support",
  T1: "Household",
  T2: "Livelihood / shop",
  T3: "Flexible asset",
};

/** Resolves a CSS custom property name to a usable color string, e.g. "var(--status-live)". */
export function cssVar(name: string): string {
  return `var(${name})`;
}

/** A translucent tint of a color (CSS var or literal), used as a chip/tag background. */
export function tint(colorVar: string, pct = 12): string {
  return `color-mix(in srgb, ${colorVar} ${pct}%, transparent)`;
}

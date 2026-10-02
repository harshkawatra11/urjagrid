import { Chip } from "./chip";
import {
  CAP_LEVEL_COLOR_VAR,
  CAP_LEVEL_LABEL,
  LEVER_COLOR_VAR,
  LEVER_SHORT_LABEL,
  METER_STATE_COLOR_VAR,
  METER_STATE_LABEL,
  PLAN_STATUS_COLOR_VAR,
  PLAN_STATUS_LABEL,
  cssVar,
  type CapLevel,
  type LeverKey,
  type MeterState,
  type PlanStatus,
} from "@/lib/domain";

export function PlanStatusChip({ status, size }: { status: PlanStatus; size?: "sm" | "md" }) {
  const pulse = status === "active" || status === "dispatched";
  return (
    <Chip
      label={PLAN_STATUS_LABEL[status]}
      color={cssVar(PLAN_STATUS_COLOR_VAR[status])}
      size={size}
      pulse={pulse}
    />
  );
}

export function MeterStateChip({ state, size }: { state: MeterState; size?: "sm" | "md" }) {
  return (
    <Chip
      label={METER_STATE_LABEL[state]}
      color={cssVar(METER_STATE_COLOR_VAR[state])}
      size={size}
      pulse={state === "shed"}
    />
  );
}

export function CapLevelChip({ level, size }: { level: CapLevel; size?: "sm" | "md" }) {
  return <Chip label={CAP_LEVEL_LABEL[level]} color={cssVar(CAP_LEVEL_COLOR_VAR[level])} size={size} dot={level !== "none"} />;
}

export function LeverChip({ lever, size }: { lever: LeverKey; size?: "sm" | "md" }) {
  return <Chip label={LEVER_SHORT_LABEL[lever]} color={cssVar(LEVER_COLOR_VAR[lever])} size={size} />;
}

/** Protocol / message kind chip (HES, OCPP, OpenADR, Beckn, WhatsApp, IVR, SMS). */
export function KindChip({ kind, size }: { kind: string; size?: "sm" | "md" }) {
  return <Chip label={kind.toUpperCase()} color="var(--info)" size={size} dot={false} />;
}

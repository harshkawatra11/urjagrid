"use client";

import { formatIstDateTime } from "@/lib/format";
import { useTelemetry } from "@/lib/live/LiveProvider";

/** Shows the simulation clock from the live stream when connected, else the real wall clock. */
export function SimClockChip() {
  const telemetry = useTelemetry();
  const label = telemetry.simNowIso ? formatIstDateTime(telemetry.simNowIso) : "—";
  return (
    <span className="num hidden items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] text-muted lg:inline-flex">
      <span className="eyebrow">Sim</span>
      {label}
    </span>
  );
}

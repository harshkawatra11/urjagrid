"use client";

import { useLiveState } from "@/lib/live/LiveProvider";

/** Thin banner shown when the live stream is offline/stale, so the honest-status rule (SPEC
 * section 9: "must work offline... with offline banner") is visible, not just implicit in fixtures. */
export function OfflineBanner() {
  const state = useLiveState();
  if (state === "live") return null;
  return (
    <div
      role="status"
      className="flex h-7 items-center justify-center gap-2 bg-amber/20 text-[11px] font-medium text-amber"
      style={{ background: "color-mix(in srgb, var(--amber) 16%, transparent)" }}
    >
      {state === "stale"
        ? "Live stream is stale — showing the last known tick."
        : "Backend unreachable — showing committed fixtures (offline demo mode)."}
    </div>
  );
}

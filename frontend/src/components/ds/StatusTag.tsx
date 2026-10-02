import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { tint } from "@/lib/domain";
import {
  CAPABILITY_STATUS_COLOR_VAR,
  CAPABILITY_STATUS_DESCRIPTION,
  CAPABILITY_STATUS_LABEL,
  cssVar,
  type CapabilityStatus,
} from "@/lib/domain";

/**
 * Renders the honest-status matrix tag (SPEC section 1): LIVE / WIRED / PILOT, used verbatim
 * next to any capability (forecast, optimiser, HES limiter, voice, ...) so the UI never implies
 * something is production-real when it is a simulator or not built at all.
 */
export function StatusTag({
  status,
  size = "md",
  title,
}: {
  status: CapabilityStatus;
  size?: "sm" | "md";
  title?: string;
}) {
  const color = cssVar(CAPABILITY_STATUS_COLOR_VAR[status]);
  const style: CSSProperties = { backgroundColor: tint(color), color, borderColor: tint(color, 40) };
  return (
    <span
      style={style}
      title={title ?? CAPABILITY_STATUS_DESCRIPTION[status]}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border font-semibold uppercase tracking-[0.08em]",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
      )}
    >
      {CAPABILITY_STATUS_LABEL[status]}
    </span>
  );
}

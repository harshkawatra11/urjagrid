import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatSign } from "@/lib/format";

export type DeltaDirection = "up-good" | "up-bad";

/**
 * Shows a +/- change with direction-aware coloring. `direction` controls whether an increase is
 * good (e.g. served fraction) or bad (e.g. unserved kW, outage hours).
 */
export function Delta({
  value,
  direction = "up-good",
  unit = "",
  fractionDigits = 1,
  className,
}: {
  value: number;
  direction?: DeltaDirection;
  unit?: string;
  fractionDigits?: number;
  className?: string;
}) {
  const isFlat = Math.abs(value) < 1e-9;
  const isUp = value > 0;
  const good = isFlat ? null : direction === "up-good" ? isUp : !isUp;
  const colorClass = isFlat ? "text-muted" : good ? "text-green" : "text-red";
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-[12px] font-medium", colorClass, className)}>
      <Icon size={12} aria-hidden />
      {formatSign(value, fractionDigits)}
      {unit}
    </span>
  );
}

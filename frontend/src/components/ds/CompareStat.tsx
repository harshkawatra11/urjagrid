import { cn } from "@/lib/cn";
import { Delta, type DeltaDirection } from "./Delta";

/**
 * The "solution vs baseline" comparison stat used across the dashboard: the UrjaGrid
 * solution's number, the shadow (status-quo / rotational-shedding) baseline's number, and the
 * delta between them. This is the recurring "moneyshot" pattern -- what did the optimiser buy us.
 */
export function CompareStat({
  label,
  solutionValue,
  baselineValue,
  unit = "",
  direction = "up-good",
  fractionDigits = 1,
  className,
}: {
  label: string;
  solutionValue: number;
  baselineValue: number;
  unit?: string;
  direction?: DeltaDirection;
  fractionDigits?: number;
  className?: string;
}) {
  const delta = solutionValue - baselineValue;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="eyebrow">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="num text-[20px] font-semibold text-text">
          {solutionValue.toFixed(fractionDigits)}
          <span className="ml-0.5 text-[12px] font-normal text-muted">{unit}</span>
        </span>
        <Delta value={delta} direction={direction} unit={unit} fractionDigits={fractionDigits} />
      </div>
      <span className="num text-[11px] text-faint">
        vs baseline {baselineValue.toFixed(fractionDigits)}
        {unit}
      </span>
    </div>
  );
}

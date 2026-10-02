import { RISK_LEVELS, RISK_LEVEL_COLOR_VAR, RISK_LEVEL_LABEL, cssVar } from "@/lib/domain";

/** Fixed risk-level legend for the map console. */
export function MapLegend({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {RISK_LEVELS.map((level) => (
          <li key={level} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: cssVar(RISK_LEVEL_COLOR_VAR[level]) }}
            />
            {RISK_LEVEL_LABEL[level]}
          </li>
        ))}
      </ul>
    </div>
  );
}

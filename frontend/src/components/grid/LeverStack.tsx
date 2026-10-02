import { LeverChip } from "@/components/ds/chips";
import { LEVER_COLOR_VAR, cssVar } from "@/lib/domain";
import { formatKw, formatRupees } from "@/lib/format";
import type { LeverAllocation } from "@/lib/api/types";

/** Stacked bar + list of each lever's relief contribution, in canonical L1-L6 order. */
export function LeverStack({ levers, gapKw }: { levers: LeverAllocation[]; gapKw: number }) {
  const total = levers.reduce((s, l) => s + l.reliefKw, 0);
  return (
    <div>
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-surface-3">
        {levers.map((l) => (
          <div
            key={l.lever}
            style={{ width: `${gapKw > 0 ? (l.reliefKw / gapKw) * 100 : 0}%`, background: cssVar(LEVER_COLOR_VAR[l.lever]) }}
            title={`${l.lever}: ${formatKw(l.reliefKw)}`}
          />
        ))}
      </div>
      <ul className="space-y-2">
        {levers.map((l) => (
          <li key={l.lever} className="flex items-center justify-between gap-3 text-[12px]">
            <LeverChip lever={l.lever} />
            <span className="num text-text">{formatKw(l.reliefKw)}</span>
            <span className="num text-muted">{formatRupees(l.costRs)}</span>
            <span className="num text-faint">{l.consumerCount} consumers</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-faint">
        {formatKw(total)} covered of {formatKw(gapKw)} gap
      </p>
    </div>
  );
}

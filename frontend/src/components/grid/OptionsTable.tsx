import { LeverChip } from "@/components/ds/chips";
import { formatKw, formatRupees } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PlanOption } from "@/lib/api/types";

/** Compares candidate plan options (e.g. optimiser solution vs. alternates) side by side. */
export function OptionsTable({
  options,
  selectedId,
  onSelect,
}: {
  options: PlanOption[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-y-1 text-[12px]">
      <thead>
        <tr className="text-left text-faint">
          <th className="px-2 py-1">Option</th>
          <th className="px-2 py-1">Levers</th>
          <th className="px-2 py-1 text-right">Relief</th>
          <th className="px-2 py-1 text-right">Cost</th>
          <th className="px-2 py-1 text-right">Unserved</th>
        </tr>
      </thead>
      <tbody>
        {options.map((o) => (
          <tr
            key={o.id}
            onClick={() => onSelect?.(o.id)}
            className={cn(
              "cursor-pointer rounded-md",
              o.id === selectedId ? "bg-brand-soft" : "hover:bg-surface-2",
            )}
          >
            <td className="px-2 py-1.5 font-medium text-text">
              {o.label}
              {o.recommended && <span className="ml-1 text-[10px] text-brand">★</span>}
            </td>
            <td className="px-2 py-1.5">
              <div className="flex flex-wrap gap-1">
                {o.levers.map((l) => (
                  <LeverChip key={l.lever} lever={l.lever} size="sm" />
                ))}
              </div>
            </td>
            <td className="num px-2 py-1.5 text-right">{formatKw(o.totalReliefKw)}</td>
            <td className="num px-2 py-1.5 text-right">{formatRupees(o.totalCostRs)}</td>
            <td className="num px-2 py-1.5 text-right">{formatKw(o.unservedKw)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

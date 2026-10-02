import { heatVar } from "@/lib/heat";
import { clamp, formatKw } from "@/lib/format";
import type { SensitivityCell } from "@/lib/api/types";

/** Grid of unserved-kW outcomes across lever-delta% (columns) x gap-delta% (rows). */
export function SensitivityMatrix({ cells, leverDeltas, gapDeltas }: { cells: SensitivityCell[]; leverDeltas: number[]; gapDeltas: number[] }) {
  const maxUnserved = Math.max(1, ...cells.map((c) => c.unservedKw));
  const byKey = new Map(cells.map((c) => [`${c.leverDeltaPct}:${c.gapDeltaPct}`, c]));

  return (
    <table className="border-separate" style={{ borderSpacing: 2 }}>
      <thead>
        <tr>
          <th className="w-20 text-[10px] text-faint">Gap \\ Lever</th>
          {leverDeltas.map((d) => (
            <th key={d} className="num text-[10px] font-normal text-faint">
              {d > 0 ? "+" : ""}
              {d}%
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {gapDeltas.map((g) => (
          <tr key={g}>
            <th scope="row" className="num pr-2 text-left text-[11px] font-normal text-muted">
              {g > 0 ? "+" : ""}
              {g}%
            </th>
            {leverDeltas.map((l) => {
              const cell = byKey.get(`${l}:${g}`);
              const fraction = cell ? clamp(cell.unservedKw / maxUnserved, 0, 1) : 0;
              return (
                <td key={l} title={cell ? `Unserved ${formatKw(cell.unservedKw)}` : "n/a"}>
                  <div
                    className="flex h-9 w-14 items-center justify-center rounded text-[10px] text-text"
                    style={{ background: cell ? heatVar(fraction) : "var(--heat-empty)" }}
                  >
                    {cell ? cell.unservedKw.toFixed(0) : "—"}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

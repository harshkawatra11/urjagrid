import { ChartFrame } from "./common";
import { heatVar, heatVarEmpty } from "@/lib/heat";

export type HourHeatmapCell = { row: string; hour: number; value: number | null };

/** 24-hour x N-row heat matrix (e.g. one row per sub-division, one column per hour of day). */
export function HourHeatmap({
  rows,
  cells,
  label = "Hourly heatmap",
  cellSize = 18,
}: {
  rows: string[];
  cells: HourHeatmapCell[];
  label?: string;
  cellSize?: number;
}) {
  const byKey = new Map(cells.map((c) => [`${c.row}:${c.hour}`, c.value]));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <ChartFrame label={label}>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="w-20" />
              {hours.map((h) => (
                <th key={h} className="text-[10px] font-normal text-faint" style={{ width: cellSize }}>
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row" className="pr-2 text-left text-[11px] font-normal text-muted">
                  {row}
                </th>
                {hours.map((h) => {
                  const v = byKey.get(`${row}:${h}`) ?? null;
                  return (
                    <td key={h} title={`${row} ${h}:00 ${v === null ? "n/a" : v.toFixed(2)}`}>
                      <div
                        style={{
                          width: cellSize,
                          height: cellSize,
                          background: v === null ? heatVarEmpty() : heatVar(v),
                          borderRadius: 3,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

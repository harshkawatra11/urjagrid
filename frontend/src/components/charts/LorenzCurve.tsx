"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_LINE, ChartFrame, ChartLegend, GRID_PROPS } from "./common";

export type LorenzPoint = { cumulativePopulationPct: number; cumulativeServedPct: number };

/** Lorenz curve of served-energy fairness against the equality diagonal. Closer to the diagonal is fairer. */
export function LorenzCurve({
  points,
  height = 220,
  label = "Fairness Lorenz curve",
}: {
  points: LorenzPoint[];
  height?: number;
  label?: string;
}) {
  const data = points.map((p) => ({ ...p, equality: p.cumulativePopulationPct }));
  return (
    <ChartFrame label={label}>
      <ChartLegend
        items={[
          { label: "Served fraction", color: "var(--series-1)" },
          { label: "Perfect equality", color: "var(--text-faint)", dashed: true },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="cumulativePopulationPct"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              type="number"
              domain={[0, 100]}
              unit="%"
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} domain={[0, 100]} unit="%" />
            <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip unit="%" />} />
            <Line
              type="linear"
              dataKey="equality"
              name="Perfect equality"
              stroke="var(--text-faint)"
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeServedPct"
              name="Served fraction"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

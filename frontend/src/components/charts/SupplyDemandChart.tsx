"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_LINE, ChartFrame, ChartLegend, GRID_PROPS } from "./common";

export type SupplyDemandPoint = { x: string; demandKw: number; availableKw: number };

/** Demand line against the available-supply area; the gap between them is the deficit. */
export function SupplyDemandChart({
  data,
  height = 220,
  label = "Supply vs demand",
}: {
  data: SupplyDemandPoint[];
  height?: number;
  label?: string;
}) {
  return (
    <ChartFrame label={label}>
      <ChartLegend
        items={[
          { label: "Available supply", color: "var(--google-green)" },
          { label: "Demand", color: "var(--orange)" },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <ComposedChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="x" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip unit="kW" />} />
            <Area
              type="monotone"
              dataKey="availableKw"
              name="Available supply"
              stroke="var(--google-green)"
              fill="var(--google-green)"
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="demandKw"
              name="Demand"
              stroke="var(--orange)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

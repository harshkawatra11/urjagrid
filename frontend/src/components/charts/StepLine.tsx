"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_LINE, ChartFrame, GRID_PROPS } from "./common";

export type StepLinePoint = { x: string; value: number };

/** Step-interpolated line, for discrete per-interval values like cap level or meter state over time. */
export function StepLine({
  data,
  name = "Value",
  color = "var(--series-1)",
  unit = "",
  height = 160,
  label = "Step chart",
}: {
  data: StepLinePoint[];
  name?: string;
  color?: string;
  unit?: string;
  height?: number;
  label?: string;
}) {
  return (
    <ChartFrame label={label}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="x" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip unit={unit} />} />
            <Line type="stepAfter" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_BAND, ChartFrame, ChartLegend, GRID_PROPS } from "./common";

export type CompareBarRow = { label: string; solution: number; baseline: number };

/** Grouped bars comparing the UrjaGrid solution against the shadow (status-quo) baseline, per category. */
export function CompareBars({
  rows,
  unit = "",
  height = 220,
  label = "Solution vs baseline",
}: {
  rows: CompareBarRow[];
  unit?: string;
  height?: number;
  label?: string;
}) {
  return (
    <ChartFrame label={label}>
      <ChartLegend
        items={[
          { label: "UrjaGrid", color: "var(--google-green)" },
          { label: "Baseline (shedding)", color: "var(--text-faint)" },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <BarChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_BAND} content={<ChartTooltip unit={unit} />} />
            <Bar dataKey="solution" name="UrjaGrid" fill="var(--google-green)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="baseline" name="Baseline (shedding)" fill="var(--text-faint)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

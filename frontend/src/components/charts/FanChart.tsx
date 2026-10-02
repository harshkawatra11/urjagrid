"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_LINE, ChartFrame, ChartLegend, GRID_PROPS } from "./common";

export type FanChartPoint = {
  x: string;
  p10: number;
  p50: number;
  p90: number;
  actual?: number | null;
};

/**
 * Quantile forecast fan: P10/P90 shaded band, P50 median line, actual (when known), and a
 * horizontal limit line (e.g. DT thermal/available-supply limit). Used by /forecast and
 * transformer case files.
 */
export function FanChart({
  data,
  limitKw,
  height = 240,
  unit = "kW",
  label = "Forecast fan chart",
}: {
  data: FanChartPoint[];
  limitKw?: number;
  height?: number;
  unit?: string;
  label?: string;
}) {
  const band = data.map((d) => ({ ...d, bandLow: d.p10, bandSpan: Math.max(0, d.p90 - d.p10) }));
  return (
    <ChartFrame label={label}>
      <ChartLegend
        items={[
          { label: "P50 median", color: "var(--series-1)" },
          { label: "P10–P90 band", color: "var(--series-1)", dashed: true },
          ...(data.some((d) => d.actual != null) ? [{ label: "Actual", color: "var(--series-2)" }] : []),
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <ComposedChart data={band} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="x" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip unit={unit} />} />
            {limitKw !== undefined && (
              <ReferenceLine
                y={limitKw}
                stroke="var(--red)"
                strokeDasharray="4 4"
                label={{ value: "Limit", position: "insideTopRight", fill: "var(--red)", fontSize: 11 }}
              />
            )}
            <Area dataKey="bandLow" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area
              dataKey="bandSpan"
              stackId="band"
              stroke="none"
              fill="var(--series-1)"
              fillOpacity={0.14}
              isAnimationActive={false}
              name="P10-P90 band"
            />
            <Line type="monotone" dataKey="p50" name="P50 median" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {band.some((d) => d.actual != null) && (
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="var(--series-2)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

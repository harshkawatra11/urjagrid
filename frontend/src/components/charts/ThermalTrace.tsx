"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_LINE, ChartFrame, ChartLegend, GRID_PROPS } from "./common";

export type ThermalTracePoint = { x: string; hotspotC: number; loadingPu: number };

/** DT hotspot temperature and pu loading over time, with alarm (110C) and limit (120C) reference lines. */
export function ThermalTrace({
  data,
  alarmC = 110,
  limitC = 120,
  height = 220,
  label = "Transformer thermal trace",
}: {
  data: ThermalTracePoint[];
  alarmC?: number;
  limitC?: number;
  height?: number;
  label?: string;
}) {
  return (
    <ChartFrame label={label}>
      <ChartLegend items={[{ label: "Hot-spot °C", color: "var(--orange)" }]} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="x" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip unit="°C" />} />
            <ReferenceLine y={alarmC} stroke="var(--amber)" strokeDasharray="4 4" label={{ value: "Alarm", position: "insideTopRight", fill: "var(--amber)", fontSize: 11 }} />
            <ReferenceLine y={limitC} stroke="var(--red)" strokeDasharray="4 4" label={{ value: "Limit", position: "insideTopRight", fill: "var(--red)", fontSize: 11 }} />
            <Line type="monotone" dataKey="hotspotC" name="Hot-spot °C" stroke="var(--orange)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, CURSOR_BAND, ChartFrame, GRID_PROPS } from "./common";
import { LEVER_COLOR_VAR, LEVER_SHORT_LABEL, cssVar, type LeverKey } from "@/lib/domain";

export type LeverWaterfallBar = { lever: LeverKey; reliefKw: number };

/**
 * Stacked-step waterfall of relief contributed by each lever, in the canonical L1-L6 order,
 * so a JE can see at a glance how a Flex Plan covers the deficit.
 */
export function LeverWaterfall({
  bars,
  height = 220,
  label = "Lever relief waterfall",
}: {
  bars: LeverWaterfallBar[];
  height?: number;
  label?: string;
}) {
  let running = 0;
  const data = bars.map((b) => {
    const base = running;
    running += b.reliefKw;
    return { ...b, base, name: LEVER_SHORT_LABEL[b.lever] };
  });

  return (
    <ChartFrame label={label}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={CURSOR_BAND} content={<ChartTooltip unit="kW" />} />
            <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="reliefKw" name="Relief" stackId="w" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.lever} fill={cssVar(LEVER_COLOR_VAR[d.lever])} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

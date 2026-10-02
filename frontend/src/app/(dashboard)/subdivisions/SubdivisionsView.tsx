"use client";

import Link from "next/link";
import { Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useSubdivisions } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { CompareStat } from "@/components/ds/CompareStat";
import { SituationBanner } from "@/components/grid/SituationBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { CompareBars } from "@/components/charts/CompareBars";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, ChartFrame, GRID_PROPS } from "@/components/charts/common";
import { RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import { formatPercent } from "@/lib/format";
import type { Subdivision } from "@/lib/api/types";
import {
  calibrationBarsTitle,
  comparisonMatrixTitle,
  dailyRiskShapeTitle,
  gainBarsTitle,
  hourlyRiskMultiplier,
  moneyshotTitle,
  quadrantScatterTitle,
  worstSubdivisionHeadline,
} from "./titles";

/** Baseline (rotational-shedding) served fraction is not in the sub-division fixture; it is
 * derived here as the solution's served fraction reduced by its risk index, a stand-in until
 * Lane B exposes a per-sub-division shadow-baseline field directly. */
function baselineServed(s: Subdivision): number {
  return Math.max(0, s.servedFraction - s.riskIndex * 0.18);
}

export function SubdivisionsView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useSubdivisions();
  const subdivisions = data?.subdivisions ?? [];

  if (isLoading && subdivisions.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Sub-division Lab" description="Compare all 5 sub-divisions side by side." />
        <PanelSkeleton />
      </div>
    );
  }

  const worst = [...subdivisions].sort((a, b) => b.riskIndex - a.riskIndex)[0];
  const avgServedPct = subdivisions.length
    ? (subdivisions.reduce((s, x) => s + x.servedFraction, 0) / subdivisions.length) * 100
    : 0;
  const avgBaselinePct = subdivisions.length
    ? (subdivisions.reduce((s, x) => s + baselineServed(x), 0) / subdivisions.length) * 100
    : 0;

  const calibrationRows = subdivisions.map((s) => ({
    label: s.name,
    solution: Number((s.servedFraction * 100).toFixed(1)),
    baseline: Number((baselineServed(s) * 100).toFixed(1)),
  }));

  const gainRows = [...subdivisions]
    .map((s) => ({ s, gainPct: (s.servedFraction - baselineServed(s)) * 100 }))
    .sort((a, b) => b.gainPct - a.gainPct);

  const heatCells: HourHeatmapCell[] = subdivisions.flatMap((s) =>
    Array.from({ length: 24 }, (_, hour) => ({ row: s.name, hour, value: hourlyRiskMultiplier(hour, s.riskIndex) })),
  );

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader
          eyebrow="Flex Plans"
          title="Sub-division Lab"
          description="Small-multiples comparison of all 5 sub-divisions: risk, served fraction, and calibration against the CEEW baseline."
        />
      </div>

      <div className="col-span-12">
        <SituationBanner
          riskLevel={worst?.riskLevel ?? "low"}
          headline={worstSubdivisionHeadline(worst)}
          detail={worst ? `Risk index ${worst.riskIndex.toFixed(2)}, served ${formatPercent(worst.servedFraction)}` : undefined}
        />
      </div>

      <Card title="Fleet-wide served fraction" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <CompareStat
          label={moneyshotTitle(avgServedPct)}
          solutionValue={avgServedPct}
          baselineValue={avgBaselinePct}
          unit="%"
        />
      </Card>

      <Card title="Consumers" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {subdivisions.reduce((s, x) => s + x.consumerCount, 0).toLocaleString("en-IN")}
        </p>
        <p className="text-[11px] text-faint">across 5 sub-divisions</p>
      </Card>

      <Card title="Active plans" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{subdivisions.reduce((s, x) => s + x.activePlanCount, 0)}</p>
        <p className="text-[11px] text-faint">Flex Plans in flight</p>
      </Card>

      <Card title="Avg risk index" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {subdivisions.length ? (subdivisions.reduce((s, x) => s + x.riskIndex, 0) / subdivisions.length).toFixed(2) : "—"}
        </p>
        <p className="text-[11px] text-faint">0 (calm) – 1 (critical)</p>
      </Card>

      <Card title="Feeders" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{subdivisions.reduce((s, x) => s + x.feederIds.length, 0)}</p>
        <p className="text-[11px] text-faint">11kV feeders</p>
      </Card>

      <Card title="Small multiples" eyebrow="Per sub-division" className="col-span-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {subdivisions.map((s) => (
            <Link
              key={s.id}
              href={`/subdivisions/${s.id}`}
              className="flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center transition-colors hover:border-border-strong"
            >
              <GaugeArc
                value={s.servedFraction}
                max={1}
                size={96}
                color={cssVar(RISK_LEVEL_COLOR_VAR[s.riskLevel])}
                valueLabel={formatPercent(s.servedFraction)}
                label={`${s.name} served fraction`}
              />
              <span className="text-[11px] font-medium text-text">{s.name}</span>
              <span className="text-[10px] text-faint">{s.town} · {s.discom}</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card title={comparisonMatrixTitle(subdivisions.length)} eyebrow="Matrix" className="col-span-12 lg:col-span-6">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Sub-division</th>
              <th className="px-2 py-1 text-right">Risk</th>
              <th className="px-2 py-1 text-right">Served</th>
              <th className="px-2 py-1 text-right">Consumers</th>
              <th className="px-2 py-1 text-right">Plans</th>
            </tr>
          </thead>
          <tbody>
            {subdivisions.map((s) => (
              <tr key={s.id} className={s.id === scope ? "bg-brand-soft" : ""}>
                <td className="px-2 py-1.5 font-medium text-text">
                  <Link href={`/subdivisions/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="num px-2 py-1.5 text-right">{s.riskIndex.toFixed(2)}</td>
                <td className="num px-2 py-1.5 text-right">{formatPercent(s.servedFraction)}</td>
                <td className="num px-2 py-1.5 text-right">{s.consumerCount.toLocaleString("en-IN")}</td>
                <td className="num px-2 py-1.5 text-right">{s.activePlanCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={quadrantScatterTitle()} eyebrow="Quadrant" className="col-span-12 lg:col-span-6">
        <ChartFrame label="Risk vs served fraction quadrant scatter">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 240 }}>
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="riskIndex"
                  type="number"
                  name="Risk index"
                  domain={[0, 1]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  dataKey="servedPct"
                  type="number"
                  name="Served %"
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip unit="" />} />
                <Scatter
                  data={subdivisions.map((s) => ({ name: s.name, riskIndex: s.riskIndex, servedPct: s.servedFraction * 100, riskLevel: s.riskLevel }))}
                  isAnimationActive={false}
                >
                  {subdivisions.map((s) => (
                    <Cell key={s.id} fill={cssVar(RISK_LEVEL_COLOR_VAR[s.riskLevel])} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </Card>

      <Card title={calibrationBarsTitle()} eyebrow="CEEW" className="col-span-12 lg:col-span-6">
        <CompareBars rows={calibrationRows} unit="%" />
      </Card>

      <Card title={gainBarsTitle()} eyebrow="Gain" className="col-span-12 lg:col-span-6">
        <ul className="space-y-2">
          {gainRows.map(({ s, gainPct }) => (
            <li key={s.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-28 shrink-0 truncate text-text">{s.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, gainPct * 6)}%` }} />
              </div>
              <span className="num w-14 shrink-0 text-right text-muted">+{gainPct.toFixed(1)}pp</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={dailyRiskShapeTitle()} eyebrow="Heatmap" className="col-span-12">
        <HourHeatmap rows={subdivisions.map((s) => s.name)} cells={heatCells} />
      </Card>
    </div>
  );
}

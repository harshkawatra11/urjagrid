"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useScope } from "@/lib/scope";
import { useTransformers } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { SituationBanner } from "@/components/grid/SituationBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, ChartFrame, CURSOR_BAND, GRID_PROPS } from "@/components/charts/common";
import { heatVar } from "@/lib/heat";
import { RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import { cn } from "@/lib/cn";
import type { Transformer } from "@/lib/api/types";
import { LENSES, LENS_LABEL, dominantDriver, directoryTitle, lensUnit, lensValue, moneyshotTitle, type Lens } from "./titles";

/** Normalizes a lens value to 0..1 (1 = worst) for tile coloring, consistent across lenses. */
function normalize(lens: Lens, value: number): number {
  switch (lens) {
    case "risk":
      return value;
    case "loading":
      return Math.min(1, Math.max(0, value / 1.3));
    case "hotspot":
      return Math.min(1, Math.max(0, (value - 90) / 30));
    case "voltage":
      return Math.min(1, Math.max(0, Math.abs(value - 1) / 0.06));
    case "served":
      return Math.min(1, Math.max(0, 1 - value));
  }
}

export function TransformersView() {
  const { scope } = useScope();
  const [lens, setLens] = useState<Lens>("risk");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, offline } = useTransformers(scope);
  const transformers = data?.transformers ?? [];

  if (isLoading && transformers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Transformers" description="Every DT, one lens at a time." />
        <PanelSkeleton />
      </div>
    );
  }

  const ranked = [...transformers].sort((a, b) => lensValue(b, lens) - lensValue(a, lens));
  const worst = ranked[0];
  const histogramBuckets = Array.from({ length: 5 }, (_, i) => ({
    bucket: `${i * 20}-${i * 20 + 20}%`,
    count: transformers.filter((t) => {
      const n = normalize(lens, lensValue(t, lens));
      return n >= i / 5 && n < (i + 1) / 5;
    }).length,
  }));
  const driverCounts = transformers.reduce<Record<string, number>>((acc, t) => {
    const d = dominantDriver(t);
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

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
          title="Transformers"
          description="Directory of every distribution transformer; switch lens to re-color the tile grid and ranked table."
        />
      </div>

      <div className="col-span-12">
        <SituationBanner
          riskLevel={worst?.riskLevel ?? "low"}
          headline={moneyshotTitle(worst)}
          detail={worst ? `${LENS_LABEL[lens]}: ${lensValue(worst, lens).toFixed(2)} ${lensUnit(lens)}` : undefined}
        />
      </div>

      <Card title="Lens" eyebrow="Switch" className="col-span-12 lg:col-span-3">
        <div className="flex flex-col gap-2">
          {LENSES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLens(l)}
              className={cn(
                "h-8 rounded-md border px-3 text-left text-[12px] font-medium",
                lens === l ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-border-strong",
              )}
            >
              {LENS_LABEL[l]}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Fleet average" eyebrow="Moneyshot" className="col-span-6 lg:col-span-3">
        <GaugeArc
          value={transformers.length ? transformers.reduce((s, t) => s + normalize(lens, lensValue(t, lens)), 0) / transformers.length : 0}
          valueLabel={`${LENS_LABEL[lens]}`}
          label="Fleet average lens value"
        />
      </Card>

      <Card title="Count" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{transformers.length}</p>
        <p className="text-[11px] text-faint">transformers in scope</p>
      </Card>

      <Card title="Distribution" eyebrow="Histogram" className="col-span-12 lg:col-span-4">
        <ChartFrame label={`${LENS_LABEL[lens]} distribution histogram`}>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 160 }}>
              <BarChart data={histogramBuckets} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="bucket" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={CURSOR_BAND} content={<ChartTooltip unit="DTs" />} />
                <Bar dataKey="count" name="DTs" fill="var(--brand)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </Card>

      <Card title="Tile grid" eyebrow={`Lens: ${LENS_LABEL[lens]}`} className="col-span-12">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5" role="list" aria-label="Transformer tile grid">
          {ranked.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.name} · ${LENS_LABEL[lens]} ${lensValue(t, lens).toFixed(2)} ${lensUnit(lens)}`}
              onClick={() => setSelected(t.id)}
              className={cn("flex h-10 items-center justify-center rounded text-[10px] font-medium text-text", selected === t.id && "ring-2 ring-brand")}
              style={{ background: heatVar(normalize(lens, lensValue(t, lens))) }}
            >
              {t.id.replace("dt_", "")}
            </button>
          ))}
        </div>
      </Card>

      <Card title={directoryTitle(ranked.length, lens)} eyebrow="Ranked table" className="col-span-12 lg:col-span-7">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">DT</th>
              <th className="px-2 py-1 text-right">{LENS_LABEL[lens]}</th>
              <th className="px-2 py-1 text-right">Consumers</th>
              <th className="px-2 py-1 text-right">Served</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((t: Transformer) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 text-text">
                  <Link href={`/transformers/${t.id}`} className="hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="num px-2 py-1.5 text-right" style={{ color: cssVar(RISK_LEVEL_COLOR_VAR[t.riskLevel]) }}>
                  {lensValue(t, lens).toFixed(2)} {lensUnit(lens)}
                </td>
                <td className="num px-2 py-1.5 text-right">{t.consumerCount}</td>
                <td className="num px-2 py-1.5 text-right">{(t.servedFraction * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Risk drivers" eyebrow="Breakdown" className="col-span-12 lg:col-span-5">
        <ul className="space-y-2">
          {(["loading", "hotspot", "voltage"] as const).map((d) => (
            <li key={d} className="flex items-center justify-between text-[12px]">
              <span className="capitalize text-muted">{d === "loading" ? "Overload-driven" : d === "hotspot" ? "Hot-spot-driven" : "Voltage-driven"}</span>
              <span className="num text-text">{driverCounts[d] ?? 0} DTs</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-faint">Dominant driver per DT = largest of (loading − 1)/0.3, (hot-spot − 90)/30, |voltage − 1|/0.06.</p>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useScope } from "@/lib/scope";
import { useTransformers } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { ThermalTrace } from "@/components/charts/ThermalTrace";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import { alarmCount, hourlyThermalTrace, moneyshotTitle, overloadedCount, tripRiskCount } from "./titles";

export function ThermalView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useTransformers(scope);
  const transformers = data?.transformers ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? transformers[0]?.id ?? null;
  const active = transformers.find((t) => t.id === activeId);

  if (isLoading && transformers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Network" title="Transformer Health" description="IEEE C57.91 thermal model: hot-spot, loss-of-life, trip risk." />
        <PanelSkeleton />
      </div>
    );
  }

  const heatCells: HourHeatmapCell[] = transformers.flatMap((t) =>
    hourlyThermalTrace(t).map((p, i) => ({ row: t.name, hour: 12 + i, value: p.loadingPu / 1.3 })),
  );
  const tripsAvoided = tripRiskCount(transformers);

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Network" title="Transformer Health" description="Hot-spot temperature, ageing (loss-of-life), and trip risk per transformer." />
      </div>

      <Card title="Trips avoided" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{tripsAvoided}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(tripsAvoided)}</p>
      </Card>

      <Card title="Overloaded (≥1.0pu)" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{overloadedCount(transformers)}</p>
      </Card>

      <Card title="Hot-spot alarm (≥110°C)" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{alarmCount(transformers)}</p>
      </Card>

      <Card title="Trip risk (≥1.30pu)" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{tripRiskCount(transformers)}</p>
      </Card>

      <Card title="Avg loss-of-life" eyebrow="Ageing" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {transformers.length ? (transformers.reduce((s, t) => s + t.lossOfLifePct, 0) / transformers.length).toFixed(1) : "—"}%
        </p>
      </Card>

      <Card title="Select transformer" eyebrow="Trace" className="col-span-12 lg:col-span-3">
        <select
          value={activeId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        >
          {transformers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {active && (
          <div className="mt-3">
            <GaugeArc value={active.hotspotC} max={130} valueLabel={`${active.hotspotC.toFixed(1)}°C`} color={cssVar(RISK_LEVEL_COLOR_VAR[active.riskLevel])} label="Hot-spot gauge" />
          </div>
        )}
      </Card>

      <Card title="Thermal trace" eyebrow={active?.name ?? "—"} className="col-span-12 lg:col-span-9">
        <ThermalTrace data={active ? hourlyThermalTrace(active) : []} />
      </Card>

      <Card title="Fleet loading heat (evening)" eyebrow="Heatmap" className="col-span-12">
        <HourHeatmap rows={transformers.map((t) => t.name)} cells={heatCells} />
      </Card>

      <Card title="Ageing / loss-of-life by transformer" eyebrow="Table" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Transformer</th>
              <th className="px-2 py-1 text-right">Hot-spot</th>
              <th className="px-2 py-1 text-right">Loading</th>
              <th className="px-2 py-1 text-right">Loss-of-life</th>
            </tr>
          </thead>
          <tbody>
            {transformers.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 text-text">{t.name}</td>
                <td className="num px-2 py-1.5 text-right">{t.hotspotC.toFixed(1)}°C</td>
                <td className="num px-2 py-1.5 text-right">{t.loadingPu.toFixed(2)} pu</td>
                <td className="num px-2 py-1.5 text-right">{t.lossOfLifePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

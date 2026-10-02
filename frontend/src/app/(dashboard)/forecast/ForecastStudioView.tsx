"use client";

import { useState } from "react";
import { useTransformers, useForecast, useForecastBacktest, useForecastImportance } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { StatusTag } from "@/components/ds/StatusTag";
import { FanChart, type FanChartPoint } from "@/components/charts/FanChart";
import { SupplyDemandChart, type SupplyDemandPoint } from "@/components/charts/SupplyDemandChart";
import { ChartFrame } from "@/components/charts/common";
import { heatVar } from "@/lib/heat";
import { formatIstTime } from "@/lib/format";
import { coverageStatus, importanceTitle, moneyshotTitle } from "./titles";

export function ForecastStudioView() {
  const { data: transformersData, isLoading: tLoading, offline } = useTransformers("all");
  const transformers = transformersData?.transformers ?? [];
  const [dtId, setDtId] = useState<string | null>(null);
  const activeDtId = dtId ?? transformers[0]?.id ?? null;

  const { data: bundle, isLoading: fLoading } = useForecast(activeDtId);
  const { data: backtest } = useForecastBacktest();
  const { data: importanceData } = useForecastImportance();
  const features = importanceData?.features ?? [];

  if ((tLoading && transformers.length === 0) || (fLoading && !bundle)) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Forecast Studio" description="Per-transformer quantile forecast, backtest KPIs, and feature importance." />
        <PanelSkeleton />
      </div>
    );
  }

  const fanPoints: FanChartPoint[] = (bundle?.points ?? []).map((p) => ({
    x: formatIstTime(p.slotIso),
    p10: p.p10Kw,
    p50: p.p50Kw,
    p90: p.p90Kw,
    actual: p.actualKw,
  }));
  const supplyDemandPoints: SupplyDemandPoint[] = (bundle?.points ?? []).map((p) => ({
    x: formatIstTime(p.slotIso),
    demandKw: p.p50Kw,
    availableKw: p.availableKw,
  }));
  const maxFeature = Math.max(0.01, ...features.map((f) => f.importance));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader
          eyebrow="Insights"
          title="Forecast Studio"
          description="LightGBM P10/P50/P90 quantile forecast per DT, backtested against held-out history."
          actions={<StatusTag status="LIVE" title="Forecaster runs real LightGBM quantile models; falls back to seasonal-naive without trained artifacts." />}
        />
      </div>

      <Card title="Transformer" eyebrow="Select" className="col-span-12 lg:col-span-3">
        <select
          value={activeDtId ?? ""}
          onChange={(e) => setDtId(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        >
          {transformers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-faint">{bundle?.deficitWindows.length ?? 0} deficit window(s) in the 36h horizon.</p>
      </Card>

      <Card title="Backtest accuracy" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[22px] font-semibold text-text">{backtest?.wapePct.toFixed(1) ?? "—"}% WAPE</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(backtest)}</p>
      </Card>

      <Card title="Coverage" eyebrow={coverageStatus(backtest)} className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{backtest?.coveragePct.toFixed(1) ?? "—"}%</p>
        <p className="text-[11px] text-faint">target {backtest?.targetCoveragePct ?? 80}%</p>
      </Card>

      <Card title="Skill score" eyebrow="vs seasonal-naive" className="col-span-6 lg:col-span-3">
        <p className="num text-[22px] font-semibold text-text">{backtest?.skillScore.toFixed(2) ?? "—"}</p>
      </Card>

      <Card title="P10/P50/P90 fan" eyebrow="36h horizon" className="col-span-12 lg:col-span-8">
        <FanChart data={fanPoints} limitKw={bundle?.points[0]?.limitKw} />
      </Card>

      <Card title="Available supply vs forecast demand" eyebrow="Gap" className="col-span-12 lg:col-span-4">
        <SupplyDemandChart data={supplyDemandPoints} />
      </Card>

      <Card title={importanceTitle(features.length)} eyebrow="Feature importance" className="col-span-12 lg:col-span-6">
        <ul className="space-y-1.5">
          {features.map((f) => (
            <li key={f.name} className="flex items-center gap-2 text-[12px]">
              <span className="w-36 shrink-0 truncate font-mono text-[11px] text-muted">{f.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${(f.importance / maxFeature) * 100}%` }} />
              </div>
              <span className="num w-10 shrink-0 text-right text-faint">{(f.importance * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Forecast quantile matrix" eyebrow="Heatmap" className="col-span-12 lg:col-span-6">
        <ChartFrame label="Quantile matrix across the forecast horizon">
          <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="w-20" />
                  {(bundle?.points ?? []).map((p) => (
                    <th key={p.slotIso} className="text-[9px] font-normal text-faint">
                      {formatIstTime(p.slotIso)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["p10Kw", "p50Kw", "p90Kw"] as const).map((key) => {
                  const values = (bundle?.points ?? []).map((p) => p[key]);
                  const max = Math.max(1, ...values);
                  return (
                    <tr key={key}>
                      <th scope="row" className="pr-2 text-left text-[11px] font-normal text-muted">
                        {key.replace("Kw", "")}
                      </th>
                      {values.map((v, i) => (
                        <td key={i} title={`${v.toFixed(0)} kW`}>
                          <div style={{ width: 18, height: 18, background: heatVar(v / max), borderRadius: 3 }} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </Card>

      <Card title="Deficit windows" eyebrow="This DT" className="col-span-12">
        {(bundle?.deficitWindows.length ?? 0) === 0 ? (
          <p className="text-[12px] text-faint">No deficit windows forecast for this transformer.</p>
        ) : (
          <table className="w-full border-separate border-spacing-y-1 text-[12px]">
            <thead>
              <tr className="text-left text-faint">
                <th className="px-2 py-1">Window</th>
                <th className="px-2 py-1 text-right">Gap</th>
                <th className="px-2 py-1">Thermal risk</th>
              </tr>
            </thead>
            <tbody>
              {bundle?.deficitWindows.map((w) => (
                <tr key={w.id}>
                  <td className="px-2 py-1.5 text-text">{formatIstTime(w.startIso)} – {formatIstTime(w.endIso)}</td>
                  <td className="num px-2 py-1.5 text-right">{w.gapKw.toFixed(0)} kW</td>
                  <td className="px-2 py-1.5">{w.thermalRisk ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

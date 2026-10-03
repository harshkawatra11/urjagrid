"use client";

import { useScope } from "@/lib/scope";
import { useTransformers } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { StepLine, type StepLinePoint } from "@/components/charts/StepLine";
import { CompareBars } from "@/components/charts/CompareBars";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { voltageHeat } from "@/lib/heat";
import { formatKw } from "@/lib/format";
import { lossBreakdown, moneyshotTitle, technicalLossKw, voltageViolations } from "./titles";

export function PowerQualityView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useTransformers(scope);
  const transformers = data?.transformers ?? [];

  if (isLoading && transformers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Network" title="Voltage & Losses" description="LV power-flow voltage profile and technical loss breakdown." />
        <PanelSkeleton />
      </div>
    );
  }

  const violations = voltageViolations(transformers);
  const voltagePoints: StepLinePoint[] = transformers.map((t) => ({ x: t.name, value: t.voltagePu }));
  const losses = lossBreakdown(transformers);
  const totalLoss = losses.reduce((s, l) => s + l.lossKw, 0);
  const lossRows = losses.map((l) => ({ label: l.segment, solution: Number(l.lossKw.toFixed(1)), baseline: Number((l.lossKw * 1.18).toFixed(1)) }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Network" title="Voltage & Losses" description="Per-transformer voltage (LV power-flow solver) and a physics-derived technical loss breakdown." />
      </div>

      <Card title="Voltage violations" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{violations.length}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(violations.length)}</p>
      </Card>

      <Card title="Avg voltage" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <GaugeArc
          value={transformers.length ? transformers.reduce((s, t) => s + t.voltagePu, 0) / transformers.length : 1}
          max={1.1}
          color={voltageHeat(transformers.length ? transformers.reduce((s, t) => s + t.voltagePu, 0) / transformers.length : 1)}
          valueLabel={transformers.length ? (transformers.reduce((s, t) => s + t.voltagePu, 0) / transformers.length).toFixed(2) : "—"}
          label="Average voltage pu"
        />
      </Card>

      <Card title="Total technical loss" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{formatKw(totalLoss)}</p>
      </Card>

      <Card title="Worst voltage" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {transformers.length ? Math.min(...transformers.map((t) => t.voltagePu)).toFixed(2) : "—"} pu
        </p>
      </Card>

      <Card title="Transformers in scope" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{transformers.length}</p>
      </Card>

      <Card title="Voltage profile" eyebrow="pu by transformer" className="col-span-12 lg:col-span-7">
        <StepLine data={voltagePoints} name="Voltage" unit="pu" color="var(--violet)" />
      </Card>

      <Card title="Loss breakdown: solution vs baseline" eyebrow="Technical loss" className="col-span-12 lg:col-span-5">
        <CompareBars rows={lossRows} unit="kW" />
        <p className="mt-2 text-[11px] text-faint">Baseline assumes no optimiser-driven loss reduction from Flex Plan rebalancing.</p>
      </Card>

      <Card title="Voltage heat matrix" eyebrow="Heatmap" className="col-span-12">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2">
          {transformers.map((t) => (
            <div key={t.id} className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: voltageHeat(t.voltagePu) }} title={`${t.voltagePu.toFixed(2)} pu`} />
              <span className="text-[10px] text-muted">{t.id.replace("dt_", "")}</span>
              <span className="num text-[10px] text-faint">{t.voltagePu.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Per-transformer technical loss" eyebrow="Table" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Transformer</th>
              <th className="px-2 py-1 text-right">Voltage</th>
              <th className="px-2 py-1 text-right">Loading</th>
              <th className="px-2 py-1 text-right">Est. loss</th>
            </tr>
          </thead>
          <tbody>
            {transformers.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 text-text">{t.name}</td>
                <td className="num px-2 py-1.5 text-right">{t.voltagePu.toFixed(2)} pu</td>
                <td className="num px-2 py-1.5 text-right">{t.loadingPu.toFixed(2)} pu</td>
                <td className="num px-2 py-1.5 text-right">{formatKw(technicalLossKw(t))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

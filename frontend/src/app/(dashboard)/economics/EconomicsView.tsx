"use client";

import { useState } from "react";
import { useEconomics } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { heatVar } from "@/lib/heat";
import { formatRupees } from "@/lib/format";
import { moneyshotTitle, recomputeEconomics } from "./titles";

export function EconomicsView() {
  const { data, isLoading, offline } = useEconomics();
  const [rebate, setRebate] = useState<number | null>(null);
  const [energyValue, setEnergyValue] = useState<number | null>(null);
  const [drKwh, setDrKwh] = useState<number | null>(null);
  const [avoidedKwh, setAvoidedKwh] = useState<number | null>(null);

  if (isLoading && !data) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Economics" description="Unit economics, money flow, and payback period." />
        <PanelSkeleton />
      </div>
    );
  }

  const assumptions = data?.assumptions ?? {
    rebateRsPerKwh: 2,
    dtFailureCostRs: 0,
    deferredUpgradeCostRs: 0,
    energyValueRsPerKwh: 0,
    monthlyFeeRsPerMeter: 0,
  };
  const summary = data?.summary ?? { paybackMonths: 0, bcr: 0, monthlyFeeRs: 0, annualSavingsRs: 0, nMeters: 0, moneyFlow: [] };

  const effectiveAssumptions = {
    ...assumptions,
    rebateRsPerKwh: rebate ?? assumptions.rebateRsPerKwh,
    energyValueRsPerKwh: energyValue ?? assumptions.energyValueRsPerKwh,
  };
  const monthlyDr = drKwh ?? 500;
  const monthlyAvoided = avoidedKwh ?? 2000;
  const outputs = recomputeEconomics({
    assumptions: effectiveAssumptions,
    nMeters: summary.nMeters,
    monthlyDrKwhShifted: monthlyDr,
    monthlyAvoidedSheddingKwh: monthlyAvoided,
  });

  const flowMax = Math.max(1, ...summary.moneyFlow.map((f) => f.amountRs));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Insights" title="Economics" description="Who pays, who saves, and how fast the software fee pays for itself." />
      </div>

      <Card title="Payback & BCR" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{Number.isFinite(outputs.paybackMonths) ? outputs.paybackMonths.toFixed(1) : "—"} mo</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(outputs.paybackMonths, outputs.bcr)}</p>
      </Card>

      <Card title="Monthly fee" eyebrow="Cost" className="col-span-6 lg:col-span-2">
        <p className="num text-[20px] font-semibold text-text">{formatRupees(outputs.monthlyFeeRs)}</p>
      </Card>
      <Card title="Annual savings" eyebrow="Benefit" className="col-span-6 lg:col-span-2">
        <p className="num text-[20px] font-semibold text-text">{formatRupees(outputs.annualSavingsRs)}</p>
      </Card>
      <Card title="Meters" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[20px] font-semibold text-text">{summary.nMeters.toLocaleString("en-IN")}</p>
      </Card>
      <Card title="BCR" eyebrow="Benefit/cost" className="col-span-6 lg:col-span-2">
        <p className="num text-[20px] font-semibold text-text">{outputs.bcr.toFixed(1)}x</p>
      </Card>

      <Card title="Assumption sliders" eyebrow="Interactive what-if" className="col-span-12 lg:col-span-5">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">DR rebate: ₹{effectiveAssumptions.rebateRsPerKwh.toFixed(2)}/kWh</span>
            <input type="range" min={0} max={5} step={0.1} value={effectiveAssumptions.rebateRsPerKwh} onChange={(e) => setRebate(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Avoided-energy value: ₹{effectiveAssumptions.energyValueRsPerKwh.toFixed(2)}/kWh</span>
            <input type="range" min={0} max={15} step={0.2} value={effectiveAssumptions.energyValueRsPerKwh} onChange={(e) => setEnergyValue(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Monthly DR kWh shifted: {monthlyDr.toFixed(0)}</span>
            <input type="range" min={0} max={2000} step={50} value={monthlyDr} onChange={(e) => setDrKwh(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Monthly avoided-shedding kWh: {monthlyAvoided.toFixed(0)}</span>
            <input type="range" min={0} max={8000} step={100} value={monthlyAvoided} onChange={(e) => setAvoidedKwh(Number(e.target.value))} />
          </label>
        </div>
      </Card>

      <Card title="Money flow" eyebrow="Who pays, who saves" className="col-span-12 lg:col-span-7">
        <svg width="100%" height={220} viewBox="0 0 560 220" role="img" aria-label="Money flow diagram">
          {summary.moneyFlow.map((edge, i) => {
            const y = 20 + i * 40;
            const width = 40 + (edge.amountRs / flowMax) * 300;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <text x={4} y={y - 6} fontSize={10} fill="var(--text-muted)">
                  {edge.from}
                </text>
                <rect x={4} y={y} width={width} height={14} rx={4} fill="var(--google-blue)" opacity={0.75} />
                <text x={width + 10} y={y + 11} fontSize={10} fill="var(--text)">
                  {edge.to} · {formatRupees(edge.amountRs)}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>

      <Card title="BCR gauge" eyebrow="Benefit/cost" className="col-span-12 lg:col-span-4">
        <GaugeArc value={Math.min(outputs.bcr, 5)} max={5} valueLabel={`${outputs.bcr.toFixed(1)}x`} label="Benefit-cost ratio gauge" />
      </Card>

      <Card title="Payback sensitivity" eyebrow="Rebate x energy value (months)" className="col-span-12 lg:col-span-8">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="w-20 text-[10px] text-faint">Rebate \ Energy</th>
              {[0.5, 1, 1.5].map((m) => (
                <th key={m} className="num text-[10px] font-normal text-faint">
                  {(effectiveAssumptions.energyValueRsPerKwh * m).toFixed(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0.5, 1, 1.5].map((rm) => (
              <tr key={rm}>
                <th scope="row" className="num pr-2 text-left text-[11px] font-normal text-muted">
                  {(effectiveAssumptions.rebateRsPerKwh * rm).toFixed(1)}
                </th>
                {[0.5, 1, 1.5].map((em) => {
                  const scenario = recomputeEconomics({
                    assumptions: { ...effectiveAssumptions, rebateRsPerKwh: effectiveAssumptions.rebateRsPerKwh * rm, energyValueRsPerKwh: effectiveAssumptions.energyValueRsPerKwh * em },
                    nMeters: summary.nMeters,
                    monthlyDrKwhShifted: monthlyDr,
                    monthlyAvoidedSheddingKwh: monthlyAvoided,
                  });
                  const months = Number.isFinite(scenario.paybackMonths) ? scenario.paybackMonths : 24;
                  return (
                    <td key={em}>
                      <div
                        className="flex h-9 w-16 items-center justify-center rounded text-[10px] text-text"
                        style={{ background: heatVar(Math.min(1, months / 24)) }}
                      >
                        {Number.isFinite(scenario.paybackMonths) ? scenario.paybackMonths.toFixed(1) : "∞"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Assumptions" eyebrow="Reference" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Parameter</th>
              <th className="px-2 py-1 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="px-2 py-1.5 text-text">DT failure cost</td><td className="num px-2 py-1.5 text-right">{formatRupees(assumptions.dtFailureCostRs)}</td></tr>
            <tr><td className="px-2 py-1.5 text-text">Deferred upgrade cost</td><td className="num px-2 py-1.5 text-right">{formatRupees(assumptions.deferredUpgradeCostRs)}</td></tr>
            <tr><td className="px-2 py-1.5 text-text">Monthly fee per meter</td><td className="num px-2 py-1.5 text-right">{formatRupees(assumptions.monthlyFeeRsPerMeter)}</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

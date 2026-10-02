"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useScope } from "@/lib/scope";
import { useDrBeliefs } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { CompareBars } from "@/components/charts/CompareBars";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { AXIS_TICK, CHART_MARGIN, ChartFrame, ChartLegend, GRID_PROPS, seriesColor } from "@/components/charts/common";
import { SUBDIVISION_LABEL, isSubdivisionId } from "@/lib/scope";
import { formatPercent, formatRupees } from "@/lib/format";
import { beliefTitle, densityCurve, moneyshotTitle, totalRebate, totalShifted } from "./titles";

export function DrView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useDrBeliefs(scope);
  const beliefs = data?.beliefs ?? [];
  const ledger = data?.rebateLedger ?? [];

  if (isLoading && beliefs.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Flex Levers" title="Demand Response" description="L1: behavioural DR acceptance, learned per sub-division." />
        <PanelSkeleton />
      </div>
    );
  }

  const densityByX = Array.from({ length: 41 }, (_, i) => {
    const row: Record<string, number> = { x: i / 40 };
    for (const b of beliefs) row[b.subdivisionId] = densityCurve(b)[i].density;
    return row;
  });

  const acceptanceRows = beliefs.map((b) => ({
    label: isSubdivisionId(b.subdivisionId) ? SUBDIVISION_LABEL[b.subdivisionId] : b.subdivisionId,
    solution: Number((b.acceptanceRateEstimate * 100).toFixed(1)),
    baseline: 50,
  }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Flex Levers" title="Demand Response" description="L1 lever: WhatsApp/IVR behavioural ask, rebate Rs 2/kWh. Acceptance is learned per sub-division with a Beta-Bernoulli model." />
      </div>

      <Card title="Rebates paid" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{formatRupees(totalRebate(ledger))}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(totalRebate(ledger))}</p>
      </Card>

      <Card title="kWh shifted" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{totalShifted(ledger).toFixed(0)}</p>
      </Card>

      <Card title="Consumers opted in" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{ledger.reduce((s, r) => s + r.consumerCount, 0).toLocaleString("en-IN")}</p>
      </Card>

      <Card title="Fleet-avg acceptance" eyebrow="Model" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {beliefs.length ? formatPercent(beliefs.reduce((s, b) => s + b.acceptanceRateEstimate, 0) / beliefs.length) : "—"}
        </p>
      </Card>

      <Card title="Samples observed" eyebrow="Model" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{beliefs.reduce((s, b) => s + b.sampleCount, 0)}</p>
      </Card>

      <Card title={beliefTitle(beliefs.length)} eyebrow="Beta-Bernoulli" className="col-span-12 lg:col-span-7">
        <ChartFrame label="Per sub-division acceptance belief density">
          <ChartLegend
            items={beliefs.map((b, i) => ({
              label: isSubdivisionId(b.subdivisionId) ? SUBDIVISION_LABEL[b.subdivisionId] : b.subdivisionId,
              color: seriesColor(i),
            }))}
          />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 240 }}>
              <LineChart data={densityByX} margin={CHART_MARGIN}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="x" type="number" domain={[0, 1]} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<ChartTooltip />} />
                {beliefs.map((b, i) => (
                  <Line
                    key={b.subdivisionId}
                    type="monotone"
                    dataKey={b.subdivisionId}
                    name={isSubdivisionId(b.subdivisionId) ? SUBDIVISION_LABEL[b.subdivisionId] : b.subdivisionId}
                    stroke={seriesColor(i)}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
        <p className="mt-2 text-[11px] text-faint">
          x-axis = acceptance probability, y-axis = belief density. Narrower, taller curves mean the model is more confident, from more observed DR asks.
        </p>
      </Card>

      <Card title="Acceptance rate by sub-division" eyebrow="vs 50% prior" className="col-span-12 lg:col-span-5">
        <CompareBars rows={acceptanceRows} unit="%" />
      </Card>

      <Card title="Rebate ledger" eyebrow="Settlement" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Sub-division</th>
              <th className="px-2 py-1 text-right">Consumers</th>
              <th className="px-2 py-1 text-right">kWh shifted</th>
              <th className="px-2 py-1 text-right">Rebate</th>
              <th className="px-2 py-1 text-right">α / β</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => {
              const belief = beliefs.find((b) => b.subdivisionId === r.subdivisionId);
              return (
                <tr key={r.subdivisionId}>
                  <td className="px-2 py-1.5 text-text">{isSubdivisionId(r.subdivisionId) ? SUBDIVISION_LABEL[r.subdivisionId] : r.subdivisionId}</td>
                  <td className="num px-2 py-1.5 text-right">{r.consumerCount.toLocaleString("en-IN")}</td>
                  <td className="num px-2 py-1.5 text-right">{r.kwhShifted.toFixed(1)}</td>
                  <td className="num px-2 py-1.5 text-right">{formatRupees(r.totalRebateRs)}</td>
                  <td className="num px-2 py-1.5 text-right">{belief ? `${belief.alpha} / ${belief.beta}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

"use client";

import { useSubdivisions, useFeeders, useTransformers, usePlans, useReliability, useFairness } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { CompareStat } from "@/components/ds/CompareStat";
import { PlanCard } from "@/components/grid/PlanCard";
import { LorenzCurve } from "@/components/charts/LorenzCurve";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import { formatIstDateTime, formatPercent } from "@/lib/format";
import { feederBreakdownTitle, headlineFor, printFooterNote, scorecardTitle } from "./titles";

export function SubdivisionDetailView({ id }: { id: string }) {
  const { data: subsData, isLoading } = useSubdivisions();
  const { data: feedersData } = useFeeders(id);
  const { data: transformersData } = useTransformers(id);
  const { data: plansData } = usePlans(id);
  const { data: reliability, offline } = useReliability(id);
  const { data: fairness } = useFairness(id);

  const subdivision = subsData?.subdivisions.find((s) => s.id === id);
  const feeders = feedersData?.feeders ?? [];
  const transformers = transformersData?.transformers ?? [];
  const plans = plansData?.plans ?? [];
  const generatedIso = new Date().toISOString();

  if (isLoading && !subdivision) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Sub-division detail" />
        <PanelSkeleton />
      </div>
    );
  }

  const avgLoading = transformers.length ? transformers.reduce((s, t) => s + t.loadingPu, 0) / transformers.length : 0;
  const worstLoading = transformers.length ? Math.max(...transformers.map((t) => t.loadingPu)) : 0;

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12 no-print">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12 no-print">
        <PageHeader
          eyebrow="Flex Plans"
          title={subdivision?.name ?? id}
          description={headlineFor(subdivision)}
          breadcrumbs={[
            { label: "Flex Plans" },
            { label: "Sub-division Lab", href: "/subdivisions" },
            { label: subdivision?.name ?? id },
          ]}
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-text hover:border-border-strong"
            >
              Print A4 scorecard
            </button>
          }
        />
      </div>

      <div className="print-scorecard col-span-12 grid grid-cols-12 gap-3">
        <div className="col-span-12">
          <h1 className="text-[20px] font-semibold">{scorecardTitle(subdivision)}</h1>
          <p className="text-[12px]">{headlineFor(subdivision)}</p>
        </div>

        <Card title="Served fraction" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
          <CompareStat
            label="Served vs modelled baseline"
            solutionValue={(subdivision?.servedFraction ?? 0) * 100}
            baselineValue={Math.max(0, ((subdivision?.servedFraction ?? 0) - (subdivision?.riskIndex ?? 0) * 0.18) * 100)}
            unit="%"
          />
        </Card>

        <Card title="Risk index" eyebrow="Moneyshot" className="col-span-6 lg:col-span-2">
          <GaugeArc
            value={subdivision?.riskIndex ?? 0}
            color={cssVar(RISK_LEVEL_COLOR_VAR[subdivision?.riskLevel ?? "low"])}
            valueLabel={(subdivision?.riskIndex ?? 0).toFixed(2)}
            label="Risk index gauge"
          />
        </Card>

        <Card title="Consumers" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
          <p className="num text-[22px] font-semibold text-text">{subdivision?.consumerCount.toLocaleString("en-IN") ?? "—"}</p>
        </Card>

        <Card title="SAIDI" eyebrow="Reliability" className="col-span-6 lg:col-span-2">
          <p className="num text-[22px] font-semibold text-text">{reliability?.saidiMinutes.toFixed(1) ?? "—"} min</p>
        </Card>

        <Card title="Lifeline availability" eyebrow="Reliability" className="col-span-6 lg:col-span-2">
          <p className="num text-[22px] font-semibold text-text">{reliability?.lifelineAvailabilityPct.toFixed(1) ?? "—"}%</p>
        </Card>

        <Card title={feederBreakdownTitle(feeders.length)} eyebrow="Network" className="col-span-12 lg:col-span-6">
          <table className="w-full border-separate border-spacing-y-1 text-[12px]">
            <thead>
              <tr className="text-left text-faint">
                <th className="px-2 py-1">Feeder</th>
                <th className="px-2 py-1 text-right">Loading</th>
                <th className="px-2 py-1 text-right">DTs</th>
              </tr>
            </thead>
            <tbody>
              {feeders.map((f) => (
                <tr key={f.id}>
                  <td className="px-2 py-1.5 text-text">{f.name}</td>
                  <td className="num px-2 py-1.5 text-right">{f.loadingPu.toFixed(2)} pu</td>
                  <td className="num px-2 py-1.5 text-right">{f.dtIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Transformer loading" eyebrow="Network" className="col-span-12 lg:col-span-6">
          <p className="num text-[18px] text-text">Avg {avgLoading.toFixed(2)} pu · Worst {worstLoading.toFixed(2)} pu</p>
          <ul className="mt-2 space-y-1">
            {transformers.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-[12px]">
                <span className="text-muted">{t.name}</span>
                <span className="num text-text">{t.loadingPu.toFixed(2)} pu</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Fairness (Lorenz curve)" eyebrow="Reliability" className="col-span-12 lg:col-span-6">
          <LorenzCurve points={fairness?.lorenzPoints ?? []} />
          <p className="mt-1 text-[11px] text-faint">Jain index {fairness?.jainIndex.toFixed(2) ?? "—"} · Gini {fairness?.giniCoefficient.toFixed(2) ?? "—"}</p>
        </Card>

        <Card title="Active Flex Plans" eyebrow="Flex Plans" className="col-span-12 lg:col-span-6 no-print">
          {plans.length === 0 ? (
            <p className="text-[12px] text-faint">No plans for this sub-division.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </Card>

        <div className="col-span-12 text-[10px]" style={{ color: "#555" }}>
          {printFooterNote(subdivision, formatIstDateTime(generatedIso))}
        </div>
      </div>
      <p className="col-span-12 text-right text-[11px] text-faint">
        Served fraction {formatPercent(subdivision?.servedFraction ?? 0)}
      </p>
    </div>
  );
}

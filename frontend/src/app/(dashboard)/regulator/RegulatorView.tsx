"use client";

import { useFederation, useReliability, useFairness } from "@/lib/api/hooks";
import { useRole } from "@/lib/roleContext";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { LorenzCurve } from "@/components/charts/LorenzCurve";
import { CompareBars } from "@/components/charts/CompareBars";
import { ShieldCheck } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { canDrillDown, moneyshotTitle, totalConsumers } from "./titles";

export function RegulatorView() {
  const { role } = useRole();
  const { data, isLoading, offline } = useFederation();
  const { data: reliability } = useReliability("all");
  const { data: fairness } = useFairness("all");
  const nodes = data?.nodes ?? [];
  const drillDownAllowed = canDrillDown(role);

  if (isLoading && nodes.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Regulator View" description="DISCOM-level aggregates only — no consumer or sub-division drill-down." />
        <PanelSkeleton />
      </div>
    );
  }

  const barRows = nodes.map((n) => ({ label: n.discom, solution: Number((n.reliabilityIndex * 100).toFixed(1)), baseline: Number((n.flexibilityIndex * 100).toFixed(1)) }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Insights" title="Regulator View" description="Federation-level flexibility, fairness, and reliability — aggregated per DISCOM node." />
      </div>

      <div className="col-span-12 flex items-center gap-3 rounded-md border border-brand p-3" style={{ background: "var(--brand-soft)" }}>
        <ShieldCheck size={20} className="shrink-0 text-brand" aria-hidden />
        <p className="text-[12px] font-medium text-text">
          Aggregates only: consumer-level data never leaves the DISCOM node. {!drillDownAllowed && "No sub-division or consumer drill-down is available to the regulator role."}
        </p>
      </div>

      <Card title="Fleet reliability" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[22px] font-semibold text-text">{nodes.length ? formatPercent(nodes.reduce((s, n) => s + n.reliabilityIndex, 0) / nodes.length) : "—"}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(nodes)}</p>
      </Card>

      <Card title="Consumers served" eyebrow="Federation" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{totalConsumers(nodes).toLocaleString("en-IN")}</p>
      </Card>

      <Card title="SAIDI" eyebrow="Reliability" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{reliability?.saidiMinutes.toFixed(1) ?? "—"} min</p>
      </Card>

      <Card title="Jain fairness index" eyebrow="Fairness" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{fairness?.jainIndex.toFixed(2) ?? "—"}</p>
      </Card>

      <Card title="Lifeline availability" eyebrow="Reliability" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{reliability?.lifelineAvailabilityPct.toFixed(1) ?? "—"}%</p>
      </Card>

      {nodes.map((n) => (
        <Card key={n.discom} title={`${n.discom} — ${n.town}`} eyebrow="DISCOM node" className="col-span-12 lg:col-span-6">
          <div className="grid grid-cols-3 gap-3">
            <GaugeArc value={n.reliabilityIndex} valueLabel={formatPercent(n.reliabilityIndex)} label={`${n.discom} reliability`} size={110} />
            <GaugeArc value={n.flexibilityIndex} valueLabel={formatPercent(n.flexibilityIndex)} label={`${n.discom} flexibility`} size={110} color="var(--cyan)" />
            <GaugeArc value={n.fairnessIndex} valueLabel={formatPercent(n.fairnessIndex)} label={`${n.discom} fairness`} size={110} color="var(--violet)" />
          </div>
          <p className="mt-2 text-[11px] text-faint">
            {n.subdivisionCount} sub-divisions · {n.consumerCount.toLocaleString("en-IN")} consumers (aggregate only)
          </p>
        </Card>
      ))}

      <Card title="Reliability vs flexibility by DISCOM" eyebrow="Chart" className="col-span-12 lg:col-span-6">
        <CompareBars rows={barRows} unit="%" />
      </Card>

      <Card title="Fairness (Lorenz curve)" eyebrow="Federation-wide" className="col-span-12 lg:col-span-6">
        <LorenzCurve points={fairness?.lorenzPoints ?? []} />
      </Card>

      <Card title="Federation diagram" eyebrow="WIRED" className="col-span-12">
        <svg width="100%" height={160} viewBox="0 0 560 160" role="img" aria-label="Federation diagram">
          <circle cx={280} cy={30} r={22} fill="var(--brand)" />
          <text x={280} y={34} textAnchor="middle" fontSize={10} fill="#000">UrjaGrid</text>
          {nodes.map((n, i) => {
            const x = 140 + i * 280;
            return (
              <g key={n.discom}>
                <line x1={280} y1={52} x2={x} y2={110} stroke="var(--border-strong)" strokeWidth={1.5} />
                <rect x={x - 60} y={110} width={120} height={36} rx={6} fill="var(--surface-2)" stroke="var(--border)" />
                <text x={x} y={128} textAnchor="middle" fontSize={11} fill="var(--text)">{n.discom}</text>
                <text x={x} y={140} textAnchor="middle" fontSize={9} fill="var(--text-faint)">{n.town}</text>
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-[11px] text-faint">
          A single-process prototype has one logical DISCOM node; this diagram shows the multi-DISCOM federation topology the real deployment would have.
        </p>
      </Card>
    </div>
  );
}

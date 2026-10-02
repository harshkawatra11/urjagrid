"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { PlanCard } from "@/components/grid/PlanCard";
import { WhatIfPanel } from "@/components/grid/WhatIfPanel";
import { EventTimeline } from "@/components/grid/EventTimeline";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { usePlans, useEvents } from "@/lib/api/hooks";
import { simulatePlan } from "@/lib/api/mutations";
import { useScope } from "@/lib/scope";
import { SUBDIVISION_LABEL, isSubdivisionId } from "@/lib/scope";
import type { FlexPlan, PlanOverrides } from "@/lib/api/types";
import { formatKw } from "@/lib/format";
import {
  approvalRateTitle,
  decisionLogTitle,
  deficitGanttTitle,
  funnelTitle,
  kanbanColumnTitle,
  kpiCoverageLabel,
  whatIfTitle,
} from "./titles";

type Column = { label: string; statuses: FlexPlan["status"][] };

const COLUMNS: Column[] = [
  { label: "Awaiting", statuses: ["draft", "proposed"] },
  { label: "Scheduled", statuses: ["approved"] },
  { label: "Active", statuses: ["dispatched", "active"] },
  { label: "Verified", statuses: ["verified"] },
  { label: "Rejected", statuses: ["rejected", "cancelled", "expired"] },
];

const FUNNEL_STAGES: FlexPlan["status"][] = ["draft", "proposed", "approved", "dispatched", "active", "verified"];

function windowHours(startIso: string, endIso: string): number[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const hours: number[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 24) {
    hours.push(cursor.getUTCHours());
    cursor.setUTCHours(cursor.getUTCHours() + 1);
    guard += 1;
  }
  return hours;
}

export function PlansView() {
  const { scope } = useScope();
  const plans = usePlans(scope);
  const events = useEvents(scope);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<FlexPlan | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simPending, setSimPending] = useState(false);

  const allPlans = useMemo(() => plans.data?.plans ?? [], [plans.data]);
  const eventRows = events.data?.events ?? [];

  const columns = useMemo(
    () => COLUMNS.map((c) => ({ ...c, plans: allPlans.filter((p) => c.statuses.includes(p.status)) })),
    [allPlans],
  );

  const totalGapKw = allPlans.reduce((s, p) => s + p.gapKw, 0);
  const totalCoveredKw = allPlans.reduce((s, p) => s + p.coveredKw, 0);
  const proposedOrDraft = allPlans.filter((p) => p.status === "draft" || p.status === "proposed").length;
  const approvedOnward = allPlans.filter((p) => p.status !== "draft" && p.status !== "proposed" && p.status !== "rejected" && p.status !== "cancelled" && p.status !== "expired").length;
  const rejectedCount = allPlans.filter((p) => p.status === "rejected" || p.status === "cancelled").length;
  const approvalRate = proposedOrDraft + approvedOnward + rejectedCount > 0 ? approvedOnward / (approvedOnward + rejectedCount || 1) : 0;

  const funnelCounts = FUNNEL_STAGES.map((status) => ({
    status,
    count: allPlans.filter((p) => p.status === status).length,
  }));
  const maxFunnel = Math.max(1, ...funnelCounts.map((f) => f.count));

  const ganttCells: HourHeatmapCell[] = useMemo(() => {
    const cells: HourHeatmapCell[] = [];
    for (const p of allPlans) {
      const label = isSubdivisionId(p.subdivisionId) ? SUBDIVISION_LABEL[p.subdivisionId] : p.subdivisionId;
      for (const hour of windowHours(p.windowStartIso, p.windowEndIso)) {
        cells.push({ row: label, hour, value: Math.min(1, p.gapKw / 100) });
      }
    }
    return cells;
  }, [allPlans]);
  const ganttRows = Array.from(new Set(ganttCells.map((c) => c.row)));

  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId) ?? allPlans.find((p) => p.status === "draft" || p.status === "proposed") ?? null;

  async function handleSimulate(overrides: PlanOverrides) {
    if (!selectedPlan) return;
    setSimPending(true);
    setSimError(null);
    const result = await simulatePlan(selectedPlan.id, overrides);
    setSimPending(false);
    if (result.ok) setSimResult(result.data);
    else setSimError("Simulation needs a live backend connection -- showing the plan's last known numbers.");
  }

  if (plans.data === undefined) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Flex Plans Decision Desk" />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Flex Plans"
        title="Flex Plans Decision Desk"
        description={kpiCoverageLabel(totalCoveredKw, totalGapKw)}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CompareStat label="Total gap" solutionValue={totalGapKw} baselineValue={0} unit=" kW" direction="up-bad" />
        <CompareStat label="Covered" solutionValue={totalCoveredKw} baselineValue={0} unit=" kW" />
        <CompareStat label="Awaiting approval" solutionValue={proposedOrDraft} baselineValue={0} unit="" fractionDigits={0} direction="up-bad" />
        <CompareStat label="Approved onward" solutionValue={approvedOnward} baselineValue={0} unit="" fractionDigits={0} />
        <CompareStat label="Rejected / cancelled" solutionValue={rejectedCount} baselineValue={0} unit="" fractionDigits={0} direction="up-bad" />
        <CompareStat label="Plans total" solutionValue={allPlans.length} baselineValue={0} unit="" fractionDigits={0} />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
        {columns.map((col) => (
          <Card key={col.label} title={kanbanColumnTitle(col.label, col.plans.length)}>
            <div className="flex flex-col gap-2">
              {col.plans.length === 0 ? (
                <p className="text-[11px] text-faint">Empty</p>
              ) : (
                col.plans.map((p) => (
                  <div key={p.id} onClick={() => setSelectedPlanId(p.id)} className="cursor-pointer">
                    <PlanCard plan={p} />
                  </div>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-5" title={whatIfTitle(selectedPlan?.id ?? null)}>
          {selectedPlan ? (
            <>
              <WhatIfPanel onSimulate={handleSimulate} pending={simPending} />
              {simError && <p className="mt-2 text-[11px] text-amber">{simError}</p>}
              {simResult && (
                <p className="mt-2 text-[11px] text-muted">
                  Simulated coverage: {formatKw(simResult.coveredKw)} / {formatKw(simResult.gapKw)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-faint">No plan awaiting approval to simulate.</p>
          )}
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={funnelTitle(allPlans.length)}>
          <div className="flex flex-col gap-1.5">
            {funnelCounts.map((f) => (
              <div key={f.status} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 capitalize text-muted">{f.status}</span>
                <div className="h-4 flex-1 rounded-sm bg-surface-3">
                  <div
                    className="h-4 rounded-sm bg-brand"
                    style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                  />
                </div>
                <span className="num w-6 text-right text-text">{f.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="col-span-12 lg:col-span-3" title={approvalRateTitle(approvalRate)}>
          <div className="flex justify-center">
            <GaugeArc value={approvalRate} max={1} valueLabel={`${(approvalRate * 100).toFixed(0)}%`} label="Approval rate" />
          </div>
        </Card>
      </div>

      <Card className="mb-3" title={deficitGanttTitle(allPlans.length)}>
        {ganttRows.length > 0 ? (
          <HourHeatmap rows={ganttRows} cells={ganttCells} label="Deficit windows by hour" />
        ) : (
          <p className="text-[12px] text-faint">No active deficit windows.</p>
        )}
      </Card>

      <Card title={decisionLogTitle(eventRows.length)}>
        <EventTimeline events={eventRows} />
      </Card>
    </div>
  );
}

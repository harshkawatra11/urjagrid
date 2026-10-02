"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { PlanStatusChip } from "@/components/ds/chips";
import { LeverWaterfall } from "@/components/charts/LeverWaterfall";
import { OptionsTable } from "@/components/grid/OptionsTable";
import { SensitivityMatrix } from "@/components/grid/SensitivityMatrix";
import { DispatchStepper } from "@/components/grid/DispatchStepper";
import { DecisionBar } from "@/components/grid/DecisionBar";
import { ProtocolMessage } from "@/components/grid/ProtocolMessage";
import { usePlan } from "@/lib/api/hooks";
import { approvePlan, rejectPlan } from "@/lib/api/mutations";
import { useRole } from "@/lib/roleContext";
import { SUBDIVISION_LABEL, isSubdivisionId } from "@/lib/scope";
import { LEVER_LABEL, type LeverKey } from "@/lib/domain";
import { formatKw, formatIstDateTime } from "@/lib/format";
import type { DispatchStep, PlanOption, ProtocolMessageRecord, SensitivityCell } from "@/lib/api/types";
import {
  caseFileHeadline,
  dispatchTitle,
  noticesTitle,
  optionsTitle,
  protocolLogTitle,
  sensitivityTitle,
  transformerActionsTitle,
  verificationTitle,
  waterfallTitle,
} from "./titles";

const LEVER_PROTOCOL: Partial<Record<LeverKey, ProtocolMessageRecord["protocol"]>> = {
  behavioral_dr: "whatsapp",
  managed_charging: "ocpp",
  shiftable_loads: "openadr",
  lifeline_cap: "hes",
};

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

const DONE_FROM_STATUS: Record<string, number> = {
  draft: -1,
  proposed: -1,
  approved: 0,
  dispatched: 2,
  active: 4,
  verified: 5,
  rejected: -1,
  cancelled: -1,
  expired: -1,
};

export function PlanDetailView() {
  const params = useParams<{ planId: string }>();
  const planId = typeof params.planId === "string" ? params.planId : Array.isArray(params.planId) ? params.planId[0] : "";
  const plan = usePlan(planId);
  const { role } = useRole();
  const [pending, setPending] = useState(false);

  const data = plan.data;

  const dispatchSteps: DispatchStep[] = useMemo(() => {
    if (!data) return [];
    const doneIdx = DONE_FROM_STATUS[data.status] ?? -1;
    const skip = data.status === "rejected" || data.status === "cancelled" || data.status === "expired";
    const schedule: Array<{ key: DispatchStep["key"]; label: string; minutesFromWindowStart: number }> = [
      { key: "notify", label: "Notify", minutesFromWindowStart: -120 },
      { key: "signal", label: "Signal", minutesFromWindowStart: -30 },
      { key: "hes", label: "HES", minutesFromWindowStart: -15 },
      { key: "start", label: "Start", minutesFromWindowStart: 0 },
      { key: "end", label: "End", minutesFromWindowStart: Math.round((new Date(data.windowEndIso).getTime() - new Date(data.windowStartIso).getTime()) / 60_000) },
      { key: "verify", label: "Verify", minutesFromWindowStart: Math.round((new Date(data.windowEndIso).getTime() - new Date(data.windowStartIso).getTime()) / 60_000) + 15 },
    ];
    return schedule.map((s, idx) => {
      const scheduledIso = addMinutes(data.windowStartIso, s.minutesFromWindowStart);
      const status: DispatchStep["status"] = skip ? "skipped" : idx <= doneIdx ? "done" : idx === doneIdx + 1 ? "in_progress" : "pending";
      return { key: s.key, label: s.label, scheduledIso, completedIso: status === "done" ? scheduledIso : null, status };
    });
  }, [data]);

  const options: PlanOption[] = useMemo(() => {
    if (!data) return [];
    const recommended: PlanOption = {
      id: "opt_optimiser",
      label: "Optimiser (this plan)",
      levers: data.levers,
      totalReliefKw: data.coveredKw,
      totalCostRs: data.levers.reduce((s, l) => s + l.costRs, 0),
      unservedKw: Math.max(0, data.gapKw - data.coveredKw),
      recommended: true,
    };
    const drOnly: PlanOption = {
      id: "opt_dr_only",
      label: "Behavioural DR only",
      levers: data.levers.filter((l) => l.lever === "behavioral_dr"),
      totalReliefKw: data.levers.find((l) => l.lever === "behavioral_dr")?.reliefKw ?? 0,
      totalCostRs: data.levers.find((l) => l.lever === "behavioral_dr")?.costRs ?? 0,
      unservedKw: data.gapKw - (data.levers.find((l) => l.lever === "behavioral_dr")?.reliefKw ?? 0),
      recommended: false,
    };
    const maxLevers: PlanOption = {
      id: "opt_max_levers",
      label: "All levers at 120%",
      levers: data.levers.map((l) => ({ ...l, reliefKw: l.reliefKw * 1.2, costRs: l.costRs * 1.2 })),
      totalReliefKw: data.coveredKw * 1.2,
      totalCostRs: data.levers.reduce((s, l) => s + l.costRs, 0) * 1.2,
      unservedKw: Math.max(0, data.gapKw - data.coveredKw * 1.2),
      recommended: false,
    };
    return [recommended, drOnly, maxLevers];
  }, [data]);

  const topLever = useMemo(() => {
    if (!data || data.levers.length === 0) return null;
    return [...data.levers].sort((a, b) => b.reliefKw - a.reliefKw)[0];
  }, [data]);

  const sensitivityCells: SensitivityCell[] = useMemo(() => {
    if (!data || !topLever) return [];
    const leverDeltas = [-20, 0, 20];
    const gapDeltas = [-20, 0, 20];
    const cells: SensitivityCell[] = [];
    for (const gapDeltaPct of gapDeltas) {
      for (const leverDeltaPct of leverDeltas) {
        const gap = data.gapKw * (1 + gapDeltaPct / 100);
        const covered = data.coveredKw * (1 + leverDeltaPct / 100);
        cells.push({ leverDeltaPct, gapDeltaPct, unservedKw: Math.max(0, gap - covered) });
      }
    }
    return cells;
  }, [data, topLever]);

  const protocolMessages: ProtocolMessageRecord[] = useMemo(() => {
    if (!data) return [];
    return data.levers
      .map((l, i) => {
        const protocol = LEVER_PROTOCOL[l.lever];
        if (!protocol) return null;
        const msg: ProtocolMessageRecord = {
          id: `${data.id}_msg_${i}`,
          protocol,
          direction: "outbound",
          summary: `${LEVER_LABEL[l.lever]}: ${formatKw(l.reliefKw)} relief across ${l.consumerCount} consumers`,
          payload: { planId: data.id, leverKw: l.reliefKw, consumerCount: l.consumerCount },
          timestampIso: data.createdIso,
          status: data.status === "draft" || data.status === "proposed" ? "sent" : "acked",
        };
        return msg;
      })
      .filter((m): m is ProtocolMessageRecord => m !== null);
  }, [data]);

  const noticeHouseholds = data?.levers.find((l) => l.lever === "behavioral_dr")?.consumerCount ?? 0;
  const coveragePct = data && data.gapKw > 0 ? (data.coveredKw / data.gapKw) * 100 : 100;

  async function handleApprove(approverName: string, notes?: string) {
    if (!data) return;
    setPending(true);
    const result = await approvePlan(data.id, approverName, data, notes);
    setPending(false);
    if (result.plan) plan.mutate({ data: result.plan, offline: result.offline }, { revalidate: false });
  }

  async function handleReject(approverName: string, notes?: string) {
    if (!data) return;
    setPending(true);
    const result = await rejectPlan(data.id, approverName, data, notes);
    setPending(false);
    if (result.plan) plan.mutate({ data: result.plan, offline: result.offline }, { revalidate: false });
  }

  if (plan.data === undefined) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Flex Plan Case File" breadcrumbs={[{ label: "Flex Plans", href: "/plans" }, { label: planId }]} />
        <PanelSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader eyebrow="Flex Plans" title="Flex Plan Case File" breadcrumbs={[{ label: "Flex Plans", href: "/plans" }, { label: planId }]} />
        <p className="text-[13px] text-muted">No plan found for id &quot;{planId}&quot;.</p>
      </div>
    );
  }

  const subdivisionLabel = isSubdivisionId(data.subdivisionId) ? SUBDIVISION_LABEL[data.subdivisionId] : data.subdivisionId;

  return (
    <div>
      <PageHeader
        eyebrow={subdivisionLabel}
        title={caseFileHeadline(data.id, data.status)}
        description={`Window ${formatIstDateTime(data.windowStartIso)} - ${formatIstDateTime(data.windowEndIso)}`}
        breadcrumbs={[{ label: "Flex Plans", href: "/plans" }, { label: data.id }]}
        actions={<PlanStatusChip status={data.status} />}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CompareStat label="Gap" solutionValue={data.gapKw} baselineValue={0} unit=" kW" direction="up-bad" />
        <CompareStat label="Covered" solutionValue={data.coveredKw} baselineValue={0} unit=" kW" />
        <CompareStat label="Unserved" solutionValue={Math.max(0, data.gapKw - data.coveredKw)} baselineValue={data.gapKw} unit=" kW" direction="up-bad" />
        <CompareStat label="Levers engaged" solutionValue={data.levers.length} baselineValue={0} unit="" fractionDigits={0} />
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-7" title={waterfallTitle(data.gapKw)}>
          <LeverWaterfall bars={data.levers.map((l) => ({ lever: l.lever, reliefKw: l.reliefKw }))} />
          <p className="mt-2 text-[12px] text-muted">
            {topLever
              ? `${LEVER_LABEL[topLever.lever]} contributes the most relief (${formatKw(topLever.reliefKw)}), consistent with the canonical L1-L6 lever order tried before falling back to rotational shedding.`
              : "No levers engaged yet for this plan."}
          </p>
          {data.notes && <p className="mt-1 text-[11px] text-faint">Note: {data.notes}</p>}
        </Card>
        <Card className="col-span-12 lg:col-span-5" title={transformerActionsTitle(data.dtIds.length)}>
          <ul className="space-y-1.5 text-[12px]">
            {data.dtIds.map((dtId) => (
              <li key={dtId} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <span className="num text-text">{dtId}</span>
                <span className="text-muted">Cap + DR actions queued</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-7" title={optionsTitle(options.length)}>
          <OptionsTable options={options} selectedId="opt_optimiser" />
        </Card>
        <Card className="col-span-12 lg:col-span-5" title={topLever ? sensitivityTitle(LEVER_LABEL[topLever.lever]) : "Sensitivity"}>
          {sensitivityCells.length > 0 ? (
            <SensitivityMatrix cells={sensitivityCells} leverDeltas={[-20, 0, 20]} gapDeltas={[-20, 0, 20]} />
          ) : (
            <p className="text-[12px] text-faint">No lever data to run sensitivity against.</p>
          )}
        </Card>
      </div>

      <Card className="mb-3" title={dispatchTitle(data.status)}>
        <DispatchStepper steps={dispatchSteps} />
      </Card>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title={verificationTitle(coveragePct)}>
          <p className="text-[12px] text-muted">
            {data.status === "verified"
              ? `Metering confirmed ${coveragePct.toFixed(0)}% of the targeted relief was realised.`
              : "Verification runs 15 minutes after the window ends (M&V step of the closed loop)."}
          </p>
          <p className="mt-1 text-[11px] text-faint">Approver: {data.approverName ?? "not yet approved"}</p>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={noticesTitle(noticeHouseholds)}>
          <p className="text-[12px] text-muted">
            {noticeHouseholds > 0
              ? `Bilingual (Hindi/English) WhatsApp/IVR notices queued 2 hours ahead of the window for ${noticeHouseholds} households.`
              : "This plan has no behavioural-DR lever, so no consumer notices are sent."}
          </p>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title="Approve / reject">
          <DecisionBar status={data.status} role={role} pending={pending} onApprove={handleApprove} onReject={handleReject} />
        </Card>
      </div>

      <Card title={protocolLogTitle(protocolMessages.length)}>
        {protocolMessages.length === 0 ? (
          <p className="text-[12px] text-faint">No protocol-ledger activity yet for this plan.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {protocolMessages.map((m) => (
              <ProtocolMessage key={m.id} message={m} />
            ))}
          </div>
        )}
      </Card>

      {plan.offline && <p className="mt-3 text-[11px] text-faint">Showing committed fixture data -- backend unreachable.</p>}
    </div>
  );
}

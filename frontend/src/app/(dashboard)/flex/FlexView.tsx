"use client";

import { useMemo } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { LiveDot } from "@/components/ds/LiveDot";
import { LeverStack } from "@/components/grid/LeverStack";
import { PlanCard } from "@/components/grid/PlanCard";
import { EventTimeline } from "@/components/grid/EventTimeline";
import { BaseMapClient, ServiceAreaLayerClient, DtLayerClient, AssetLayerClient } from "@/components/map/client";
import { MapLegend } from "@/components/map/MapLegend";
import { useCriticalFacilities, useEvents, usePlans, useSubdivisions, useTransformers } from "@/lib/api/hooks";
import { useLiveEvents, useLiveState } from "@/lib/live/LiveProvider";
import { useScope } from "@/lib/scope";
import { LEVER_ORDER, type LeverKey, type MeterState, RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import type { LeverAllocation } from "@/lib/api/types";
import { formatIstTime, formatNumber, formatPercent } from "@/lib/format";
import { activePlansTitle, historyTitle, leverStackTitle, liveFeedTitle, mapTitle, meterCounterTitle, subdivisionStripTitle } from "./titles";

const ACTIVE_STATUSES = new Set(["approved", "dispatched", "active"]);

export function FlexView() {
  const { scope } = useScope();
  const subdivisions = useSubdivisions();
  const transformers = useTransformers(scope);
  const plans = usePlans(scope);
  const critical = useCriticalFacilities(scope);
  const events = useEvents(scope);
  const liveEvents = useLiveEvents();
  const liveState = useLiveState();

  const subs = useMemo(() => subdivisions.data?.subdivisions ?? [], [subdivisions.data]);
  const dts = useMemo(() => transformers.data?.transformers ?? [], [transformers.data]);
  const allPlans = useMemo(() => plans.data?.plans ?? [], [plans.data]);
  const facilities = useMemo(() => critical.data?.facilities ?? [], [critical.data]);
  const eventRows = events.data?.events ?? [];

  const activePlans = useMemo(() => allPlans.filter((p) => ACTIVE_STATUSES.has(p.status)), [allPlans]);

  const dtById = useMemo(() => new Map(dts.map((d) => [d.id, d])), [dts]);
  const facilityLocations = useMemo(
    () =>
      facilities
        .map((f) => {
          const dt = dtById.get(f.dtId);
          return dt ? { id: f.id, name: f.name, location: dt.location, kind: f.kind } : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null),
    [facilities, dtById],
  );

  const leverTotals: LeverAllocation[] = useMemo(() => {
    const byLever = new Map<LeverKey, LeverAllocation>();
    for (const plan of activePlans) {
      for (const l of plan.levers) {
        const existing = byLever.get(l.lever);
        if (existing) {
          existing.reliefKw += l.reliefKw;
          existing.costRs += l.costRs;
          existing.consumerCount += l.consumerCount;
        } else {
          byLever.set(l.lever, { ...l });
        }
      }
    }
    return LEVER_ORDER.filter((l) => byLever.has(l)).map((l) => byLever.get(l) as LeverAllocation);
  }, [activePlans]);
  const activeGapKw = activePlans.reduce((s, p) => s + p.gapKw, 0);

  const meterCounts: Record<MeterState, number> = useMemo(() => {
    const counts: Record<MeterState, number> = { normal: 0, dr: 0, capped: 0, shed: 0, offline: 0 };
    const byLever = new Map<LeverKey, number>();
    for (const plan of activePlans) for (const l of plan.levers) byLever.set(l.lever, (byLever.get(l.lever) ?? 0) + l.consumerCount);
    counts.dr = byLever.get("behavioral_dr") ?? 0;
    counts.capped = byLever.get("lifeline_cap") ?? 0;
    counts.shed = byLever.get("rotational_shedding") ?? 0;
    const totalConsumers = subs.reduce((s, sd) => s + sd.consumerCount, 0);
    counts.normal = Math.max(0, totalConsumers - counts.dr - counts.capped - counts.shed);
    return counts;
  }, [activePlans, subs]);
  const totalConsumers = subs.reduce((s, sd) => s + sd.consumerCount, 0);

  const loading = subdivisions.data === undefined || transformers.data === undefined || plans.data === undefined;

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Flex Levers" title="Live Grid Ops" />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Flex Levers" title="Live Grid Ops" description="Every lever firing right now, across the fleet." />

      <Card className="mb-3" title={subdivisionStripTitle(subs.length)}>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {subs.map((s) => (
            <div key={s.id} className="flex min-w-[160px] shrink-0 flex-col gap-1 rounded-md border border-border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-text">{s.name}</span>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: cssVar(RISK_LEVEL_COLOR_VAR[s.riskLevel]) }} />
              </div>
              <span className="num text-[11px] text-muted">{formatPercent(s.servedFraction)} served</span>
              <span className="num text-[11px] text-faint">{s.activePlanCount} active plan{s.activePlanCount === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-7" title={mapTitle(activePlans.length)} live footer={<MapLegend />}>
          <BaseMapClient height={340} fitPoints={dts.map((d) => [d.location.lat, d.location.lng] as [number, number])}>
            <ServiceAreaLayerClient features={dts.map((d) => ({ dtId: d.id, name: d.name, polygon: d.serviceAreaPolygon, riskLevel: d.riskLevel }))} />
            <DtLayerClient dts={dts.map((d) => ({ id: d.id, name: d.name, location: d.location, riskLevel: d.riskLevel, loadingPu: d.loadingPu }))} />
            <AssetLayerClient assets={facilityLocations} />
          </BaseMapClient>
        </Card>
        <Card className="col-span-12 lg:col-span-5" title={meterCounterTitle(totalConsumers)}>
          <ul className="space-y-2 text-[13px]">
            {(Object.keys(meterCounts) as MeterState[]).map((state) => (
              <li key={state} className="flex items-center justify-between">
                <span className="capitalize text-muted">{state}</span>
                <span className="num text-text">
                  {formatNumber(meterCounts[state])} ({formatPercent(totalConsumers > 0 ? meterCounts[state] / totalConsumers : 0)})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title={leverStackTitle()}>
          {leverTotals.length > 0 ? <LeverStack levers={leverTotals} gapKw={activeGapKw} /> : <p className="text-[12px] text-faint">No levers firing right now.</p>}
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={activePlansTitle(activePlans.length)}>
          <div className="flex flex-col gap-2">
            {activePlans.length === 0 ? <p className="text-[12px] text-faint">No plans in dispatch right now.</p> : activePlans.map((p) => <PlanCard key={p.id} plan={p} />)}
          </div>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={liveFeedTitle(liveState === "live")}>
          <div className="flex items-center gap-2 pb-2 text-[11px] text-muted">
            <LiveDot state={liveState === "live" ? "live" : liveState === "stale" ? "stale" : "offline"} />
            {liveState}
          </div>
          {liveEvents.length === 0 ? (
            <p className="text-[12px] text-faint">No live stream events yet -- showing historical events below.</p>
          ) : (
            <ol className="space-y-1.5 text-[12px]">
              {liveEvents.slice(0, 8).map((e) => (
                <li key={e.id} className="text-text">
                  {formatIstTime(new Date(e.receivedAt).toISOString())} -- {e.kind}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card title={historyTitle(eventRows.length)}>
        <EventTimeline events={eventRows} />
      </Card>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton, Skeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { StatusTag } from "@/components/ds/StatusTag";
import { SituationBanner } from "@/components/grid/SituationBanner";
import { LeverStack } from "@/components/grid/LeverStack";
import { PlanCard } from "@/components/grid/PlanCard";
import { EventTimeline } from "@/components/grid/EventTimeline";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { SupplyDemandChart, type SupplyDemandPoint } from "@/components/charts/SupplyDemandChart";
import { BaseMapClient, ServiceAreaLayerClient, DtLayerClient, AssetLayerClient } from "@/components/map/client";
import { MapLegend } from "@/components/map/MapLegend";
import { useCriticalFacilities, useEvents, usePlans, useReliability, useSubdivisions, useTransformers } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import { SUBDIVISION_LABEL, isSubdivisionId } from "@/lib/scope";
import { LEVER_ORDER, type LeverKey, type RiskLevel } from "@/lib/domain";
import type { LeverAllocation } from "@/lib/api/types";
import { diurnalValue } from "@/lib/diurnalShape";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  criticalLoadsTitle,
  eventsTitle,
  heatmapTitle,
  leagueTableTitle,
  leverStackTitle,
  mapCardTitle,
  moneyshotLabel,
  pendingPlansTitle,
  reliabilityGainTitle,
  riskMixTitle,
  situationHeadline,
  supplyDemandTitle,
} from "./titles";

const RISK_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

export function CommandView() {
  const { scope } = useScope();
  const subdivisions = useSubdivisions();
  const transformers = useTransformers(scope);
  const plans = usePlans(scope);
  const critical = useCriticalFacilities(scope);
  const events = useEvents(scope);
  const reliability = useReliability(scope);

  const loading =
    subdivisions.data === undefined ||
    transformers.data === undefined ||
    plans.data === undefined ||
    critical.data === undefined ||
    events.data === undefined;

  const subs = useMemo(() => subdivisions.data?.subdivisions ?? [], [subdivisions.data]);
  const dts = useMemo(() => transformers.data?.transformers ?? [], [transformers.data]);
  const allPlans = useMemo(() => plans.data?.plans ?? [], [plans.data]);
  const facilities = useMemo(() => critical.data?.facilities ?? [], [critical.data]);
  const eventRows = events.data?.events ?? [];

  const worst = useMemo(
    () => subs.reduce<typeof subs[number] | null>((acc, s) => (!acc || RISK_RANK[s.riskLevel] > RISK_RANK[acc.riskLevel] ? s : acc), null),
    [subs],
  );

  const servedFraction = useMemo(() => {
    if (subs.length === 0) return 1;
    return subs.reduce((sum, s) => sum + s.servedFraction, 0) / subs.length;
  }, [subs]);

  const dtAtRiskCount = useMemo(() => dts.filter((d) => d.riskLevel === "high" || d.riskLevel === "critical").length, [dts]);

  const sortedLeague = useMemo(() => [...subs].sort((a, b) => b.riskIndex - a.riskIndex), [subs]);

  const heatmapRows = sortedLeague.map((s) => s.name);
  const heatmapCells: HourHeatmapCell[] = useMemo(() => {
    const cells: HourHeatmapCell[] = [];
    for (const s of sortedLeague) {
      for (let hour = 0; hour < 24; hour++) {
        cells.push({ row: s.name, hour, value: diurnalValue(s.riskIndex, hour) });
      }
    }
    return cells;
  }, [sortedLeague]);

  const representativeDt = dts.length > 0 ? [...dts].sort((a, b) => b.loadingPu - a.loadingPu)[0] : null;
  const supplyDemandData: SupplyDemandPoint[] = useMemo(() => {
    if (!representativeDt) return [];
    const demandNow = representativeDt.loadingPu * representativeDt.ratingKva;
    const availableNow = representativeDt.ratingKva;
    return Array.from({ length: 24 }, (_, hour) => ({
      x: `${String(hour).padStart(2, "0")}:00`,
      demandKw: diurnalValue(demandNow, hour),
      availableKw: availableNow * 0.9,
    }));
  }, [representativeDt]);

  const pendingPlans = allPlans.filter((p) => p.status === "draft" || p.status === "proposed");

  const leverTotals: LeverAllocation[] = useMemo(() => {
    const byLever = new Map<LeverKey, LeverAllocation>();
    for (const plan of allPlans) {
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
  }, [allPlans]);

  const totalGapKw = allPlans.reduce((s, p) => s + p.gapKw, 0);

  const facilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of facilities) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
    return counts;
  }, [facilities]);

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const d of dts) counts[d.riskLevel] += 1;
    return counts;
  }, [dts]);

  const dtById = useMemo(() => new Map(dts.map((d) => [d.id, d])), [dts]);
  const facilityLocations = useMemo(
    () =>
      facilities
        .map((f) => {
          const dt = dtById.get(f.dtId);
          if (!dt) return null;
          return { id: f.id, name: f.name, location: dt.location, kind: f.kind };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null),
    [facilities, dtById],
  );

  const criticalCount = dts.filter((d) => d.riskLevel === "critical").length;

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Command" title="Grid Command Centre" />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Command"
        title="Grid Command Centre"
        description="Every sub-division, every transformer, every Flex Plan -- one screen for the control room."
      />

      <div className="mb-3">
        <SituationBanner
          riskLevel={worst?.riskLevel ?? "low"}
          headline={worst ? situationHeadline(worst.name, worst.riskLevel) : "No sub-division data yet"}
          detail={worst ? `Risk index ${worst.riskIndex.toFixed(2)} -- ${worst.consumerCount.toLocaleString("en-IN")} consumers` : undefined}
        />
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title="Moneyshot" eyebrow="Right now" live>
          <p className="num text-[34px] font-semibold leading-none text-text">{formatPercent(servedFraction)}</p>
          <p className="mt-1 text-[13px] text-muted">{moneyshotLabel(servedFraction)}</p>
        </Card>
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-6">
          <CompareStat label="Relief delivered" solutionValue={allPlans.reduce((s, p) => s + p.coveredKw, 0)} baselineValue={0} unit=" kW" />
          <CompareStat label="Hours of help" solutionValue={reliability.data?.hoursOfHelp ?? 0} baselineValue={0} unit=" h" />
          <CompareStat label="Active plans" solutionValue={allPlans.filter((p) => p.status === "approved" || p.status === "dispatched" || p.status === "active").length} baselineValue={0} unit="" fractionDigits={0} />
          <CompareStat label="DT at risk" solutionValue={dtAtRiskCount} baselineValue={dts.length} unit="" fractionDigits={0} direction="up-bad" />
          <CompareStat label="Lifeline availability" solutionValue={reliability.data?.lifelineAvailabilityPct ?? 0} baselineValue={100} unit="%" />
          <CompareStat label="SAIDI" solutionValue={reliability.data?.saidiMinutes ?? 0} baselineValue={(reliability.data?.saidiMinutes ?? 0) + (reliability.data?.hoursOfHelp ?? 0) * 60} unit=" min" direction="up-bad" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-8" title={mapCardTitle(dtAtRiskCount)} live footer={<MapLegend />}>
          <BaseMapClient height={360} fitPoints={dts.map((d) => [d.location.lat, d.location.lng] as [number, number])}>
            <ServiceAreaLayerClient
              features={dts.map((d) => ({ dtId: d.id, name: d.name, polygon: d.serviceAreaPolygon, riskLevel: d.riskLevel }))}
            />
            <DtLayerClient dts={dts.map((d) => ({ id: d.id, name: d.name, location: d.location, riskLevel: d.riskLevel, loadingPu: d.loadingPu }))} />
            <AssetLayerClient assets={facilityLocations} />
          </BaseMapClient>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={leagueTableTitle(sortedLeague.length)}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-faint">
                <th className="py-1">Sub-division</th>
                <th className="py-1 text-right">Risk</th>
                <th className="py-1 text-right">Served</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeague.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1.5 text-text">{s.name}</td>
                  <td className="num py-1.5 text-right text-muted">{s.riskIndex.toFixed(2)}</td>
                  <td className="num py-1.5 text-right text-muted">{formatPercent(s.servedFraction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-6" title={heatmapTitle()}>
          <HourHeatmap rows={heatmapRows} cells={heatmapCells} label="Sub-division risk by hour" />
        </Card>
        <Card className="col-span-12 lg:col-span-6" title={representativeDt ? supplyDemandTitle(representativeDt.name) : "Supply vs demand"}>
          {supplyDemandData.length > 0 ? (
            <SupplyDemandChart data={supplyDemandData} />
          ) : (
            <Skeleton className="h-[220px]" />
          )}
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title={pendingPlansTitle(pendingPlans.length)}>
          <div className="flex flex-col gap-2">
            {pendingPlans.length === 0 ? (
              <p className="text-[12px] text-faint">Nothing waiting on a Junior or Assistant Engineer.</p>
            ) : (
              pendingPlans.slice(0, 4).map((p) => <PlanCard key={p.id} plan={p} />)
            )}
          </div>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={leverStackTitle(totalGapKw)}>
          {leverTotals.length > 0 ? (
            <LeverStack levers={leverTotals} gapKw={totalGapKw} />
          ) : (
            <p className="text-[12px] text-faint">No lever activity across current plans.</p>
          )}
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={criticalLoadsTitle(facilities.length)} footer={<StatusTag status="LIVE" size="sm" title="Critical facility registry is real demo data" />}>
          <ul className="space-y-1.5 text-[12px]">
            {Object.entries(facilityCounts).map(([kind, count]) => (
              <li key={kind} className="flex items-center justify-between">
                <span className="capitalize text-muted">{kind.replace("_", " ")}</span>
                <span className="num text-text">{count}</span>
              </li>
            ))}
            {facilities.length === 0 && <li className="text-faint">No critical facilities registered.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title={reliabilityGainTitle(reliability.data?.hoursOfHelp ?? 0)}>
          <CompareStat label="Hours of help delivered" solutionValue={reliability.data?.hoursOfHelp ?? 0} baselineValue={0} unit=" h" />
          <p className="mt-2 text-[11px] text-faint">
            SAIFI {formatNumber(reliability.data?.saifiCount ?? 0, 2)} -- Lifeline availability {formatPercent((reliability.data?.lifelineAvailabilityPct ?? 0) / 100)}
          </p>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={riskMixTitle(criticalCount)}>
          <ul className="space-y-1.5 text-[12px]">
            {(Object.keys(riskCounts) as RiskLevel[]).map((level) => (
              <li key={level} className="flex items-center justify-between">
                <span className="capitalize text-muted">{level}</span>
                <span className="num text-text">
                  {riskCounts[level]} ({formatPercent(dts.length > 0 ? riskCounts[level] / dts.length : 0)})
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={eventsTitle(eventRows.length)} live>
          <div className="max-h-[220px] overflow-y-auto">
            <EventTimeline events={eventRows} />
          </div>
        </Card>
      </div>

      {(subdivisions.offline || transformers.offline || plans.offline) && (
        <p className="mt-3 text-[11px] text-faint">
          {isSubdivisionId(scope) ? SUBDIVISION_LABEL[scope] : "All sub-divisions"} -- showing committed fixtures while the backend is unreachable.
        </p>
      )}
    </div>
  );
}

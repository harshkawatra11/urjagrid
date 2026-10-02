"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { FanChart, type FanChartPoint } from "@/components/charts/FanChart";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { ThermalTrace, type ThermalTracePoint } from "@/components/charts/ThermalTrace";
import { MeterWall } from "@/components/grid/MeterWall";
import { SingleLineDiagram } from "@/components/grid/SingleLineDiagram";
import { PlanCard } from "@/components/grid/PlanCard";
import { useConsumers, useForecast, usePlans, useTransformer } from "@/lib/api/hooks";
import { diurnalValue } from "@/lib/diurnalShape";
import { formatIstTime, formatKw, formatNumber } from "@/lib/format";
import { CONSUMER_TIER_LABEL, type ConsumerTier } from "@/lib/domain";
import {
  caseFileHeadline,
  forecastTitle,
  hotspotGaugeTitle,
  loadingGaugeTitle,
  meterWallTitle,
  relatedPlansTitle,
  riskDriversTitle,
  servedFractionLabel,
  sldTitle,
  thermalTraceTitle,
  whosHereTitle,
} from "./titles";

const V_MIN_PU = 0.94;
const V_MAX_PU = 1.06;
const HOTSPOT_ALARM_C = 110;
const TRIP_LOADING_PU = 1.3;

export function TransformerDetailView() {
  const params = useParams<{ dtId: string }>();
  const dtId = typeof params.dtId === "string" ? params.dtId : Array.isArray(params.dtId) ? params.dtId[0] : "";

  const transformer = useTransformer(dtId);
  const forecast = useForecast(dtId);
  const consumers = useConsumers(dtId);
  const plans = usePlans("all");

  const dt = transformer.data;
  const forecastPoints: FanChartPoint[] = useMemo(
    () => (forecast.data?.points ?? []).map((p) => ({ x: formatIstTime(p.slotIso), p10: p.p10Kw, p50: p.p50Kw, p90: p.p90Kw, actual: p.actualKw })),
    [forecast.data],
  );

  const thermalData: ThermalTracePoint[] = useMemo(() => {
    if (!dt) return [];
    const ambientC = 32;
    return Array.from({ length: 24 }, (_, hour) => {
      const shapeValue = diurnalValue(1, hour);
      return {
        x: `${String(hour).padStart(2, "0")}:00`,
        hotspotC: ambientC + (dt.hotspotC - ambientC) * shapeValue,
        loadingPu: dt.loadingPu * shapeValue,
      };
    });
  }, [dt]);

  const consumerRows = useMemo(() => consumers.data?.consumers ?? [], [consumers.data]);
  const relatedPlans = useMemo(() => (plans.data?.plans ?? []).filter((p) => p.dtIds.includes(dtId)), [plans.data, dtId]);

  const tierCounts = useMemo(() => {
    const counts: Record<ConsumerTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0 };
    for (const c of consumerRows) counts[c.tier] += 1;
    return counts;
  }, [consumerRows]);

  const riskDrivers = useMemo(() => {
    if (!dt) return [];
    const drivers: string[] = [];
    if (dt.loadingPu >= TRIP_LOADING_PU) drivers.push(`Loading ${(dt.loadingPu * 100).toFixed(0)}% is at or above the ${(TRIP_LOADING_PU * 100).toFixed(0)}% trip threshold.`);
    else if (dt.loadingPu >= 1.0) drivers.push(`Loading ${(dt.loadingPu * 100).toFixed(0)}% exceeds rated capacity.`);
    if (dt.hotspotC >= HOTSPOT_ALARM_C) drivers.push(`Hot-spot ${dt.hotspotC.toFixed(1)} degC is at or above the ${HOTSPOT_ALARM_C} degC alarm.`);
    if (dt.voltagePu < V_MIN_PU || dt.voltagePu > V_MAX_PU) drivers.push(`Voltage ${dt.voltagePu.toFixed(2)} pu is outside the ${V_MIN_PU}-${V_MAX_PU} pu band.`);
    if (dt.lossOfLifePct > 2) drivers.push(`Loss-of-life ${dt.lossOfLifePct.toFixed(1)}% this window is elevated.`);
    if (drivers.length === 0) drivers.push("No thresholds breached -- transformer is within normal operating limits.");
    return drivers;
  }, [dt]);

  const loading = transformer.data === undefined;

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Transformers" title="Transformer Case File" breadcrumbs={[{ label: "Transformers", href: "/transformers" }, { label: dtId }]} />
        <PanelSkeleton />
      </div>
    );
  }

  if (!dt) {
    return (
      <div>
        <PageHeader eyebrow="Transformers" title="Transformer Case File" breadcrumbs={[{ label: "Transformers", href: "/transformers" }, { label: dtId }]} />
        <p className="text-[13px] text-muted">No transformer found for id &quot;{dtId}&quot;.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Transformers"
        title={caseFileHeadline(dt.name, dt.riskLevel)}
        description={`${dt.ratingKva} kVA -- ${servedFractionLabel(dt.servedFraction)}`}
        breadcrumbs={[{ label: "Transformers", href: "/transformers" }, { label: dt.id }]}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CompareStat label="Loading" solutionValue={dt.loadingPu} baselineValue={1} unit=" pu" direction="up-bad" fractionDigits={2} />
        <CompareStat label="Hot-spot" solutionValue={dt.hotspotC} baselineValue={HOTSPOT_ALARM_C} unit=" degC" direction="up-bad" />
        <CompareStat label="Served fraction" solutionValue={dt.servedFraction * 100} baselineValue={100} unit="%" />
        <CompareStat label="Loss of life" solutionValue={dt.lossOfLifePct} baselineValue={0} unit="%" direction="up-bad" fractionDigits={2} />
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-8" title={forecastTitle(forecastPoints.length > 0)}>
          {forecastPoints.length > 0 ? (
            <FanChart data={forecastPoints} limitKw={forecast.data?.points[0]?.limitKw} />
          ) : (
            <p className="text-[12px] text-faint">No forecast fixture committed for this transformer yet.</p>
          )}
        </Card>
        <div className="col-span-12 flex flex-col gap-3 lg:col-span-4">
          <Card title={loadingGaugeTitle(dt.loadingPu)}>
            <div className="flex justify-center">
              <GaugeArc value={dt.loadingPu} max={TRIP_LOADING_PU} valueLabel={`${(dt.loadingPu * 100).toFixed(0)}%`} label="DT loading" />
            </div>
          </Card>
          <Card title={hotspotGaugeTitle(dt.hotspotC)}>
            <div className="flex justify-center">
              <GaugeArc value={dt.hotspotC} max={120} color="var(--orange)" valueLabel={`${dt.hotspotC.toFixed(0)}degC`} label="Hot-spot temperature" />
            </div>
          </Card>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-6" title={meterWallTitle(consumerRows.length)}>
          {consumerRows.length > 0 ? <MeterWall consumers={consumerRows} /> : <p className="text-[12px] text-faint">No consumer fixture committed for this transformer.</p>}
        </Card>
        <Card className="col-span-12 lg:col-span-6" title={sldTitle(dt.name)}>
          <SingleLineDiagram
            substation={{ id: "sub", label: "33/11kV substation" }}
            feeder={{ id: dt.feederId, label: dt.feederId, riskLevel: dt.riskLevel }}
            transformer={{ id: dt.id, label: dt.name, riskLevel: dt.riskLevel }}
            branches={consumerRows.slice(0, 4).map((c) => ({ id: c.id, label: `LV -- ${c.tier}` }))}
          />
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-7" title={thermalTraceTitle()}>
          <ThermalTrace data={thermalData} />
        </Card>
        <Card className="col-span-12 lg:col-span-5" title={riskDriversTitle(riskDrivers.length)}>
          <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-muted">
            {riskDrivers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-6" title={whosHereTitle(consumerRows.length)}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-faint">
                <th className="py-1">Tier</th>
                <th className="py-1 text-right">Consumers</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(tierCounts) as ConsumerTier[]).map((tier) => (
                <tr key={tier} className="border-t border-border">
                  <td className="py-1.5 text-text">{CONSUMER_TIER_LABEL[tier]}</td>
                  <td className="num py-1.5 text-right text-muted">{formatNumber(tierCounts[tier])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="col-span-12 lg:col-span-6" title={relatedPlansTitle(relatedPlans.length)}>
          <div className="flex flex-col gap-2">
            {relatedPlans.length === 0 ? (
              <p className="text-[12px] text-faint">This transformer has no active or past Flex Plans.</p>
            ) : (
              relatedPlans.map((p) => <PlanCard key={p.id} plan={p} />)
            )}
          </div>
        </Card>
      </div>

      {transformer.offline && <p className="mt-3 text-[11px] text-faint">Showing committed fixture data -- backend unreachable.</p>}
      <p className="mt-2 text-[11px] text-faint">Relief so far from related plans: {formatKw(relatedPlans.reduce((s, p) => s + p.coveredKw, 0))}</p>
    </div>
  );
}

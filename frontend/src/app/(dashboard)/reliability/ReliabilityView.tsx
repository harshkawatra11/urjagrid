"use client";

import { useMemo } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { SupplyDemandChart, type SupplyDemandPoint } from "@/components/charts/SupplyDemandChart";
import { useForecast, useReliability } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import type { ScenarioRunResult } from "@/lib/api/types";
import { heatVar } from "@/lib/heat";
import heatwaveScenario from "@/data/fixtures/scenario__heatwave_evening__run.json";
import { calibrationTitle, reliabilityHeadline, trendTitle } from "./titles";

const SCENARIO: ScenarioRunResult = heatwaveScenario as ScenarioRunResult;

/** Firm-share-by-kind calibration assumptions (SPEC B10 / `backend/app/grid/supply.py`): a
 * rank-ordered, plausible-magnitude prototype calibration, not a statistical fit to raw CEEW
 * microdata (which was unavailable in this environment). */
const CALIBRATION_ROWS = [
  { kind: "Urban", firmShare: 0.88, exampleTown: "Bareilly city core" },
  { kind: "Semi-urban", firmShare: 0.78, exampleTown: "Mathura town" },
  { kind: "Rural", firmShare: 0.68, exampleTown: "Outlying sub-divisions" },
] as const;

export function ReliabilityView() {
  const { scope } = useScope();
  const reliability = useReliability(scope);
  const forecast = useForecast("dt_sn_01");

  const r = reliability.data;

  const trendData: SupplyDemandPoint[] = useMemo(
    () => (forecast.data?.points ?? []).map((p) => ({ x: p.slotIso.slice(11, 16), demandKw: p.p50Kw, availableKw: p.availableKw })),
    [forecast.data],
  );

  const loading = reliability.data === undefined;
  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Reliability" />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Reliability" description={r ? reliabilityHeadline(r.hoursOfHelp) : "Reliability metrics unavailable"} />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CompareStat
          label="SAIDI (modelled baseline)"
          solutionValue={r?.saidiMinutes ?? 0}
          baselineValue={(r?.saidiMinutes ?? 0) + SCENARIO.diff.hardshipHoursAvoided * 60}
          unit=" min"
          direction="up-bad"
        />
        <CompareStat
          label="SAIFI (modelled baseline)"
          solutionValue={r?.saifiCount ?? 0}
          baselineValue={(r?.saifiCount ?? 0) + SCENARIO.diff.hardshipHoursAvoided / 24}
          unit=""
          direction="up-bad"
          fractionDigits={2}
        />
        <CompareStat
          label="Lifeline availability"
          solutionValue={r?.lifelineAvailabilityPct ?? 0}
          baselineValue={Math.max(0, (r?.lifelineAvailabilityPct ?? 0) - SCENARIO.diff.hardshipHoursAvoided * 2)}
          unit="%"
        />
        <CompareStat label="Hours of help" solutionValue={r?.hoursOfHelp ?? 0} baselineValue={0} unit=" h" />
        <CompareStat
          label={`Served (${SCENARIO.scenarioName})`}
          solutionValue={SCENARIO.solution.totalServedKw}
          baselineValue={SCENARIO.shadowBaseline.totalServedKw}
          unit=" kW"
          fractionDigits={0}
        />
        <CompareStat
          label={`Unserved (${SCENARIO.scenarioName})`}
          solutionValue={SCENARIO.solution.totalUnservedKw}
          baselineValue={SCENARIO.shadowBaseline.totalUnservedKw}
          unit=" kW"
          direction="up-bad"
          fractionDigits={0}
        />
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12" title={trendTitle("Subhash Nagar DT 01")}>
          {trendData.length > 0 ? <SupplyDemandChart data={trendData} /> : <p className="text-[12px] text-faint">No forecast fixture to trend.</p>}
        </Card>
      </div>

      <Card title={calibrationTitle()}>
        <table className="w-full text-[12px]" role="grid" aria-label="Firm-share calibration matrix">
          <thead>
            <tr className="text-left text-faint">
              <th className="py-1">Kind</th>
              <th className="py-1 text-center">Firm share</th>
              <th className="py-1 text-center">Modelled outage exposure</th>
              <th className="py-1">Example</th>
            </tr>
          </thead>
          <tbody>
            {CALIBRATION_ROWS.map((row) => (
              <tr key={row.kind} className="border-t border-border">
                <td className="py-1.5 text-text">{row.kind}</td>
                <td className="py-1.5 text-center">
                  <span
                    className="num inline-block w-16 rounded-sm px-2 py-1 text-text"
                    style={{ background: heatVar(1 - row.firmShare) }}
                  >
                    {(row.firmShare * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="py-1.5 text-center">
                  <span className="num inline-block w-16 rounded-sm px-2 py-1 text-text" style={{ background: heatVar(1 - row.firmShare) }}>
                    {((1 - row.firmShare) * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="py-1.5 text-faint">{row.exampleTown}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-faint">
          Rank-ordered against CEEW&apos;s Access, Affordability and Reliability of Power Supply surveys (rural sub-divisions see
          materially more outage hours than urban ones) -- a plausible-magnitude prototype calibration, not a statistical fit, since
          raw CEEW microdata was unavailable in this environment.
        </p>
      </Card>

      {reliability.offline && <p className="mt-3 text-[11px] text-faint">Showing committed fixture data -- backend unreachable.</p>}
    </div>
  );
}

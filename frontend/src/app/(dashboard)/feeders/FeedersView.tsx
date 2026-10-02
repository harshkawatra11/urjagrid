"use client";

import { useScope } from "@/lib/scope";
import { useFeeders } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { CompareStat } from "@/components/ds/CompareStat";
import { CompareBars } from "@/components/charts/CompareBars";
import { StepLine, type StepLinePoint } from "@/components/charts/StepLine";
import { RISK_LEVEL_COLOR_VAR, cssVar } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { baselineOffHours, boardTitle, hourlyTrack, moneyshotTitle, solutionOffHours } from "./titles";

function OnOffStrip({ track, label }: { track: Array<"on" | "shed">; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-faint">{label}</span>
      <div className="flex flex-1 gap-[2px]">
        {track.map((state, h) => (
          <div
            key={h}
            title={`${h}:00 ${state}`}
            className={cn("h-3 flex-1 rounded-[1px]", state === "on" ? "bg-brand" : "bg-red")}
          />
        ))}
      </div>
    </div>
  );
}

export function FeedersView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useFeeders(scope);
  const feeders = data?.feeders ?? [];

  if (isLoading && feeders.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Network" title="Feeders" description="Every 11kV feeder: on/off strip, loading, and risk." />
        <PanelSkeleton />
      </div>
    );
  }

  const avgSolutionOff = feeders.length ? feeders.reduce((s, f) => s + solutionOffHours(f), 0) / feeders.length : 0;
  const avgBaselineOff = feeders.length ? feeders.reduce((s, f) => s + baselineOffHours(f), 0) / feeders.length : 0;
  const calibrationRows = feeders.map((f) => ({ label: f.name, solution: solutionOffHours(f), baseline: baselineOffHours(f) }));
  const loadingPoints: StepLinePoint[] = feeders.map((f) => ({ x: f.name, value: f.loadingPu }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Network" title="Feeders" description={boardTitle(feeders.length)} />
      </div>

      <Card title="Hours of shedding avoided" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <CompareStat
          label={moneyshotTitle(avgBaselineOff - avgSolutionOff)}
          solutionValue={avgSolutionOff}
          baselineValue={avgBaselineOff}
          unit="h"
          direction="up-bad"
        />
      </Card>

      <Card title="Feeders at risk" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{feeders.filter((f) => f.riskLevel === "high" || f.riskLevel === "critical").length}</p>
        <p className="text-[11px] text-faint">high/critical risk</p>
      </Card>

      <Card title="Avg loading" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">
          {feeders.length ? (feeders.reduce((s, f) => s + f.loadingPu, 0) / feeders.length).toFixed(2) : "—"} pu
        </p>
      </Card>

      <Card title="Total DTs served" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{feeders.reduce((s, f) => s + f.dtIds.length, 0)}</p>
      </Card>

      <Card title="11kV feeders" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{feeders.length}</p>
      </Card>

      <Card title="On/off strip (24h)" eyebrow="Solution vs baseline" className="col-span-12">
        <div className="space-y-3">
          {feeders.map((f) => (
            <div key={f.id}>
              <p className="mb-1 text-[11px] font-medium text-text">
                {f.name} <span style={{ color: cssVar(RISK_LEVEL_COLOR_VAR[f.riskLevel]) }}>· {f.riskLevel}</span>
              </p>
              <OnOffStrip track={hourlyTrack(solutionOffHours(f))} label="UrjaGrid" />
              <OnOffStrip track={hourlyTrack(baselineOffHours(f))} label="Baseline" />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Loading by feeder" eyebrow="pu of rating" className="col-span-12 lg:col-span-6">
        <StepLine data={loadingPoints} name="Loading" unit="pu" />
      </Card>

      <Card title="Shedding hours: solution vs baseline" eyebrow="CEEW calibration" className="col-span-12 lg:col-span-6">
        <CompareBars rows={calibrationRows} unit="h" />
      </Card>

      <Card title="Feeder table" eyebrow="Directory" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Feeder</th>
              <th className="px-2 py-1 text-right">Voltage</th>
              <th className="px-2 py-1 text-right">Loading</th>
              <th className="px-2 py-1 text-right">DTs</th>
              <th className="px-2 py-1 text-right">Risk</th>
            </tr>
          </thead>
          <tbody>
            {feeders.map((f) => (
              <tr key={f.id}>
                <td className="px-2 py-1.5 text-text">{f.name}</td>
                <td className="num px-2 py-1.5 text-right">{f.voltageKv} kV</td>
                <td className="num px-2 py-1.5 text-right">{f.loadingPu.toFixed(2)} pu</td>
                <td className="num px-2 py-1.5 text-right">{f.dtIds.length}</td>
                <td className="px-2 py-1.5 text-right capitalize" style={{ color: cssVar(RISK_LEVEL_COLOR_VAR[f.riskLevel]) }}>
                  {f.riskLevel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

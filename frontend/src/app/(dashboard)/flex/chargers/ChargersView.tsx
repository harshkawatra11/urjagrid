"use client";

import { useScope } from "@/lib/scope";
import { useChargers, useProtocols } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { CompareBars } from "@/components/charts/CompareBars";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { ProtocolMessage } from "@/components/grid/ProtocolMessage";
import { formatKw } from "@/lib/format";
import { fleetTitle, kwRecovered, moneyshotTitle, statusCounts } from "./titles";

export function ChargersView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useChargers(scope);
  const { data: protocolData } = useProtocols(scope);
  const chargers = data?.chargers ?? [];
  const ocppMessages = (protocolData?.entries ?? []).filter((m) => m.protocol === "ocpp");

  if (isLoading && chargers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Flex Levers" title="Managed Charging" description="L2: OCPP SetChargingProfile to e-rickshaw/EV hubs." />
        <PanelSkeleton />
      </div>
    );
  }

  const counts = statusCounts(chargers);
  const avgCurtailment = chargers.length ? (chargers.reduce((s, c) => s + c.curtailmentFraction, 0) / chargers.length) * 100 : 0;
  const curtailmentRows = chargers.map((c) => ({
    label: c.name.replace("Subhash Nagar ", "").replace("Krishna Nagar ", "").replace("Izzatnagar ", "").replace("Kosi Kalan ", ""),
    solution: Number((c.curtailmentFraction * 100).toFixed(0)),
    baseline: 0,
  }));
  const heatCells: HourHeatmapCell[] = chargers.flatMap((c) =>
    Array.from({ length: 24 }, (_, hour) => ({
      row: c.name,
      hour,
      value: hour >= 18 && hour < 22 ? c.curtailmentFraction : c.curtailmentFraction * 0.2,
    })),
  );

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Flex Levers" title="Managed Charging" description="L2 lever: OCPP 1.6J SetChargingProfile curtails e-rickshaw/EV hubs before any home is capped." />
      </div>

      <Card title="Fleet curtailment" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <GaugeArc value={avgCurtailment} max={100} valueLabel={`${avgCurtailment.toFixed(0)}%`} label="Average curtailment fraction" />
        <p className="mt-2 text-[12px] text-muted">{moneyshotTitle(avgCurtailment)}</p>
      </Card>

      <Card title="kW recovered" eyebrow="Relief" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{formatKw(kwRecovered(chargers))}</p>
      </Card>

      <Card title="Charging" eyebrow="Status" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.charging}</p>
      </Card>

      <Card title="Curtailed" eyebrow="Status" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.curtailed}</p>
      </Card>

      <Card title="Offline" eyebrow="Status" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.offline}</p>
      </Card>

      <Card title={fleetTitle(chargers.length)} eyebrow="Fleet status" className="col-span-12 lg:col-span-7">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Charger</th>
              <th className="px-2 py-1">Kind</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1 text-right">Power</th>
              <th className="px-2 py-1 text-right">Curtailment</th>
            </tr>
          </thead>
          <tbody>
            {chargers.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-1.5 text-text">{c.name}</td>
                <td className="px-2 py-1.5 capitalize text-muted">{c.kind.replace("_", "-")}</td>
                <td className="px-2 py-1.5 capitalize text-muted">{c.status}</td>
                <td className="num px-2 py-1.5 text-right">{c.powerKw.toFixed(1)} / {c.ratedKw} kW</td>
                <td className="num px-2 py-1.5 text-right">{(c.curtailmentFraction * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Curtailment fraction by charger" eyebrow="Chart" className="col-span-12 lg:col-span-5">
        <CompareBars rows={curtailmentRows} unit="%" />
      </Card>

      <Card title="Evening-peak curtailment pattern" eyebrow="Heatmap" className="col-span-12">
        <HourHeatmap rows={chargers.map((c) => c.name)} cells={heatCells} />
      </Card>

      <Card title="OCPP message log" eyebrow="WIRED" className="col-span-12">
        <div className="space-y-2">
          {ocppMessages.length === 0 ? (
            <p className="text-[12px] text-faint">No OCPP messages in this scope.</p>
          ) : (
            ocppMessages.map((m) => <ProtocolMessage key={m.id} message={m} />)
          )}
        </div>
      </Card>
    </div>
  );
}

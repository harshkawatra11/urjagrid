"use client";

import { useScope } from "@/lib/scope";
import { useStorageAssets, useProtocols } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { StepLine, type StepLinePoint } from "@/components/charts/StepLine";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { ProtocolMessage } from "@/components/grid/ProtocolMessage";
import { formatIstTime, formatKw, formatKwh, formatRupees } from "@/lib/format";
import { avgSoc, fleetTitle, moneyshotTitle, tradeValueRs, tradeVolumeKwh } from "./titles";

export function StorageView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useStorageAssets(scope);
  const { data: protocolData } = useProtocols(scope);
  const assets = data?.storageAssets ?? [];
  const trades = data?.trades ?? [];
  const becknMessages = (protocolData?.entries ?? []).filter((m) => m.protocol === "beckn");

  if (isLoading && assets.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Flex Levers" title="Storage & P2P" description="L4: existing storage discharge + Beckn/UEI peer-to-peer energy trades." />
        <PanelSkeleton />
      </div>
    );
  }

  const totalDispatch = assets.reduce((s, a) => s + a.dispatchKw, 0);
  const socPoints: StepLinePoint[] = assets.map((a) => ({ x: a.name, value: a.socPct }));
  const heatCells: HourHeatmapCell[] = assets.flatMap((a) =>
    Array.from({ length: 24 }, (_, hour) => ({
      row: a.name,
      hour,
      value: hour >= 18 && hour < 22 ? a.dispatchKw / Math.max(1, a.capacityKwh / 4) : 0.1,
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
        <PageHeader eyebrow="Flex Levers" title="Storage & P2P" description="L4 lever (community storage discharge) plus Beckn/UEI peer-to-peer energy trades between consumers." />
      </div>

      <Card title="Total discharge" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{formatKw(totalDispatch)}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(totalDispatch)}</p>
      </Card>

      <Card title="Avg state of charge" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <GaugeArc value={avgSoc(assets)} max={100} valueLabel={`${avgSoc(assets).toFixed(0)}%`} label="Average SoC" />
      </Card>

      <Card title="Capacity" eyebrow="Fleet" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{assets.reduce((s, a) => s + a.capacityKwh, 0)} kWh</p>
      </Card>

      <Card title="P2P trades" eyebrow="Beckn" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{trades.length}</p>
      </Card>

      <Card title="P2P volume" eyebrow="Beckn" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{formatKwh(tradeVolumeKwh(trades))}</p>
      </Card>

      <Card title={fleetTitle(assets.length)} eyebrow="Fleet" className="col-span-12 lg:col-span-6">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Asset</th>
              <th className="px-2 py-1 text-right">SoC</th>
              <th className="px-2 py-1 text-right">Dispatch</th>
              <th className="px-2 py-1 text-right">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="px-2 py-1.5 text-text">{a.name}</td>
                <td className="num px-2 py-1.5 text-right">{a.socPct}%</td>
                <td className="num px-2 py-1.5 text-right">{formatKw(a.dispatchKw)}</td>
                <td className="num px-2 py-1.5 text-right">{a.capacityKwh} kWh</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="State of charge by asset" eyebrow="Chart" className="col-span-12 lg:col-span-6">
        <StepLine data={socPoints} name="SoC" unit="%" color="var(--cyan)" />
      </Card>

      <Card title="Evening-peak dispatch pattern" eyebrow="Heatmap" className="col-span-12">
        <HourHeatmap rows={assets.map((a) => a.name)} cells={heatCells} />
      </Card>

      <Card title="P2P trade ledger" eyebrow="Beckn/UEI" className="col-span-12 lg:col-span-6">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Seller → Buyer</th>
              <th className="px-2 py-1 text-right">Energy</th>
              <th className="px-2 py-1 text-right">Value</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5 text-text">{t.sellerId} → {t.buyerId}</td>
                <td className="num px-2 py-1.5 text-right">{formatKwh(t.energyKwh)}</td>
                <td className="num px-2 py-1.5 text-right">{formatRupees(t.priceRs * t.energyKwh)}</td>
                <td className="px-2 py-1.5 capitalize text-muted">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-faint">Total settled value {formatRupees(tradeValueRs(trades))}</p>
      </Card>

      <Card title="OpenADR / Beckn message log" eyebrow="WIRED" className="col-span-12 lg:col-span-6">
        <div className="space-y-2">
          {becknMessages.length === 0 ? (
            <p className="text-[12px] text-faint">No Beckn/OpenADR messages in this scope.</p>
          ) : (
            becknMessages.map((m) => <ProtocolMessage key={m.id} message={m} />)
          )}
        </div>
        <p className="mt-2 text-[11px] text-faint">Last trade at {trades[0] ? formatIstTime(trades[0].timestampIso) : "—"}</p>
      </Card>
    </div>
  );
}

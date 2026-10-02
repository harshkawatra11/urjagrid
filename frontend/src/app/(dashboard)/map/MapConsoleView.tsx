"use client";

import { useMemo, useState } from "react";
import { useScope } from "@/lib/scope";
import { useTransformers, useFeeders, useCriticalFacilities } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import {
  BaseMapClient,
  ServiceAreaLayerClient,
  FeederLayerClient,
  DtLayerClient,
  AssetLayerClient,
} from "@/components/map/client";
import { MapLegend } from "@/components/map/MapLegend";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { LAYER_KEYS, LAYER_LABEL, consoleTitle, selectionTitle, type LayerKey } from "./titles";

export function MapConsoleView() {
  const { scope } = useScope();
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ serviceArea: true, feeder: true, dt: true, asset: true });
  const [selected, setSelected] = useState<{ kind: "dt" | "feeder"; id: string } | null>(null);

  const { data: transformersData, isLoading, offline } = useTransformers(scope);
  const { data: feedersData } = useFeeders(scope);
  const { data: criticalData } = useCriticalFacilities(scope);

  const transformers = transformersData?.transformers ?? [];
  const feeders = feedersData?.feeders ?? [];
  const facilities = criticalData?.facilities ?? [];

  const fitPoints = useMemo(() => transformers.map((t) => [t.location.lat, t.location.lng] as [number, number]), [transformers]);

  if (isLoading && transformers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Command" title="Grid Map" description="Service areas, feeders, transformers, critical assets." />
        <PanelSkeleton />
      </div>
    );
  }

  const selectedDt = selected?.kind === "dt" ? transformers.find((t) => t.id === selected.id) : undefined;
  const selectedFeeder = selected?.kind === "feeder" ? feeders.find((f) => f.id === selected.id) : undefined;

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Command" title="Grid Map" description={consoleTitle(transformers.length, feeders.length)} />
      </div>

      <Card title="Fleet served fraction" eyebrow="Moneyshot" className="col-span-6 lg:col-span-3">
        <p className="num text-[22px] font-semibold text-text">
          {transformers.length ? formatPercent(transformers.reduce((s, t) => s + t.servedFraction, 0) / transformers.length) : "—"}
        </p>
        <p className="text-[11px] text-faint">average across transformers in view</p>
      </Card>
      <Card title="Transformers" eyebrow="Count" className="col-span-6 lg:col-span-3">
        <p className="num text-[22px] font-semibold text-text">{transformers.length}</p>
      </Card>
      <Card title="Feeders" eyebrow="Count" className="col-span-6 lg:col-span-3">
        <p className="num text-[22px] font-semibold text-text">{feeders.length}</p>
      </Card>
      <Card title="Critical facilities" eyebrow="Count" className="col-span-6 lg:col-span-3">
        <p className="num text-[22px] font-semibold text-text">{facilities.length}</p>
      </Card>

      <Card title="Layers" eyebrow="Toggle" className="col-span-12 lg:col-span-2">
        <div className="flex flex-col gap-2">
          {LAYER_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-[12px] text-text">
              <input type="checkbox" checked={visible[k]} onChange={() => setVisible((v) => ({ ...v, [k]: !v[k] }))} />
              {LAYER_LABEL[k]}
            </label>
          ))}
        </div>
        <div className="mt-4">
          <MapLegend />
        </div>
      </Card>

      <Card title="GIS console" eyebrow="LIVE" live className="col-span-12 lg:col-span-7">
        <BaseMapClient height={460} fitPoints={fitPoints}>
          {visible.serviceArea && (
            <ServiceAreaLayerClient
              features={transformers.map((t) => ({ dtId: t.id, name: t.name, polygon: t.serviceAreaPolygon, riskLevel: t.riskLevel }))}
              selectedDtId={selected?.kind === "dt" ? selected.id : null}
              onSelect={(id: string) => setSelected({ kind: "dt", id })}
            />
          )}
          {visible.feeder && (
            <FeederLayerClient
              feeders={feeders.map((f) => ({ id: f.id, name: f.name, path: f.path, riskLevel: f.riskLevel }))}
              selectedId={selected?.kind === "feeder" ? selected.id : null}
              onSelect={(id: string) => setSelected({ kind: "feeder", id })}
            />
          )}
          {visible.dt && (
            <DtLayerClient
              dts={transformers.map((t) => ({ id: t.id, name: t.name, location: t.location, riskLevel: t.riskLevel, loadingPu: t.loadingPu }))}
              selectedId={selected?.kind === "dt" ? selected.id : null}
              onSelect={(id: string) => setSelected({ kind: "dt", id })}
            />
          )}
          {visible.asset && (
            <AssetLayerClient
              assets={facilities.map((f) => ({ id: f.id, name: f.name, location: transformers.find((t) => t.id === f.dtId)?.location ?? { lat: 0, lng: 0 }, kind: f.kind }))}
            />
          )}
        </BaseMapClient>
      </Card>

      <Card title="Selection" eyebrow="Drawer" className="col-span-12 lg:col-span-3">
        <p className="mb-2 text-[12px] font-medium text-text">{selectionTitle(selected?.kind ?? null, selected?.id ?? null)}</p>
        {selectedDt && (
          <ul className="space-y-1 text-[12px]">
            <li className="flex justify-between"><span className="text-muted">Loading</span><span className="num text-text">{selectedDt.loadingPu.toFixed(2)} pu</span></li>
            <li className="flex justify-between"><span className="text-muted">Hot-spot</span><span className="num text-text">{selectedDt.hotspotC.toFixed(1)}°C</span></li>
            <li className="flex justify-between"><span className="text-muted">Voltage</span><span className="num text-text">{selectedDt.voltagePu.toFixed(2)} pu</span></li>
            <li className="flex justify-between"><span className="text-muted">Served</span><span className="num text-text">{formatPercent(selectedDt.servedFraction)}</span></li>
            <li className="flex justify-between"><span className="text-muted">Consumers</span><span className="num text-text">{selectedDt.consumerCount}</span></li>
          </ul>
        )}
        {selectedFeeder && (
          <ul className="space-y-1 text-[12px]">
            <li className="flex justify-between"><span className="text-muted">Voltage class</span><span className="num text-text">{selectedFeeder.voltageKv} kV</span></li>
            <li className="flex justify-between"><span className="text-muted">Loading</span><span className="num text-text">{selectedFeeder.loadingPu.toFixed(2)} pu</span></li>
            <li className="flex justify-between"><span className="text-muted">DTs served</span><span className="num text-text">{selectedFeeder.dtIds.length}</span></li>
          </ul>
        )}
        {!selectedDt && !selectedFeeder && <p className="text-[11px] text-faint">Click a polygon, line, or marker on the map.</p>}
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn("mt-3 h-7 w-full rounded-md border border-border text-[11px] text-muted hover:border-border-strong", !selected && "opacity-40")}
          disabled={!selected}
        >
          Clear selection
        </button>
      </Card>

      <Card title="Risk matrix" eyebrow="DT x risk level" className="col-span-12 lg:col-span-5">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Risk level</th>
              <th className="px-2 py-1 text-right">Transformers</th>
              <th className="px-2 py-1 text-right">Feeders</th>
            </tr>
          </thead>
          <tbody>
            {(["low", "moderate", "high", "critical"] as const).map((level) => (
              <tr key={level}>
                <td className="px-2 py-1.5 capitalize text-text">{level}</td>
                <td className="num px-2 py-1.5 text-right">{transformers.filter((t) => t.riskLevel === level).length}</td>
                <td className="num px-2 py-1.5 text-right">{feeders.filter((f) => f.riskLevel === level).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Facilities in view" eyebrow="Registry" className="col-span-12 lg:col-span-7">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facilities.map((f) => (
            <li key={f.id} className="rounded-md border border-border p-2 text-[11px]">
              <p className="font-medium text-text">{f.name}</p>
              <p className="text-faint">{f.kind} · backup {f.backupAvailable ? "yes" : "no"}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

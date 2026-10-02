"use client";

import { useRef } from "react";
import { CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { RISK_LEVEL_COLOR_VAR, cssVar, type RiskLevel } from "@/lib/domain";
import type { LatLng as Point } from "@/lib/api/types";
import { registerDtMarker } from "@/lib/map/lens";

export type MapDt = {
  id: string;
  name: string;
  location: Point;
  riskLevel: RiskLevel;
  loadingPu: number;
};

/**
 * One CircleMarker per DT. Each marker registers itself with `lens.ts` so live telemetry ticks
 * can restyle radius/color imperatively (via the Leaflet handle) instead of re-rendering React.
 */
export function DtLayer({ dts, selectedId, onSelect }: { dts: MapDt[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  return (
    <>
      {dts.map((dt) => (
        <DtMarker key={dt.id} dt={dt} selected={dt.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function DtMarker({ dt, selected, onSelect }: { dt: MapDt; selected: boolean; onSelect?: (id: string) => void }) {
  const ref = useRef<LeafletCircleMarker | null>(null);

  return (
    <CircleMarker
      ref={(instance) => {
        ref.current = instance;
        if (instance) registerDtMarker(dt.id, instance);
        else registerDtMarker(dt.id, null);
      }}
      center={[dt.location.lat, dt.location.lng]}
      radius={selected ? 10 : 7}
      pathOptions={{
        color: selected ? "var(--brand)" : cssVar(RISK_LEVEL_COLOR_VAR[dt.riskLevel]),
        weight: selected ? 3 : 1.5,
        fillColor: cssVar(RISK_LEVEL_COLOR_VAR[dt.riskLevel]),
        fillOpacity: 0.85,
      }}
      eventHandlers={{ click: () => onSelect?.(dt.id) }}
    >
      <LeafletTooltip sticky>
        {dt.name} · {dt.loadingPu.toFixed(2)} pu
      </LeafletTooltip>
    </CircleMarker>
  );
}

"use client";

import { Polyline, Tooltip as LeafletTooltip } from "react-leaflet";
import { RISK_LEVEL_COLOR_VAR, cssVar, type RiskLevel } from "@/lib/domain";
import type { LatLng as Point } from "@/lib/api/types";

export type MapFeeder = {
  id: string;
  name: string;
  path: Point[];
  riskLevel: RiskLevel;
};

/** Paints each 11kV feeder's road-routed polyline, colored by its worst-DT risk level. */
export function FeederLayer({ feeders, selectedId, onSelect }: { feeders: MapFeeder[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  return (
    <>
      {feeders.map((f) => {
        const selected = f.id === selectedId;
        const positions = f.path.map((p) => [p.lat, p.lng] as [number, number]);
        return (
          <Polyline
            key={f.id}
            positions={positions}
            pathOptions={{
              color: selected ? "var(--brand)" : cssVar(RISK_LEVEL_COLOR_VAR[f.riskLevel]),
              weight: selected ? 4 : 2.5,
            }}
            eventHandlers={{ click: () => onSelect?.(f.id) }}
          >
            <LeafletTooltip sticky>{f.name}</LeafletTooltip>
          </Polyline>
        );
      })}
    </>
  );
}

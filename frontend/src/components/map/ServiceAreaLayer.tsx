"use client";

import { Polygon, Tooltip as LeafletTooltip } from "react-leaflet";
import type { PathOptions } from "leaflet";
import { RISK_LEVEL_COLOR_VAR, cssVar, type RiskLevel } from "@/lib/domain";
import type { LatLng as Point } from "@/lib/api/types";

export type ServiceAreaFeature = {
  dtId: string;
  name: string;
  polygon: Point[];
  riskLevel: RiskLevel;
};

/** Paints each DT's Voronoi service-area polygon, filled by risk level. */
export function ServiceAreaLayer({
  features,
  selectedDtId,
  onSelect,
  fillOpacity = 0.25,
}: {
  features: ServiceAreaFeature[];
  selectedDtId?: string | null;
  onSelect?: (dtId: string) => void;
  fillOpacity?: number;
}) {
  return (
    <>
      {features.map((f) => {
        const selected = f.dtId === selectedDtId;
        const color = cssVar(RISK_LEVEL_COLOR_VAR[f.riskLevel]);
        const style: PathOptions = {
          color: selected ? "var(--brand)" : color,
          weight: selected ? 2.5 : 1,
          fillColor: color,
          fillOpacity,
        };
        const positions = f.polygon.map((p) => [p.lat, p.lng] as [number, number]);
        return (
          <Polygon
            key={f.dtId}
            positions={positions}
            pathOptions={style}
            eventHandlers={{ click: () => onSelect?.(f.dtId) }}
          >
            <LeafletTooltip sticky>{f.name}</LeafletTooltip>
          </Polygon>
        );
      })}
    </>
  );
}

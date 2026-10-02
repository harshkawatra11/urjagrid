"use client";

import { CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import type { LatLng as Point } from "@/lib/api/types";

export type MapAsset = {
  id: string;
  name: string;
  location: Point;
  kind: "hospital" | "water" | "telecom" | "life_support" | "charger" | "storage";
};

const ASSET_COLOR: Record<MapAsset["kind"], string> = {
  hospital: "var(--red)",
  water: "var(--cyan)",
  telecom: "var(--violet)",
  life_support: "var(--red)",
  charger: "var(--info)",
  storage: "var(--brand)",
};

/** Fixed-point markers for critical facilities and flexible assets (chargers, storage) on the map. */
export function AssetLayer({ assets }: { assets: MapAsset[] }) {
  return (
    <>
      {assets.map((a) => (
        <CircleMarker
          key={a.id}
          center={[a.location.lat, a.location.lng]}
          radius={5}
          pathOptions={{ color: ASSET_COLOR[a.kind], weight: 1.5, fillColor: ASSET_COLOR[a.kind], fillOpacity: 0.9 }}
        >
          <LeafletTooltip sticky>{a.name}</LeafletTooltip>
        </CircleMarker>
      ))}
    </>
  );
}

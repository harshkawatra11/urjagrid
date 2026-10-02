"use client";

import dynamic from "next/dynamic";
import type { BaseMapProps } from "./BaseMap";

/*
 * Leaflet touches `window` at import time, so every map module is loaded with ssr:false.
 * Import map components from here, never from the module files, in pages.
 */

const BaseMapDynamic = dynamic(() => import("./BaseMap").then((m) => m.BaseMap), { ssr: false });

/** Same box as the map (height prop), so the page does not shift when Leaflet loads. */
export function BaseMapClient(props: BaseMapProps) {
  const height = props.height ?? 420;
  return (
    <div className="relative overflow-hidden rounded-md" style={{ height }}>
      <div aria-hidden className="absolute inset-0 animate-pulse rounded-md border border-border bg-surface-2" />
      <div className="absolute inset-0">
        <BaseMapDynamic {...props} />
      </div>
    </div>
  );
}

export const ServiceAreaLayerClient = dynamic(() => import("./ServiceAreaLayer").then((m) => m.ServiceAreaLayer), { ssr: false });
export const FeederLayerClient = dynamic(() => import("./FeederLayer").then((m) => m.FeederLayer), { ssr: false });
export const DtLayerClient = dynamic(() => import("./DtLayer").then((m) => m.DtLayer), { ssr: false });
export const AssetLayerClient = dynamic(() => import("./AssetLayer").then((m) => m.AssetLayer), { ssr: false });

export type { BaseMapProps } from "./BaseMap";
export type { ServiceAreaFeature } from "./ServiceAreaLayer";
export type { MapFeeder } from "./FeederLayer";
export type { MapDt } from "./DtLayer";
export type { MapAsset } from "./AssetLayer";

import type { Transformer } from "@/lib/api/types";

/** Pure title/label + lens functions for the transformer directory (D7). */

export const LENSES = ["risk", "loading", "hotspot", "voltage", "served"] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABEL: Record<Lens, string> = {
  risk: "Risk",
  loading: "Loading",
  hotspot: "Hot-spot",
  voltage: "Voltage",
  served: "Served",
};

export function lensValue(t: Transformer, lens: Lens): number {
  switch (lens) {
    case "risk":
      return t.riskIndex;
    case "loading":
      return t.loadingPu;
    case "hotspot":
      return t.hotspotC;
    case "voltage":
      return t.voltagePu;
    case "served":
      return t.servedFraction;
  }
}

export function lensUnit(lens: Lens): string {
  switch (lens) {
    case "risk":
      return "";
    case "loading":
      return "pu";
    case "hotspot":
      return "°C";
    case "voltage":
      return "pu";
    case "served":
      return "%";
  }
}

export function directoryTitle(count: number, lens: Lens): string {
  return `${count} transformers, ranked by ${LENS_LABEL[lens].toLowerCase()}`;
}

export function moneyshotTitle(worst: Transformer | undefined): string {
  if (!worst) return "No transformer data available";
  return `${worst.name} is the highest-risk DT (${worst.riskIndex.toFixed(2)})`;
}

/** The dominant driver among loading/hot-spot/voltage deviation for one transformer, used by the
 * "risk drivers" card. Pure so it is directly unit-testable. */
export function dominantDriver(t: Transformer): "loading" | "hotspot" | "voltage" {
  const loadingScore = Math.max(0, (t.loadingPu - 1) / 0.3);
  const hotspotScore = Math.max(0, (t.hotspotC - 90) / 30);
  const voltageScore = Math.abs(t.voltagePu - 1) / 0.06;
  const max = Math.max(loadingScore, hotspotScore, voltageScore);
  if (max === loadingScore) return "loading";
  if (max === hotspotScore) return "hotspot";
  return "voltage";
}

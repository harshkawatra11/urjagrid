/** Heat color scales (C5): risk index, loading, hotspot, voltage, served fraction, outage. */
import { clamp } from "@/lib/format";

const HEAT_STEPS = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"] as const;

/** Maps a 0..1 fraction (0 = best) to one of the 5 sequential heat CSS vars. */
export function heatVar(fraction: number): string {
  const f = clamp(fraction, 0, 1);
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(f * HEAT_STEPS.length));
  return `var(${HEAT_STEPS[idx]})`;
}

export function heatVarEmpty(): string {
  return "var(--heat-empty)";
}

/** DT loading (pu of rating). 1.0 = rated, >1.3 = trip threshold. */
export function loadingHeat(loadingPu: number): string {
  return heatVar(clamp(loadingPu / 1.3, 0, 1));
}

/** Hotspot temperature in Celsius. 90C = healthy, 120C = alarm/limit. */
export function hotspotHeat(hotspotC: number): string {
  return heatVar(clamp((hotspotC - 90) / 30, 0, 1));
}

/** Risk index 0..1, already normalized, 1 = worst. */
export function riskHeat(riskIndex: number): string {
  return heatVar(riskIndex);
}

/** Voltage in per-unit. Best at 1.0, worst at V_MIN_PU=0.94 or V_MAX_PU=1.06. */
export function voltageHeat(voltagePu: number): string {
  const distance = Math.abs(voltagePu - 1.0);
  return heatVar(clamp(distance / 0.06, 0, 1));
}

/** Served fraction 0..1 of demand. 1 = fully served (best, inverted scale). */
export function servedHeat(servedFraction: number): string {
  return heatVar(clamp(1 - servedFraction, 0, 1));
}

/** Outage hours in a window; normalized against a worst-case ceiling (default 6h). */
export function outageHeat(outageHours: number, ceilingHours = 6): string {
  return heatVar(clamp(outageHours / ceilingHours, 0, 1));
}

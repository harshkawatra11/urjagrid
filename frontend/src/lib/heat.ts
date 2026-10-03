/**
 * Heat color scales (C5): risk index, loading, hotspot, voltage, served fraction, outage.
 *
 * Two distinct semantic shapes:
 *  - "low is good, high is bad" (risk/loading/hotspot/outage, and served-fraction inverted):
 *    a sequential scale that reads green -> yellow -> red via --heat-0..4 (heatVar).
 *  - "nominal is good, deviation either way is bad" (voltage): a genuine diverging scale,
 *    blue (under) <-> green (nominal) <-> red (over), via voltageHeat's color-mix.
 */
import { clamp } from "@/lib/format";

const HEAT_STEPS = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"] as const;

/** Maps a 0..1 fraction (0 = best) to one of the 5 sequential green->yellow->red heat CSS vars. */
export function heatVar(fraction: number): string {
  const f = clamp(fraction, 0, 1);
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(f * HEAT_STEPS.length));
  return `var(${HEAT_STEPS[idx]})`;
}

export function heatVarEmpty(): string {
  return "var(--heat-empty)";
}

/** DT loading (pu of rating). 1.0 = rated, >1.3 = trip threshold. Low (green) is good. */
export function loadingHeat(loadingPu: number): string {
  return heatVar(clamp(loadingPu / 1.3, 0, 1));
}

/** Hotspot temperature in Celsius. 90C = healthy, 120C = alarm/limit. Low (green) is good. */
export function hotspotHeat(hotspotC: number): string {
  return heatVar(clamp((hotspotC - 90) / 30, 0, 1));
}

/** Risk index 0..1, already normalized, 1 = worst. Low (green) is good. */
export function riskHeat(riskIndex: number): string {
  return heatVar(riskIndex);
}

/**
 * Voltage in per-unit. Best (nominal) at 1.0, worst at V_MIN_PU=0.94 or V_MAX_PU=1.06.
 * Unlike the single-direction scales above, deviation either way is bad but the *kind* of
 * badness differs (under- vs over-voltage), so this is a genuine diverging scale: nominal is
 * green, under-voltage fades toward blue, over-voltage fades toward red — not one hue in and out.
 */
export function voltageHeat(voltagePu: number): string {
  const diff = voltagePu - 1.0;
  const magnitudePct = clamp(Math.abs(diff) / 0.06, 0, 1) * 100;
  const pole = diff < 0 ? "var(--heat-volt-under)" : "var(--heat-volt-over)";
  return `color-mix(in srgb, ${pole} ${magnitudePct}%, var(--heat-volt-nominal) ${100 - magnitudePct}%)`;
}

/** Served fraction 0..1 of demand. 1 = fully served (best); inverted so high served = green. */
export function servedHeat(servedFraction: number): string {
  return heatVar(clamp(1 - servedFraction, 0, 1));
}

/** Outage hours in a window; normalized against a worst-case ceiling (default 6h). Low (green) is good. */
export function outageHeat(outageHours: number, ceilingHours = 6): string {
  return heatVar(clamp(outageHours / ceilingHours, 0, 1));
}

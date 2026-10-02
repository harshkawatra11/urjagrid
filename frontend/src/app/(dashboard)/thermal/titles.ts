import type { Transformer } from "@/lib/api/types";

/** Pure title/label functions for Transformer Health (D18). */

export function moneyshotTitle(tripsAvoided: number): string {
  return `${tripsAvoided} DT trips avoided vs the shadow baseline today`;
}

export function overloadedCount(transformers: Transformer[]): number {
  return transformers.filter((t) => t.loadingPu >= 1.0).length;
}

export function alarmCount(transformers: Transformer[]): number {
  return transformers.filter((t) => t.hotspotC >= 110).length;
}

export function tripRiskCount(transformers: Transformer[]): number {
  return transformers.filter((t) => t.loadingPu >= 1.3).length;
}

/** Deterministic hourly hot-spot trace derived from the DT's current hot-spot and loading
 * (evening-peak shape), used by ThermalTrace since no time-series fixture exists per DT. */
export function hourlyThermalTrace(t: Transformer): Array<{ x: string; hotspotC: number; loadingPu: number }> {
  return Array.from({ length: 12 }, (_, i) => {
    const hour = 12 + i; // 12:00 to 23:00
    const eveningFactor = 0.6 + 0.4 * Math.exp(-((hour - 19) ** 2) / 10);
    return {
      x: `${hour}:00`,
      hotspotC: Number((t.hotspotC * eveningFactor).toFixed(1)),
      loadingPu: Number((t.loadingPu * eveningFactor).toFixed(2)),
    };
  });
}

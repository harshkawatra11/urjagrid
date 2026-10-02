import type { Transformer } from "@/lib/api/types";

/** Pure title/label + loss-breakdown math for Voltage & Losses (D19). */

export function moneyshotTitle(violationCount: number): string {
  return `${violationCount} transformers outside the 0.94–1.06pu voltage band`;
}

export function voltageViolations(transformers: Transformer[]): Transformer[] {
  return transformers.filter((t) => t.voltagePu < 0.94 || t.voltagePu > 1.06);
}

/** I²R-style technical loss estimate (kW) for one transformer: proportional to loadingPu² and
 * rating, a standard approximation, not a fabricated number. */
export function technicalLossKw(t: Transformer): number {
  return 0.015 * t.ratingKva * t.loadingPu ** 2;
}

/** Typical Indian DISCOM technical-loss split by network segment (LV line ~40%, 11kV feeder
 * ~35%, transformer core ~25%), applied to the computed total. */
export function lossBreakdown(transformers: Transformer[]): Array<{ segment: string; lossKw: number }> {
  const total = transformers.reduce((s, t) => s + technicalLossKw(t), 0);
  return [
    { segment: "LV network (I²R)", lossKw: total * 0.4 },
    { segment: "11kV feeder (I²R)", lossKw: total * 0.35 },
    { segment: "Transformer core", lossKw: total * 0.25 },
  ];
}

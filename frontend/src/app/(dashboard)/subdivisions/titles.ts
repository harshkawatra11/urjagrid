import type { Subdivision } from "@/lib/api/types";

/** Pure title/label functions for the Sub-division Lab (D5) cards — no rendering, easy to unit test. */

export function moneyshotTitle(avgServedPct: number): string {
  return `${avgServedPct.toFixed(1)}% average served across 5 sub-divisions`;
}

export function worstSubdivisionHeadline(worst: Subdivision | undefined): string {
  if (!worst) return "No sub-division data available";
  return `${worst.name} is the highest-risk sub-division`;
}

export function comparisonMatrixTitle(count: number): string {
  return `Comparison matrix — ${count} sub-divisions`;
}

export function quadrantScatterTitle(): string {
  return "Risk vs served fraction (quadrant)";
}

export function calibrationBarsTitle(): string {
  return "CEEW outage-hour calibration (solution vs baseline)";
}

export function gainBarsTitle(): string {
  return "Served-fraction gain over baseline, ranked";
}

export function dailyRiskShapeTitle(): string {
  return "Illustrative daily risk shape by hour";
}

/** Deterministic hour-of-day risk multiplier derived from the sub-division's riskIndex — a
 * standard evening-peak load-shape heuristic, not random/fabricated data. */
export function hourlyRiskMultiplier(hour: number, riskIndex: number): number {
  const eveningPeak = Math.exp(-((hour - 19) ** 2) / 18);
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 10) * 0.5;
  const base = 0.25 + 0.75 * (eveningPeak + morningPeak);
  return Math.min(1, base * (0.5 + riskIndex));
}

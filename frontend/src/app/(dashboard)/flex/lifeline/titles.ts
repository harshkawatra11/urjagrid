/** D15 Lifeline and Fairness -- card action-titles computed from the loaded fairness metrics. */
import { formatPercent } from "@/lib/format";

export function fairnessHeadline(jainIndex: number): string {
  return `Jain fairness index ${jainIndex.toFixed(2)} -- ${jainIndex >= 0.9 ? "equitable" : jainIndex >= 0.75 ? "acceptable" : "uneven"} burden-sharing`;
}

export function lorenzTitle(giniCoefficient: number): string {
  return `Lorenz curve (Gini ${giniCoefficient.toFixed(2)})`;
}

export function capBreakdownTitle(cappedCount: number): string {
  return `Cap-level breakdown -- ${cappedCount} consumers capped`;
}

export function hesSuccessTitle(successRate: number): string {
  return `HES command success rate ${formatPercent(successRate)}`;
}

export function guardrailsTitle(passing: number, total: number): string {
  return `${passing}/${total} safety invariants holding`;
}

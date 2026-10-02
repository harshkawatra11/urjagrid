import type { FederationNode } from "@/lib/api/types";

/** Pure title/label functions for the Regulator View (D26). */

export function moneyshotTitle(nodes: FederationNode[]): string {
  if (nodes.length === 0) return "No federation data available";
  const avgReliability = nodes.reduce((s, n) => s + n.reliabilityIndex, 0) / nodes.length;
  return `${(avgReliability * 100).toFixed(1)}% average reliability index across both DISCOMs`;
}

export function totalConsumers(nodes: FederationNode[]): number {
  return nodes.reduce((s, n) => s + n.consumerCount, 0);
}

/** This UI must never expose consumer- or sub-division-level drill-down to the regulator role
 * (SPEC: "regulator -> aggregates only"). Pure so the enforcement is directly unit-testable
 * without rendering. */
export function canDrillDown(role: string | null): boolean {
  return role !== "regulator";
}

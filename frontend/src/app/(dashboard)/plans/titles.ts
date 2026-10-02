/** D3 Flex Plans decision desk -- card action-titles computed from the live plan list. */
import { formatKw, formatPercent } from "@/lib/format";

export function kanbanColumnTitle(label: string, count: number): string {
  return `${label} (${count})`;
}

export function whatIfTitle(planId: string | null): string {
  return planId ? `What-if -- ${planId}` : "What-if -- select a plan";
}

export function funnelTitle(totalPlans: number): string {
  return `Approval funnel (${totalPlans} plans)`;
}

export function approvalRateTitle(rate: number): string {
  return `${formatPercent(rate)} of proposed plans approved`;
}

export function deficitGanttTitle(windowCount: number): string {
  return `${windowCount} active deficit window${windowCount === 1 ? "" : "s"} by hour`;
}

export function decisionLogTitle(count: number): string {
  return `Decision log (${count})`;
}

export function kpiCoverageLabel(coveredKw: number, gapKw: number): string {
  return `${formatKw(coveredKw)} covered of ${formatKw(gapKw)} total gap`;
}

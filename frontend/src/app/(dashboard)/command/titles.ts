/**
 * D1 Grid Command Centre -- card action-titles computed from live data, not static strings
 * (SPEC section 8 recipe). Each function takes the minimal data it needs to phrase the title.
 */
import type { RiskLevel } from "@/lib/domain";
import { RISK_LEVEL_LABEL } from "@/lib/domain";
import { formatKw, formatNumber, formatPercent } from "@/lib/format";

export function situationHeadline(worstName: string, worstRisk: RiskLevel): string {
  if (worstRisk === "low") return `All ${worstName} and peer sub-divisions within normal limits`;
  return `${worstName} sub-division at ${RISK_LEVEL_LABEL[worstRisk].toLowerCase()} risk`;
}

export function moneyshotLabel(servedFraction: number): string {
  return `${formatPercent(servedFraction)} of demand served right now`;
}

export function mapCardTitle(dtAtRiskCount: number): string {
  return dtAtRiskCount === 0 ? "Live network map -- no transformers at risk" : `Live network map -- ${dtAtRiskCount} transformer${dtAtRiskCount === 1 ? "" : "s"} at risk`;
}

export function leagueTableTitle(subCount: number): string {
  return `Sub-division league table (${subCount})`;
}

export function heatmapTitle(): string {
  return "24h risk heatmap by sub-division";
}

export function supplyDemandTitle(dtName: string): string {
  return `Supply vs demand -- ${dtName}`;
}

export function pendingPlansTitle(count: number): string {
  return count === 0 ? "No Flex Plans awaiting approval" : `${count} Flex Plan${count === 1 ? "" : "s"} awaiting approval`;
}

export function leverStackTitle(gapKw: number): string {
  return `Lever mix covering ${formatKw(gapKw)} of active gap`;
}

export function criticalLoadsTitle(count: number): string {
  return `${count} critical facilit${count === 1 ? "y" : "ies"} never capped or shed`;
}

export function reliabilityGainTitle(hoursOfHelp: number): string {
  return `${formatNumber(hoursOfHelp, 0)} hours of help delivered this window`;
}

export function riskMixTitle(criticalCount: number): string {
  return criticalCount === 0 ? "Risk mix across the fleet" : `Risk mix -- ${criticalCount} DT${criticalCount === 1 ? "" : "s"} critical`;
}

export function eventsTitle(count: number): string {
  return `Live event feed (${count})`;
}

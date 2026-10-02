/** D8 Transformer case file -- card action-titles computed from the loaded transformer. */
import type { RiskLevel } from "@/lib/domain";
import { RISK_LEVEL_LABEL } from "@/lib/domain";
import { formatPercent } from "@/lib/format";

export function caseFileHeadline(name: string, riskLevel: RiskLevel): string {
  return `${name} -- ${RISK_LEVEL_LABEL[riskLevel]} risk`;
}

export function forecastTitle(hasForecast: boolean): string {
  return hasForecast ? "36h demand forecast (P10/P50/P90)" : "Forecast unavailable for this transformer";
}

export function loadingGaugeTitle(loadingPu: number): string {
  return `Loading -- ${(loadingPu * 100).toFixed(0)}% of rating`;
}

export function hotspotGaugeTitle(hotspotC: number): string {
  return `Hot-spot -- ${hotspotC.toFixed(1)} degC`;
}

export function meterWallTitle(consumerCount: number): string {
  return `Meter wall (${consumerCount} consumers)`;
}

export function sldTitle(dtName: string): string {
  return `Single-line diagram -- ${dtName}`;
}

export function thermalTraceTitle(): string {
  return "Thermal trace, derived from the current reading";
}

export function riskDriversTitle(count: number): string {
  return `${count} risk driver${count === 1 ? "" : "s"} flagged`;
}

export function whosHereTitle(consumerCount: number): string {
  return `Who's here -- ${consumerCount} consumers served`;
}

export function relatedPlansTitle(count: number): string {
  return count === 0 ? "No Flex Plans reference this transformer" : `${count} related Flex Plan${count === 1 ? "" : "s"}`;
}

export function servedFractionLabel(servedFraction: number): string {
  return `${formatPercent(servedFraction)} of demand served`;
}

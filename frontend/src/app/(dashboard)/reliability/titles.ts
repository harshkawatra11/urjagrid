/** D17 Reliability -- card action-titles computed from the loaded reliability metrics. */
import { formatNumber } from "@/lib/format";

export function reliabilityHeadline(hoursOfHelp: number): string {
  return `${formatNumber(hoursOfHelp, 0)} hours of help delivered this window`;
}

export function trendTitle(dtName: string): string {
  return `Supply vs demand trend -- ${dtName} (reference transformer)`;
}

export function calibrationTitle(): string {
  return "CEEW calibration -- firm-share assumptions by sub-division kind";
}

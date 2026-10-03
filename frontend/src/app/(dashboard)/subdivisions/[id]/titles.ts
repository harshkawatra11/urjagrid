import type { Subdivision } from "@/lib/api/types";

/** Pure title/label functions for the Sub-division deep-dive + printable scorecard (D6). */

export function scorecardTitle(s: Subdivision | undefined): string {
  return s ? `${s.name} scorecard` : "Sub-division scorecard";
}

export function headlineFor(s: Subdivision | undefined): string {
  if (!s) return "Sub-division not found";
  return `${s.name} (${s.town}, ${s.discom}) — ${s.riskLevel} risk`;
}

export function feederBreakdownTitle(count: number): string {
  return `${count} feeders in this sub-division`;
}

export function printFooterNote(s: Subdivision | undefined, generatedIso: string): string {
  return `${s?.id ?? "unknown"} · generated ${generatedIso} · UrjaGrid A4 scorecard`;
}

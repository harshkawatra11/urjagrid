/** D22 Scenario Lab -- card action-titles computed from the selected preset / run result. */
import type { ScenarioRunResult } from "@/lib/api/types";

export function presetCardTitle(name: string, running: boolean): string {
  return running ? `Running ${name}...` : name;
}

export function resultTitle(result: ScenarioRunResult | null): string {
  if (!result) return "National-impact matrix -- run a scenario";
  return `National-impact matrix -- ${result.scenarioName} (${result.nIntervals} intervals)`;
}

export function reliefHeadline(result: ScenarioRunResult | null): string {
  if (!result) return "Run a scenario to see relief delivered";
  return `${result.diff.reliefKwAvoided.toFixed(0)} kW of shedding avoided vs. the shadow baseline`;
}

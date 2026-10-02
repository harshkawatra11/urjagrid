import type { ForecastBacktest } from "@/lib/api/types";

/** Pure title/label functions for the Forecast Studio (D16). */

export function moneyshotTitle(backtest: ForecastBacktest | null | undefined): string {
  if (!backtest) return "Backtest not available";
  return `${backtest.wapePct.toFixed(1)}% WAPE, skill score ${backtest.skillScore.toFixed(2)}`;
}

export function coverageStatus(backtest: ForecastBacktest | null | undefined): "on-target" | "under" | "over" {
  if (!backtest) return "on-target";
  const diff = backtest.coveragePct - backtest.targetCoveragePct;
  if (Math.abs(diff) < 2) return "on-target";
  return diff < 0 ? "under" : "over";
}

export function importanceTitle(count: number): string {
  return `${count} forecast features ranked by importance`;
}

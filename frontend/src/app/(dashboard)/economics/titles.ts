import type { EconomicsAssumptions } from "@/lib/api/types";

/** Pure title/label + recompute functions for the Economics page (D24) sliders. */

export function moneyshotTitle(paybackMonths: number, bcr: number): string {
  return `${paybackMonths.toFixed(1)}-month payback, ${bcr.toFixed(1)}x benefit-cost ratio`;
}

export interface EconomicsInputs {
  assumptions: EconomicsAssumptions;
  nMeters: number;
  monthlyDrKwhShifted: number;
  monthlyAvoidedSheddingKwh: number;
}

export interface EconomicsOutputs {
  monthlyFeeRs: number;
  annualSavingsRs: number;
  paybackMonths: number;
  bcr: number;
}

/**
 * Illustrative unit-economics recompute, mirroring the shape of Lane B's `unit_economics` (B10)
 * closely enough for an interactive what-if slider panel: monthly software fee vs. avoided-cost
 * savings (energy value of avoided shedding, minus DR rebate payouts, plus a share of avoided DT
 * failure / deferred-upgrade cost). Pure and deterministic so the sliders are directly testable.
 */
export function recomputeEconomics(inputs: EconomicsInputs): EconomicsOutputs {
  const { assumptions: a, nMeters, monthlyDrKwhShifted, monthlyAvoidedSheddingKwh } = inputs;
  const monthlyFeeRs = a.monthlyFeeRsPerMeter * nMeters;
  const monthlyRebateCostRs = a.rebateRsPerKwh * monthlyDrKwhShifted;
  const monthlyAvoidedEnergyValueRs = a.energyValueRsPerKwh * monthlyAvoidedSheddingKwh;
  const annualSavingsRs =
    12 * (monthlyAvoidedEnergyValueRs - monthlyRebateCostRs) + a.dtFailureCostRs * 0.1 + a.deferredUpgradeCostRs * 0.05;
  const annualFeeRs = monthlyFeeRs * 12;
  const bcr = annualFeeRs > 0 ? annualSavingsRs / annualFeeRs : 0;
  const paybackMonths = annualSavingsRs > 0 ? (annualFeeRs / annualSavingsRs) * 12 : Infinity;
  return { monthlyFeeRs, annualSavingsRs, paybackMonths, bcr };
}

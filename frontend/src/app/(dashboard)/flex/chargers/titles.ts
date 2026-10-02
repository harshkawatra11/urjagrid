import type { ChargerStatus } from "@/lib/api/types";

/** Pure title/label functions for Managed Charging / OCPP (D12). */

export function fleetTitle(count: number): string {
  return `${count} chargers under OCPP SetChargingProfile control`;
}

export function moneyshotTitle(avgCurtailmentPct: number): string {
  return `${avgCurtailmentPct.toFixed(0)}% average curtailment across the charger fleet`;
}

export function statusCounts(chargers: ChargerStatus[]): Record<ChargerStatus["status"], number> {
  return chargers.reduce<Record<ChargerStatus["status"], number>>(
    (acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }),
    { online: 0, charging: 0, curtailed: 0, offline: 0 },
  );
}

export function kwRecovered(chargers: ChargerStatus[]): number {
  return chargers.reduce((s, c) => s + c.curtailmentFraction * c.ratedKw, 0);
}

import type { CriticalFacility } from "@/lib/api/types";

/** Pure title/label functions for the Critical Loads registry (D20). */

export function registryTitle(count: number): string {
  return `${count} T0 critical facilities and life-support homes`;
}

export function moneyshotTitle(backupPct: number): string {
  return `${backupPct.toFixed(0)}% of critical loads have verified backup power`;
}

export function backupCoveragePct(facilities: CriticalFacility[]): number {
  if (facilities.length === 0) return 0;
  return (facilities.filter((f) => f.backupAvailable).length / facilities.length) * 100;
}

export const KIND_LABEL: Record<CriticalFacility["kind"], string> = {
  hospital: "Hospital / PHC",
  water: "Water pumping",
  telecom: "Telecom tower",
  life_support: "Life-support home",
};

export function countsByKind(facilities: CriticalFacility[]): Record<CriticalFacility["kind"], number> {
  return facilities.reduce<Record<CriticalFacility["kind"], number>>(
    (acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }),
    { hospital: 0, water: 0, telecom: 0, life_support: 0 },
  );
}

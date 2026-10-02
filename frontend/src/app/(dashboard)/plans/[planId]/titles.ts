/** D4 Flex Plan case file -- card action-titles computed from the loaded plan. */
import type { PlanStatus } from "@/lib/domain";
import { PLAN_STATUS_LABEL } from "@/lib/domain";
import { formatKw } from "@/lib/format";

export function caseFileHeadline(planId: string, status: PlanStatus): string {
  return `${planId} -- ${PLAN_STATUS_LABEL[status]}`;
}

export function waterfallTitle(gapKw: number): string {
  return `Lever waterfall against a ${formatKw(gapKw)} gap`;
}

export function optionsTitle(count: number): string {
  return `${count} candidate option${count === 1 ? "" : "s"} considered`;
}

export function transformerActionsTitle(count: number): string {
  return `Actions on ${count} transformer${count === 1 ? "" : "s"}`;
}

export function sensitivityTitle(lever: string): string {
  return `Sensitivity -- ${lever} relief vs. gap growth`;
}

export function dispatchTitle(status: PlanStatus): string {
  return `Dispatch timeline -- currently ${PLAN_STATUS_LABEL[status].toLowerCase()}`;
}

export function verificationTitle(coveragePct: number): string {
  return `Verification -- ${coveragePct.toFixed(0)}% of gap covered`;
}

export function noticesTitle(householdCount: number): string {
  return householdCount === 0 ? "No behavioural-DR notices for this plan" : `Notices sent to ${householdCount} households`;
}

export function protocolLogTitle(count: number): string {
  return `Protocol ledger (${count} messages)`;
}

import type { AuditLogEntry } from "@/lib/api/types";

/** Pure title/label functions for Analytics/governance (D23). */

export function moneyshotTitle(actionsToday: number): string {
  return `${actionsToday} audited actions logged`;
}

export function auditTitle(count: number): string {
  return `${count} audit log entries`;
}

export function actionCounts(entries: AuditLogEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.action]: (acc[e.action] ?? 0) + 1 }), {});
}

export function roleCounts(entries: AuditLogEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.actorRole]: (acc[e.actorRole] ?? 0) + 1 }), {});
}

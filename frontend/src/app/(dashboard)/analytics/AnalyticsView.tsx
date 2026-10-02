"use client";

import { useAuditLog, useRoleMatrix, useUsageStats } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { CompareBars } from "@/components/charts/CompareBars";
import { EventTimeline } from "@/components/grid/EventTimeline";
import { heatVar } from "@/lib/heat";
import { formatIstDateTime } from "@/lib/format";
import { actionCounts, auditTitle, moneyshotTitle, roleCounts } from "./titles";

const PERMISSION_COLUMNS = [
  { key: "canApprovePlans", label: "Approve plans" },
  { key: "canEditScenario", label: "Edit scenario" },
  { key: "canViewConsumerData", label: "Consumer data" },
  { key: "canDispatch", label: "Dispatch" },
  { key: "canSeeRegulatorAggregates", label: "Regulator aggregates" },
] as const;

export function AnalyticsView() {
  const { data: auditData, isLoading, offline } = useAuditLog();
  const { data: roleData } = useRoleMatrix();
  const { data: usageData } = useUsageStats();
  const entries = auditData?.entries ?? [];
  const roles = roleData?.roles ?? [];
  const stats = usageData?.stats ?? [];

  if (isLoading && entries.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Analytics" description="Audit log, role/permission matrix, and usage stats." />
        <PanelSkeleton />
      </div>
    );
  }

  const actions = actionCounts(entries);
  const byRole = roleCounts(entries);
  const actionRows = Object.entries(actions).map(([label, solution]) => ({ label, solution, baseline: 0 }));
  const events = entries.map((e) => ({
    id: e.id,
    timestampIso: e.timestampIso,
    kind: e.action,
    subdivisionId: null,
    dtId: null,
    planId: null,
    message: `${e.actorName} (${e.actorRole}) ${e.action} ${e.targetType} ${e.targetId}`,
  }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Insights" title="Analytics" description="Every mutation is audited (B6); roles are gated by a fixed permission matrix." />
      </div>

      <Card title="Audited actions" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{entries.length}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(entries.length)}</p>
      </Card>

      {stats.slice(0, 4).map((s) => (
        <Card key={s.metric} title={s.metric} eyebrow="Usage" className="col-span-6 lg:col-span-2">
          <p className="num text-[20px] font-semibold text-text">
            {s.value} <span className="text-[11px] text-faint">{s.unit}</span>
          </p>
        </Card>
      ))}

      <Card title="Actions by type" eyebrow="Chart" className="col-span-12 lg:col-span-6">
        <CompareBars rows={actionRows} unit="" />
      </Card>

      <Card title="Actions by role" eyebrow="Breakdown" className="col-span-12 lg:col-span-6">
        <ul className="space-y-2">
          {Object.entries(byRole).map(([role, count]) => (
            <li key={role} className="flex items-center gap-2 text-[12px]">
              <span className="w-20 shrink-0 capitalize text-text">{role}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${(count / Math.max(1, entries.length)) * 100}%` }} />
              </div>
              <span className="num w-8 text-right text-faint">{count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Role / permission matrix" eyebrow="Governance" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Role</th>
              {PERMISSION_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-1 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.role}>
                <td className="px-2 py-1.5 font-medium capitalize text-text">{r.role}</td>
                {PERMISSION_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-center">
                    <span
                      aria-label={r[c.key] ? "allowed" : "denied"}
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: r[c.key] ? heatVar(0) : heatVar(1) }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={auditTitle(entries.length)} eyebrow="Log" className="col-span-12">
        <EventTimeline events={events} />
        {entries[0] && <p className="mt-2 text-[11px] text-faint">Most recent: {formatIstDateTime(entries[0].timestampIso)}</p>}
      </Card>
    </div>
  );
}

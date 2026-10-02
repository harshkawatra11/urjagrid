"use client";

import { useScope } from "@/lib/scope";
import { useCriticalFacilities } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { StatusTag } from "@/components/ds/StatusTag";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { CompareBars } from "@/components/charts/CompareBars";
import { SUBDIVISION_IDS, SUBDIVISION_LABEL } from "@/lib/scope";
import { backupCoveragePct, countsByKind, KIND_LABEL, moneyshotTitle, registryTitle } from "./titles";
import type { CriticalFacility } from "@/lib/api/types";

const KINDS: readonly CriticalFacility["kind"][] = ["hospital", "water", "telecom", "life_support"];

export function CriticalView() {
  const { scope } = useScope();
  const { data, isLoading, offline } = useCriticalFacilities(scope);
  const facilities = data?.facilities ?? [];

  if (isLoading && facilities.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Network" title="Critical Loads" description="T0 facilities and life-support homes: never capped, asked, or shed." />
        <PanelSkeleton />
      </div>
    );
  }

  const coverage = backupCoveragePct(facilities);
  const counts = countsByKind(facilities);
  const kindBackupRows = KINDS.map((k) => {
    const rows = facilities.filter((f) => f.kind === k);
    const withBackup = rows.filter((f) => f.backupAvailable).length;
    return { label: KIND_LABEL[k], solution: withBackup, baseline: rows.length - withBackup };
  });

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader
          eyebrow="Network"
          title="Critical Loads"
          description="T0 tier: never capped, never asked for DR, never shed — hospitals, water pumping, telecom towers, and registered life-support homes."
          actions={<StatusTag status="LIVE" title="Enforced by the GridWorld critical-facility backup logic and the B7 safety-invariant test suite." />}
        />
      </div>

      <Card title="Backup coverage" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <GaugeArc value={coverage} max={100} valueLabel={`${coverage.toFixed(0)}%`} label="Backup coverage gauge" />
        <p className="mt-2 text-[12px] text-muted">{moneyshotTitle(coverage)}</p>
      </Card>

      {KINDS.map((k) => (
        <Card key={k} title={KIND_LABEL[k]} eyebrow="Count" className="col-span-6 lg:col-span-2">
          <p className="num text-[22px] font-semibold text-text">{counts[k]}</p>
        </Card>
      ))}

      <Card title="Backup status by category" eyebrow="With vs without backup" className="col-span-12 lg:col-span-6">
        <CompareBars rows={kindBackupRows} unit="" label="Backup availability" />
      </Card>

      <Card title="Coverage matrix" eyebrow="Sub-division x category" className="col-span-12 lg:col-span-6">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Sub-division</th>
              {KINDS.map((k) => (
                <th key={k} className="px-2 py-1 text-right">
                  {KIND_LABEL[k].split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUBDIVISION_IDS.map((sd) => (
              <tr key={sd}>
                <td className="px-2 py-1.5 text-text">{SUBDIVISION_LABEL[sd]}</td>
                {KINDS.map((k) => {
                  const rows = facilities.filter((f) => f.subdivisionId === sd && f.kind === k);
                  const withBackup = rows.filter((f) => f.backupAvailable).length;
                  return (
                    <td key={k} className="num px-2 py-1.5 text-right">
                      {rows.length > 0 ? `${withBackup}/${rows.length}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={registryTitle(facilities.length)} eyebrow="Registry" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Category</th>
              <th className="px-2 py-1">Sub-division</th>
              <th className="px-2 py-1">DT</th>
              <th className="px-2 py-1">Backup</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr key={f.id}>
                <td className="px-2 py-1.5 text-text">{f.name}</td>
                <td className="px-2 py-1.5 text-muted">{KIND_LABEL[f.kind]}</td>
                <td className="px-2 py-1.5 text-muted">{SUBDIVISION_LABEL[f.subdivisionId]}</td>
                <td className="num px-2 py-1.5 text-muted">{f.dtId}</td>
                <td className="px-2 py-1.5">
                  <span className={f.backupAvailable ? "text-green" : "text-red"}>{f.backupAvailable ? "Yes" : "No"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

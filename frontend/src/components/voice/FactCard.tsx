import Link from "next/link";
import type { ReactNode } from "react";
import { PlanStatusChip, LeverChip } from "@/components/ds/chips";
import { RISK_LEVEL_COLOR_VAR, RISK_LEVEL_LABEL, RISK_LEVELS, cssVar } from "@/lib/domain";
import { formatKw, formatNumber, formatPercent } from "@/lib/format";
import type { FactCard as FactCardData } from "@/lib/voice/protocol";

function Shell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      data-testid="fact-card"
      aria-label={label}
      className="rounded-md border border-border bg-surface-2 p-3 text-[12px] shadow-[var(--inset-highlight)]"
    >
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </section>
  );
}

const linkCls = "text-text underline-offset-2 hover:text-brand hover:underline";

/** Rewrites the reference project's healthcare fact cards as UrjaGrid's 12 grid-domain cards. */
export function FactCard({ card }: { card: FactCardData }) {
  switch (card.type) {
    case "circle_summary":
      return (
        <Shell label="Circle summary">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-text">{card.discom === "all" ? "All DISCOMs" : card.discom}</span>
            <span className="text-muted">
              {card.subdivisionCount} sub-division{card.subdivisionCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RISK_LEVELS.map((level) => {
              const n = card.riskCounts[level];
              return n ? (
                <span key={level} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: cssVar(RISK_LEVEL_COLOR_VAR[level]) }}
                  />
                  <span className="num text-muted">
                    {n} {RISK_LEVEL_LABEL[level]}
                  </span>
                </span>
              ) : null;
            })}
          </div>
          <p className="mt-2 text-muted">
            Served fraction <span className="num text-text">{formatPercent(card.servedFraction)}</span>
          </p>
        </Shell>
      );

    case "subdivision":
      return (
        <Shell label="Sub-division">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/subdivisions/${card.id}`} className={`${linkCls} text-[13px] font-semibold`}>
              {card.name}
            </Link>
            <span className="num text-muted">risk {formatNumber(card.riskIndex * 100)}</span>
          </div>
          <p className="mt-1 text-muted">
            Served <span className="num text-text">{formatPercent(card.servedFraction)}</span> ·{" "}
            {card.activePlanCount} active plan{card.activePlanCount === 1 ? "" : "s"}
          </p>
        </Shell>
      );

    case "transformer":
      return (
        <Shell label="Transformer">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/transformers/${card.id}`} className={`${linkCls} text-[13px] font-semibold`}>
              {card.name}
            </Link>
            <span style={{ color: cssVar(RISK_LEVEL_COLOR_VAR[card.riskLevel]) }}>{RISK_LEVEL_LABEL[card.riskLevel]}</span>
          </div>
          <p className="mt-1 text-muted">
            Loading <span className="num text-text">{card.loadingPu.toFixed(2)} pu</span> · Hot-spot{" "}
            <span className="num text-text">{card.hotspotC.toFixed(1)}°C</span>
          </p>
        </Shell>
      );

    case "deficits":
      return (
        <Shell label="Deficit windows">
          {card.rows.length === 0 ? (
            <p className="text-muted">No deficit windows found.</p>
          ) : (
            <ul className="space-y-1">
              {card.rows.map((r) => (
                <li key={r.dtId} className="flex items-center justify-between gap-2">
                  <Link href={`/transformers/${r.dtId}`} className={linkCls}>
                    {r.dtName}
                  </Link>
                  <span className="num text-text">{formatKw(r.gapKw)}</span>
                </li>
              ))}
            </ul>
          )}
        </Shell>
      );

    case "ranking": {
      const max = Math.max(...card.rows.map((r) => Math.abs(r.value)), 0);
      return (
        <Shell label={`Ranking: ${card.metric.replace(/_/g, " ")}`}>
          <ul className="space-y-1.5">
            {card.rows.map((r) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-text">{r.name}</span>
                  <span className="num text-text">
                    {Number.isInteger(r.value) ? formatNumber(r.value) : r.value.toFixed(1)}
                    {card.unit && <span className="ml-1 text-muted">{card.unit}</span>}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${max > 0 ? Math.max(4, (Math.abs(r.value) / max) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Shell>
      );
    }

    case "plans":
      return (
        <Shell label="Flex Plans">
          {card.rows.length === 0 ? (
            <p className="text-muted">No plans found.</p>
          ) : (
            <ul className="space-y-1.5">
              {card.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/plans/${r.id}`} className={`${linkCls} num`}>
                      {r.id}
                    </Link>
                    <p className="truncate text-[11px] text-muted">{r.subdivisionName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <PlanStatusChip status={r.status} size="sm" />
                    <span className="num text-[11px] text-muted">
                      {formatKw(r.coveredKw)} / {formatKw(r.gapKw)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Shell>
      );

    case "plan":
      return (
        <Shell label="Flex Plan">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/plans/${card.id}`} className={`${linkCls} num text-[13px] font-semibold`}>
              {card.id}
            </Link>
            <PlanStatusChip status={card.status} size="sm" />
          </div>
          <p className="mt-1 text-muted">
            {formatKw(card.coveredKw)} covered of {formatKw(card.gapKw)} gap
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.levers.map((l) => (
              <span key={l.lever} className="inline-flex items-center gap-1">
                <LeverChip lever={l.lever} size="sm" />
                <span className="num text-muted">{formatKw(l.reliefKw)}</span>
              </span>
            ))}
          </div>
        </Shell>
      );

    case "levers":
      return (
        <Shell label="Levers">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] text-muted">
                <th className="py-0.5 font-medium">Lever</th>
                <th className="py-0.5 text-right font-medium">Relief</th>
                <th className="py-0.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.map((r) => (
                <tr key={r.lever} className="border-t border-border">
                  <td className="py-1 pr-2">
                    <LeverChip lever={r.lever} size="sm" />
                  </td>
                  <td className="num py-1 text-right">{formatKw(r.reliefKw)}</td>
                  <td className="num py-1 text-right">₹{formatNumber(r.costRs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Shell>
      );

    case "critical":
      return (
        <Shell label="Critical loads">
          {card.rows.length === 0 ? (
            <p className="text-muted">No critical facilities found.</p>
          ) : (
            <ul className="space-y-1">
              {card.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-text">{r.name}</span>
                  <span className="text-muted">{r.backupAvailable ? "Backup OK" : "No backup"}</span>
                </li>
              ))}
            </ul>
          )}
        </Shell>
      );

    case "reliability":
      return (
        <Shell label="Reliability">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="eyebrow">SAIDI</dt>
              <dd className="num text-[14px] text-text">{card.saidiMinutes.toFixed(0)} min</dd>
            </div>
            <div>
              <dt className="eyebrow">SAIFI</dt>
              <dd className="num text-[14px] text-text">{card.saifiCount.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Lifeline</dt>
              <dd className="num text-[14px] text-text">{card.lifelineAvailabilityPct.toFixed(1)}%</dd>
            </div>
          </dl>
        </Shell>
      );

    case "forecast":
      return (
        <Shell label="Forecast">
          <p className="text-text">{card.dtName}</p>
          <p className="mt-1 text-muted">
            Next hour <span className="num text-text">{formatKw(card.p50NextHourKw)}</span>
            {card.gapKw !== null && (
              <>
                {" "}
                · gap <span className="num text-red">{formatKw(card.gapKw)}</span>
              </>
            )}
          </p>
        </Shell>
      );

    case "fairness":
      return (
        <Shell label="Fairness">
          <p className="text-muted">
            Jain index <span className="num text-text">{card.jainIndex.toFixed(3)}</span> · Gini{" "}
            <span className="num text-text">{card.giniCoefficient.toFixed(3)}</span>
          </p>
        </Shell>
      );
  }
}

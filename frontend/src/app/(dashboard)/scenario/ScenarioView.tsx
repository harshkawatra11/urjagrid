"use client";

import { useState } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusTag } from "@/components/ds/StatusTag";
import { CompareBars, type CompareBarRow } from "@/components/charts/CompareBars";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { runScenario } from "@/lib/api/mutations";
import { heatVar } from "@/lib/heat";
import { formatIstTime } from "@/lib/format";
import type { ScenarioRunResult } from "@/lib/api/types";
import { presetCardTitle, reliefHeadline, resultTitle } from "./titles";

const PRESETS: { name: string; label: string; description: string }[] = [
  { name: "heatwave_evening", label: "Heatwave evening", description: "Peak AC load meets evening ramp-down of solar; the hardest deficit case." },
  { name: "monsoon_cloud", label: "Monsoon cloud cover", description: "Overcast skies cut solar generation through the day." },
  { name: "solar_noon", label: "Solar noon", description: "Midday rooftop solar at its peak, the easiest supply case." },
  { name: "re_2047", label: "RE 2047", description: "India's 2047 renewable-heavy supply mix, higher storage and RE share." },
];

type RunLogRow = { name: string; atIso: string; offline: boolean; ok: boolean };

export function ScenarioView() {
  const [runningName, setRunningName] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioRunResult | null>(null);
  const [offline, setOffline] = useState(false);
  const [log, setLog] = useState<RunLogRow[]>([]);

  async function handleRun(name: string) {
    setRunningName(name);
    const outcome = await runScenario(name);
    setRunningName(null);
    const atIso = new Date().toISOString();
    if (outcome.ok) {
      setResult(outcome.result);
      setOffline(outcome.offline);
      setLog((prev) => [{ name, atIso, offline: outcome.offline, ok: true }, ...prev].slice(0, 8));
    } else {
      setLog((prev) => [{ name, atIso, offline: false, ok: false }, ...prev].slice(0, 8));
    }
  }

  const compareRows: CompareBarRow[] = result
    ? [
        { label: "Served kW", solution: result.solution.totalServedKw, baseline: result.shadowBaseline.totalServedKw },
        { label: "Unserved kW", solution: result.solution.totalUnservedKw, baseline: result.shadowBaseline.totalUnservedKw },
        { label: "Hardship hours", solution: result.solution.hoursOfHardship, baseline: result.shadowBaseline.hoursOfHardship },
      ]
    : [];

  const reliefFraction = result && result.shadowBaseline.totalUnservedKw > 0 ? Math.min(1, result.diff.reliefKwAvoided / result.shadowBaseline.totalUnservedKw) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Flex Plans"
        title="Scenario Lab"
        description="Run a built-in weather/supply scenario end-to-end and diff the LifelineGrid solution against the shadow (status-quo) baseline."
        actions={<StatusTag status="LIVE" title="Runs the real GridService + optimiser for n_intervals, not a canned replay" />}
      />

      <Card className="mb-3" title="Moneyshot">
        <p className="num text-[28px] font-semibold leading-none text-text">{reliefHeadline(result)}</p>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESETS.map((p) => (
          <Card key={p.name} title={presetCardTitle(p.label, runningName === p.name)}>
            <p className="mb-3 text-[12px] text-muted">{p.description}</p>
            <button
              type="button"
              disabled={runningName !== null}
              onClick={() => handleRun(p.name)}
              className="h-8 w-full rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40"
            >
              {runningName === p.name ? "Running..." : "Run scenario"}
            </button>
          </Card>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-5" title="Solution vs shadow baseline">
          {result ? <CompareBars rows={compareRows} /> : <p className="text-[12px] text-faint">Run a preset above to see the comparison.</p>}
        </Card>
        <Card className="col-span-12 lg:col-span-3" title="Relief delivered vs. baseline's unserved energy">
          <div className="flex justify-center">
            <GaugeArc value={reliefFraction} max={1} valueLabel={`${(reliefFraction * 100).toFixed(0)}%`} label="Relief fraction" />
          </div>
        </Card>
        <Card className="col-span-12 lg:col-span-4" title={resultTitle(result)}>
          {result ? (
            <table className="w-full text-[11px]" role="grid" aria-label="National-impact matrix">
              <thead>
                <tr className="text-left text-faint">
                  <th className="py-1">Metric</th>
                  <th className="py-1 text-center">Solution</th>
                  <th className="py-1 text-center">Baseline</th>
                  <th className="py-1 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Served kW", result.solution.totalServedKw, result.shadowBaseline.totalServedKw],
                  ["Unserved kW", result.solution.totalUnservedKw, result.shadowBaseline.totalUnservedKw],
                  ["Hardship h", result.solution.hoursOfHardship, result.shadowBaseline.hoursOfHardship],
                ] as const).map(([label, sol, base]) => (
                  <tr key={label} className="border-t border-border">
                    <td className="py-1.5 text-text">{label}</td>
                    <td className="num py-1.5 text-center">{sol.toFixed(1)}</td>
                    <td className="num py-1.5 text-center">{base.toFixed(1)}</td>
                    <td className="py-1.5 text-center">
                      <span
                        className="num inline-block w-14 rounded-sm px-1.5 py-0.5 text-text"
                        style={{ background: heatVar(base > 0 ? Math.min(1, Math.abs(sol - base) / base) : 0) }}
                      >
                        {(sol - base).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[12px] text-faint">No scenario run yet.</p>
          )}
          {offline && result && <p className="mt-2 text-[11px] text-faint">Backend unreachable -- showing the committed fixture for this scenario.</p>}
        </Card>
      </div>

      <Card title={`Run log (${log.length})`}>
        {log.length === 0 ? (
          <p className="text-[12px] text-faint">No runs yet this session.</p>
        ) : (
          <ol className="space-y-1.5 text-[12px]">
            {log.map((row, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-text">{row.name}</span>
                <span className="num text-faint">
                  {formatIstTime(row.atIso)} -- {row.ok ? (row.offline ? "offline fixture" : "live") : "failed"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

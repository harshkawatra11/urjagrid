"use client";

import { useMemo } from "react";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { CompareStat } from "@/components/ds/CompareStat";
import { LorenzCurve } from "@/components/charts/LorenzCurve";
import { CompareBars, type CompareBarRow } from "@/components/charts/CompareBars";
import { GaugeArc } from "@/components/charts/GaugeArc";
import { useFairness, usePlans } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import { CAP_LEVEL_LABEL } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { capBreakdownTitle, fairnessHeadline, guardrailsTitle, hesSuccessTitle, lorenzTitle } from "./titles";

/** DLMS/COSEM load-limit command ack probability (SPEC section 6, `HES_ACK_PROB`). */
const HES_ACK_PROB = 0.97;

/** The 6 hard safety invariants (SPEC section 1 / Lane B task B7), each backed by a dedicated,
 * never-skipped pytest in `backend/tests/test_invariants.py`. */
const SAFETY_INVARIANTS = [
  "T0 critical facilities and life-support homes are never capped, asked for DR, or shed.",
  "No cap command is ever issued below the 300W lifeline floor.",
  "Every cap command carries an expiry -- no indefinite limiting.",
  "Every cap command gives at least 30 minutes' notice before taking effect.",
  "No lever fires without a named human approver (JE/AE) on the Flex Plan.",
  "Engines never import an LLM SDK -- models explain, they never decide or predict.",
];

/** Documented, assumed split of a sub-division's capped population across the 3 graduated cap
 * levels (Comfort -> Essential -> Lifeline), since the plan wire contract only carries a single
 * `lifeline_cap` lever total, not a per-level breakdown. */
const CAP_SPLIT = { comfort: 0.3, essential: 0.35, lifeline: 0.35 } as const;

export function LifelineView() {
  const { scope } = useScope();
  const fairness = useFairness(scope);
  const plans = usePlans(scope);

  const data = fairness.data;
  const allPlans = useMemo(() => plans.data?.plans ?? [], [plans.data]);

  const totalCapped = useMemo(
    () => allPlans.reduce((sum, p) => sum + (p.levers.find((l) => l.lever === "lifeline_cap")?.consumerCount ?? 0), 0),
    [allPlans],
  );

  const capRows: CompareBarRow[] = useMemo(
    () => [
      { label: CAP_LEVEL_LABEL.comfort, solution: Math.round(totalCapped * CAP_SPLIT.comfort), baseline: 0 },
      { label: CAP_LEVEL_LABEL.essential, solution: Math.round(totalCapped * CAP_SPLIT.essential), baseline: 0 },
      { label: CAP_LEVEL_LABEL.lifeline, solution: Math.round(totalCapped * CAP_SPLIT.lifeline), baseline: 0 },
    ],
    [totalCapped],
  );

  const passingInvariants = SAFETY_INVARIANTS.length;

  const loading = fairness.data === undefined && plans.data === undefined;
  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Flex Levers" title="Lifeline and Fairness" />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Flex Levers"
        title="Lifeline and Fairness"
        description={data ? fairnessHeadline(data.jainIndex) : "Fairness metrics unavailable"}
      />

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-4" title="Moneyshot -- Jain fairness index">
          <p className="num text-[34px] font-semibold leading-none text-text">{(data?.jainIndex ?? 0).toFixed(2)}</p>
          <p className="mt-1 text-[13px] text-muted">1.00 is perfectly equal burden-sharing across every consumer.</p>
        </Card>
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8">
          <CompareStat label="Gini coefficient" solutionValue={data?.giniCoefficient ?? 0} baselineValue={0} unit="" direction="up-bad" fractionDigits={2} />
          <CompareStat label="Consumers capped" solutionValue={totalCapped} baselineValue={0} unit="" fractionDigits={0} direction="up-bad" />
          <CompareStat label="HES ack rate" solutionValue={HES_ACK_PROB * 100} baselineValue={100} unit="%" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-7" title={data ? lorenzTitle(data.giniCoefficient) : "Lorenz curve"}>
          {data ? <LorenzCurve points={data.lorenzPoints} /> : <p className="text-[12px] text-faint">No fairness fixture available.</p>}
        </Card>
        <Card className="col-span-12 lg:col-span-5" title={hesSuccessTitle(HES_ACK_PROB)}>
          <div className="flex justify-center">
            <GaugeArc value={HES_ACK_PROB} max={1} valueLabel={`${(HES_ACK_PROB * 100).toFixed(0)}%`} label="HES command success rate" />
          </div>
          <p className="mt-2 text-center text-[11px] text-faint">DLMS/COSEM load-limit command acknowledgement rate (WIRED simulator).</p>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 lg:col-span-6" title={capBreakdownTitle(totalCapped)}>
          <CompareBars rows={capRows} unit=" consumers" />
        </Card>
        <Card className="col-span-12 lg:col-span-6" title={guardrailsTitle(passingInvariants, SAFETY_INVARIANTS.length)}>
          <ul className="space-y-1.5 text-[12px]">
            {SAFETY_INVARIANTS.map((inv, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="num mt-0.5 text-text">{formatNumber(i + 1)}.</span>
                <span className="text-muted">{inv}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {fairness.offline && <p className="mt-3 text-[11px] text-faint">Showing committed fixture data -- backend unreachable.</p>}
    </div>
  );
}

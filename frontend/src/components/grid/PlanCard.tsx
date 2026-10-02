import Link from "next/link";
import { PlanStatusChip } from "@/components/ds/chips";
import { formatIstDateTime, formatKw } from "@/lib/format";
import { SUBDIVISION_LABEL, isSubdivisionId } from "@/lib/scope";
import type { FlexPlan } from "@/lib/api/types";

/** Compact summary card for a Flex Plan, used in list views (/plans) and the command centre. */
export function PlanCard({ plan }: { plan: FlexPlan }) {
  const subdivisionLabel = isSubdivisionId(plan.subdivisionId) ? SUBDIVISION_LABEL[plan.subdivisionId] : plan.subdivisionId;
  const coverage = plan.gapKw > 0 ? plan.coveredKw / plan.gapKw : 1;
  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-md border border-border bg-surface-1 p-3 transition-colors hover:border-border-strong"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="num text-[12px] font-medium text-text">{plan.id}</span>
        <PlanStatusChip status={plan.status} size="sm" />
      </div>
      <p className="text-[12px] text-muted">{subdivisionLabel}</p>
      <p className="num mt-1 text-[13px] text-text">
        {formatKw(plan.coveredKw)} / {formatKw(plan.gapKw)} gap ({(coverage * 100).toFixed(0)}%)
      </p>
      <p className="mt-1 text-[11px] text-faint">
        Window {formatIstDateTime(plan.windowStartIso)} – {formatIstDateTime(plan.windowEndIso)}
      </p>
    </Link>
  );
}

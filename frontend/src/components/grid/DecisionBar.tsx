"use client";

import { useState } from "react";
import { PLAN_APPROVER_ROLES } from "@/lib/roleContext";
import type { Role } from "@/lib/roleContext";
import type { PlanStatus } from "@/lib/domain";

/**
 * The human-in-the-loop approval bar (SPEC step 4: Approve). Only `je`/`ae` roles may act; every
 * action requires a named approver, matching the "no autonomous action without a named human
 * approver" safety invariant (B7) this UI must not let a user bypass.
 */
export function DecisionBar({
  status,
  role,
  pending,
  onApprove,
  onReject,
  onCancel,
}: {
  status: PlanStatus;
  role: Role | null;
  pending?: boolean;
  onApprove: (approverName: string, notes?: string) => void;
  onReject: (approverName: string, notes?: string) => void;
  onCancel?: (approverName: string, notes?: string) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const canAct = role !== null && PLAN_APPROVER_ROLES.includes(role);
  const actionable = status === "proposed" || status === "draft";

  if (!canAct) {
    return (
      <p className="rounded-md border border-border bg-surface-2 p-3 text-[12px] text-muted">
        Only a Junior Engineer or Assistant Engineer can approve, edit, or reject this plan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-1 p-3">
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-muted">Approver name (required)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. R. Sharma"
          className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-muted">Notes (optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        />
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!actionable || !name || pending}
          onClick={() => onApprove(name, notes || undefined)}
          className="h-8 flex-1 rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!actionable || !name || pending}
          onClick={() => onReject(name, notes || undefined)}
          className="h-8 flex-1 rounded-md border border-red px-3 text-[12px] font-medium text-red disabled:opacity-40"
        >
          Reject
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={!name || pending}
            onClick={() => onCancel(name, notes || undefined)}
            className="h-8 rounded-md border border-border px-3 text-[12px] text-muted disabled:opacity-40"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

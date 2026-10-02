import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIstTime } from "@/lib/format";
import type { DispatchStep } from "@/lib/api/types";

const ICON = { done: Check, failed: X, skipped: X, pending: Clock, in_progress: Clock } as const;

/** Horizontal stepper for the dispatcher's per-plan timeline: notify -> signal -> hes -> start -> end -> verify. */
export function DispatchStepper({ steps }: { steps: DispatchStep[] }) {
  return (
    <ol className="flex items-stretch gap-0" aria-label="Dispatch timeline">
      {steps.map((s, i) => {
        const Icon = ICON[s.status];
        const active = s.status === "in_progress";
        const done = s.status === "done";
        return (
          <li key={s.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
                  done && "border-brand bg-brand-soft text-brand",
                  active && "border-info text-info",
                  s.status === "failed" && "border-red text-red",
                  s.status === "pending" && "border-border text-faint",
                  s.status === "skipped" && "border-border text-faint",
                )}
              >
                <Icon size={14} />
              </span>
              <span className="text-[11px] text-muted">{s.label}</span>
              <span className="num text-[10px] text-faint">
                {s.completedIso ? formatIstTime(s.completedIso) : formatIstTime(s.scheduledIso)}
              </span>
            </div>
            {i < steps.length - 1 && <div className="mx-1 h-px flex-1 self-center bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

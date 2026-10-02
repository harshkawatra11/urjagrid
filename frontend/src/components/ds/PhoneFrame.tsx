import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A phone-shaped frame for previewing consumer-facing surfaces (the /consumer app, a WhatsApp/IVR
 * message preview) inside a dashboard card or as the standalone consumer app's outer shell.
 */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[340px] rounded-[28px] border border-border-strong bg-surface-2 p-2 shadow-[var(--shadow-overlay)]", className)}>
      <div className="mb-1 flex justify-center">
        <div aria-hidden className="h-1.5 w-16 rounded-full bg-surface-3" />
      </div>
      <div className="min-h-[480px] overflow-y-auto rounded-[22px] bg-bg p-3">{children}</div>
    </div>
  );
}

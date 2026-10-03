import { cn } from "@/lib/cn";

export type LiveState = "live" | "stale" | "offline";

/** live = Google-green (data is flowing), stale = yellow (caution), offline = neutral gray. */
const COLOR: Record<LiveState, string> = {
  live: "bg-google-green",
  stale: "bg-amber",
  offline: "bg-faint",
};

export function LiveDot({ state, className }: { state: LiveState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={state}
      className={cn("relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full", COLOR[state], className)}
    >
      {state === "live" && (
        <span className="absolute inset-0 rounded-full bg-google-green opacity-60 motion-safe:animate-ping [animation-duration:1.6s]" />
      )}
    </span>
  );
}

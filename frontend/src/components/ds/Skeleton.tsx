import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-surface-3", className)} />;
}

/** Full-panel loading placeholder used by Lane D pages while a hook's first fetch is in flight. */
export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-12 gap-3", className)}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="col-span-3 h-28" />
      ))}
    </div>
  );
}

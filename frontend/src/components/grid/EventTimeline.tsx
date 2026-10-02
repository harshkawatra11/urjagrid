import { formatIstTime } from "@/lib/format";
import type { EventLogEntry } from "@/lib/api/types";

/** Reverse-chronological feed of grid/plan events, used in the command centre and case files. */
export function EventTimeline({ events }: { events: EventLogEntry[] }) {
  if (events.length === 0) {
    return <p className="text-[12px] text-faint">No events yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex gap-2 text-[12px]">
          <span className="num shrink-0 text-faint">{formatIstTime(e.timestampIso)}</span>
          <span className="shrink-0 rounded-sm bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">{e.kind}</span>
          <span className="text-text">{e.message}</span>
        </li>
      ))}
    </ol>
  );
}

import { MeterStateChip } from "@/components/ds/chips";
import { METER_STATE_COLOR_VAR, cssVar, type MeterState } from "@/lib/domain";
import type { Consumer } from "@/lib/api/types";

/**
 * A grid of per-consumer tiles colored by meter state (normal/DR/capped/shed/offline), the
 * at-a-glance "wall" used on DT case files and the lifeline/fairness page.
 */
export function MeterWall({ consumers, onSelect }: { consumers: Consumer[]; onSelect?: (id: string) => void }) {
  const counts = consumers.reduce<Record<MeterState, number>>(
    (acc, c) => ({ ...acc, [c.meterState]: (acc[c.meterState] ?? 0) + 1 }),
    { normal: 0, dr: 0, capped: 0, shed: 0, offline: 0 },
  );

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(counts) as MeterState[]).map((state) => (
          <li key={state} className="inline-flex items-center gap-1.5">
            <MeterStateChip state={state} size="sm" />
            <span className="num text-[11px] text-muted">{counts[state]}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-1" role="list" aria-label="Meter wall">
        {consumers.map((c) => (
          <button
            key={c.id}
            type="button"
            title={`${c.id} · ${c.meterState}`}
            onClick={() => onSelect?.(c.id)}
            className="aspect-square rounded-[3px]"
            style={{ background: cssVar(METER_STATE_COLOR_VAR[c.meterState]) }}
          />
        ))}
      </div>
    </div>
  );
}

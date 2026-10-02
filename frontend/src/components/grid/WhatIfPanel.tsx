"use client";

import { useState } from "react";
import { LeverChip } from "@/components/ds/chips";
import { LEVER_ORDER, CAP_LEVELS, CAP_LEVEL_LABEL, type LeverKey, type CapLevel } from "@/lib/domain";
import type { PlanOverrides } from "@/lib/api/types";

/** What-if controls for FlexPlanService.simulate: toggle levers, override cap level, scale DR participation. */
export function WhatIfPanel({
  initial,
  onSimulate,
  pending,
}: {
  initial?: PlanOverrides;
  onSimulate: (overrides: PlanOverrides) => void;
  pending?: boolean;
}) {
  const [leverEnabled, setLeverEnabled] = useState<Partial<Record<LeverKey, boolean>>>(initial?.leverEnabled ?? {});
  const [capLevelOverride, setCapLevelOverride] = useState<CapLevel | undefined>(initial?.capLevelOverride);
  const [drMultiplier, setDrMultiplier] = useState(initial?.drParticipationMultiplier ?? 1);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="eyebrow mb-2">Levers enabled</p>
        <div className="flex flex-wrap gap-2">
          {LEVER_ORDER.map((lever) => {
            const enabled = leverEnabled[lever] ?? true;
            return (
              <button
                key={lever}
                type="button"
                onClick={() => setLeverEnabled((prev) => ({ ...prev, [lever]: !enabled }))}
                className="opacity-100 transition-opacity"
                style={{ opacity: enabled ? 1 : 0.35 }}
              >
                <LeverChip lever={lever} size="sm" />
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-muted">Cap level override</span>
        <select
          value={capLevelOverride ?? ""}
          onChange={(e) => setCapLevelOverride(e.target.value === "" ? undefined : (e.target.value as CapLevel))}
          className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        >
          <option value="">No override</option>
          {CAP_LEVELS.map((level) => (
            <option key={level} value={level}>
              {CAP_LEVEL_LABEL[level]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-muted">DR participation multiplier: {drMultiplier.toFixed(2)}×</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={drMultiplier}
          onChange={(e) => setDrMultiplier(Number(e.target.value))}
        />
      </label>

      <button
        type="button"
        disabled={pending}
        onClick={() => onSimulate({ leverEnabled, capLevelOverride, drParticipationMultiplier: drMultiplier })}
        className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40"
      >
        Run what-if
      </button>
    </div>
  );
}

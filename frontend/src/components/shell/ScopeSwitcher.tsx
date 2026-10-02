"use client";

import { SUBDIVISION_IDS, SUBDIVISION_LABEL, useScope, type Scope } from "@/lib/scope";

export function ScopeSwitcher() {
  const { scope, setScope } = useScope();
  return (
    <select
      aria-label="Sub-division scope"
      value={scope}
      onChange={(e) => setScope(e.target.value as Scope)}
      className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px] text-text"
    >
      <option value="all">All sub-divisions</option>
      {SUBDIVISION_IDS.map((id) => (
        <option key={id} value={id}>
          {SUBDIVISION_LABEL[id]}
        </option>
      ))}
    </select>
  );
}

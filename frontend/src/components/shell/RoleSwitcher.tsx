"use client";

import { ROLES, ROLE_LABEL, useRole, type Role } from "@/lib/roleContext";

/** Demo-mode role switcher. Does not call the backend; `demoLogin` (lib/auth.ts) is used by the
 * dedicated login flow Lane D builds -- this control only changes which surface/nav the shell shows. */
export function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <select
      aria-label="Role"
      value={role ?? ""}
      onChange={(e) => setRole(e.target.value === "" ? null : (e.target.value as Role))}
      className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px] text-text"
    >
      <option value="">Select role…</option>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

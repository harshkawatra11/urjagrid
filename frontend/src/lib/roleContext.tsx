"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** The 6 auth roles (SPEC section 1 users/roles). */
export const ROLES = ["consumer", "field", "je", "ae", "regulator", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  consumer: "Household / shop",
  field: "Field worker",
  je: "Junior Engineer",
  ae: "Assistant Engineer",
  regulator: "Regulator",
  admin: "Demo operator",
};

/** Default dashboard surface for each role, used for post-login redirects. */
export const ROLE_HOME: Record<Role, string> = {
  consumer: "/consumer",
  field: "/field",
  je: "/plans",
  ae: "/command",
  regulator: "/regulator",
  admin: "/command",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Roles allowed to approve/reject/edit a Flex Plan. */
export const PLAN_APPROVER_ROLES: readonly Role[] = ["je", "ae"];

/** Roles allowed to see per-consumer (non-aggregated) data. Regulator never does. */
export const CONSUMER_DATA_ROLES: readonly Role[] = ["consumer", "field", "je", "ae", "admin"];

interface RoleContextValue {
  role: Role | null;
  setRole: (role: Role | null) => void;
}

const ROLE_KEY = "llg-role";

const RoleContext = createContext<RoleContextValue | null>(null);

function readStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    if (v && isRole(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => readStoredRole());

  const setRole = useCallback((next: Role | null) => {
    setRoleState(next);
    try {
      if (next) window.localStorage.setItem(ROLE_KEY, next);
      else window.localStorage.removeItem(ROLE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}

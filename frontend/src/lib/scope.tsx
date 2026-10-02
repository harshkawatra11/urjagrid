"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** The 5 canonical sub-division ids (SPEC section 1 geography). */
export const SUBDIVISION_IDS = [
  "sd_subhashnagar",
  "sd_izzatnagar",
  "sd_faridpur",
  "sd_krishnanagar",
  "sd_kosikalan",
] as const;

export type SubdivisionId = (typeof SUBDIVISION_IDS)[number];

export const SUBDIVISION_LABEL: Record<SubdivisionId, string> = {
  sd_subhashnagar: "Subhash Nagar",
  sd_izzatnagar: "Izzatnagar",
  sd_faridpur: "Faridpur",
  sd_krishnanagar: "Krishna Nagar",
  sd_kosikalan: "Kosi Kalan",
};

export const SUBDIVISION_TOWN: Record<SubdivisionId, string> = {
  sd_subhashnagar: "Bareilly",
  sd_izzatnagar: "Bareilly",
  sd_faridpur: "Bareilly",
  sd_krishnanagar: "Mathura",
  sd_kosikalan: "Mathura",
};

export const SUBDIVISION_DISCOM: Record<SubdivisionId, "MVVNL" | "DVVNL"> = {
  sd_subhashnagar: "MVVNL",
  sd_izzatnagar: "MVVNL",
  sd_faridpur: "MVVNL",
  sd_krishnanagar: "DVVNL",
  sd_kosikalan: "DVVNL",
};

/** "all" means no sub-division filter -- used by cross-sub-division (ae) and regulator views. */
export type Scope = SubdivisionId | "all";

export function isSubdivisionId(value: string): value is SubdivisionId {
  return (SUBDIVISION_IDS as readonly string[]).includes(value);
}

interface ScopeContextValue {
  scope: Scope;
  setScope: (scope: Scope) => void;
}

const SCOPE_KEY = "llg-scope";

const ScopeContext = createContext<ScopeContextValue | null>(null);

function readStoredScope(): Scope {
  if (typeof window === "undefined") return "all";
  try {
    const v = window.localStorage.getItem(SCOPE_KEY);
    if (v && (v === "all" || isSubdivisionId(v))) return v;
  } catch {
    /* storage unavailable */
  }
  return "all";
}

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<Scope>(() => readStoredScope());

  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    try {
      window.localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(() => ({ scope, setScope }), [scope, setScope]);

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used within a ScopeProvider");
  return ctx;
}

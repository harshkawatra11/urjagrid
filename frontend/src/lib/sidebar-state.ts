"use client";

import { useSyncExternalStore } from "react";

const KEY = "llg-sidebar-collapsed";
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => false,
  );
}

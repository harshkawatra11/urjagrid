"use client";

import { Moon, Sun } from "lucide-react";
import { applyTheme } from "@/lib/theme";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-1 text-muted hover:bg-surface-3 hover:text-text"
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

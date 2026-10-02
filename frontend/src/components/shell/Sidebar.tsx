"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Wordmark, LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/cn";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/sidebar-state";
import { NAV_GROUPS, findActiveHref, navItems } from "./nav-items";

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);

  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="mb-4">
          {!collapsed && <p className="eyebrow px-2 pb-1.5">{group}</p>}
          {navItems
            .filter((item) => item.group === group)
            .map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-brand-soft font-medium text-text" : "text-muted hover:bg-surface-3 hover:text-text",
                  )}
                >
                  {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />}
                  <Icon size={16} strokeWidth={1.75} className={active ? "text-brand" : undefined} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useSidebarCollapsed();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-bg-elevated transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center" : "px-4")}>
        {collapsed ? <LogoMark /> : <Wordmark />}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[12px] text-muted hover:bg-surface-3 hover:text-text",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

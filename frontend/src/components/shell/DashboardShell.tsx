"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { RoleProvider } from "@/lib/roleContext";
import { ScopeProvider } from "@/lib/scope";
import { LiveProvider } from "@/lib/live/LiveProvider";
import { ApiEntityIndexProvider } from "@/lib/api/entities";
import { Sidebar, SidebarNav } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PageTransition } from "./PageTransition";

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative flex h-full w-[260px] flex-col bg-bg-elevated">
        <SidebarNav onNavigate={onClose} />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const [navPath, setNavPath] = useState(pathname);
  // Close the mobile nav when the route changes (state adjusted during render, not in an effect).
  if (navPath !== pathname) {
    setNavPath(pathname);
    setNavOpen(false);
  }

  return (
    <>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenNav={() => setNavOpen(true)} />
          <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-5 lg:px-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </>
  );
}

/** Root client shell for every `(dashboard)` route: role/scope/live/entity providers + sidebar/topbar frame. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <ScopeProvider>
        <LiveProvider>
          <ApiEntityIndexProvider>
            <Shell>{children}</Shell>
          </ApiEntityIndexProvider>
        </LiveProvider>
      </ScopeProvider>
    </RoleProvider>
  );
}
